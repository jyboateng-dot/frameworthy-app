import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * The renderer behind both the orbit preview and the in-page WebXR
 * session.
 *
 * One scene serves both because they differ only in where the camera
 * comes from — the preview drives it with a mouse, the AR session
 * drives it from the device's own pose — so the model, materials, and
 * lighting are set up once and reused rather than built twice.
 */

// Wall pieces hang with their back to a surface. The mesh is authored
// standing in XY with +Z out of the wall, and WebXR reports a hit
// pose's +Y along the surface normal, so tilting the model back a
// quarter turn about X is what aligns those two conventions.
const WALL_TILT = -Math.PI / 2;

export class ArScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: false,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 40);

        // A metal's colour IS its environment reflection — a PBR metal has
        // essentially no diffuse response, so at metallic: 0.85
        // (buildArModel's own value for gilded/gold finishes) direct
        // lights alone leave every unlit-facing patch of the moulding
        // reading as flat black, confirmed on a real gold frame in the
        // desktop orbit preview. This was the original assumption here —
        // "a hemisphere fill plus one key light is enough... without
        // shipping an HDR environment map" — which holds for the matte
        // and low-metalness finishes but not for metallic ones.
        // RoomEnvironment is a small procedural room three.js generates
        // on the fly (no network fetch, no bundled asset), which is the
        // standard fix for exactly this — it gives a metal something
        // plausible to reflect without needing a real HDRI. Real AR
        // viewers (Quick Look, Scene Viewer) already supply their own
        // environment via the device camera feed, which is why the same
        // material only ever looked wrong in this in-page preview.
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.environmentTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environment = this.environmentTexture;
        pmremGenerator.dispose();

        // Gilding and lacquer still need something with direction to
        // catch beyond the environment's soft fill, or a metallic
        // moulding reads as a flat, shadowless disc.
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8880, 2.1));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(-1.4, 2.2, 2.6);
        this.scene.add(key);
        const rim = new THREE.DirectionalLight(0xffffff, 0.6);
        rim.position.set(2.0, -0.8, -1.4);
        this.scene.add(rim);

        // The back of the piece is the only place the hanging hardware
        // is visible, and it faces away from both lights above. Without
        // its own source the customer rotates around to inspect the
        // fitting they chose and finds an unlit silhouette.
        const backFill = new THREE.DirectionalLight(0xffffff, 1.5);
        backFill.position.set(-0.6, 1.0, -2.6);
        this.scene.add(backFill);

        this.modelRoot = new THREE.Group();
        this.placement = new THREE.Group();
        this.placement.add(this.modelRoot);
        this.scene.add(this.placement);

        this.reticle = this._buildReticle();
        this.scene.add(this.reticle);

        this.controls = null;
        this.session = null;
        this.hitTestSource = null;
        this.isPlaced = false;
        this.onSessionEnd = null;

        this._onResize = this._onResize.bind(this);
        window.addEventListener('resize', this._onResize);
    }

    _buildReticle() {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.055, 0.07, 40),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
        );
        // The ring is authored in XY; hit poses arrive with +Y along the
        // surface normal, so it needs the same quarter turn the model
        // gets to lie flat against whatever it found.
        ring.rotation.x = WALL_TILT;
        ring.visible = false;
        ring.matrixAutoUpdate = false;
        return ring;
    }

    async loadModel(glbUrl) {
        const gltf = await new GLTFLoader().loadAsync(glbUrl);

        this.modelRoot.clear();
        this.modelRoot.add(gltf.scene);

        // Measured once here so both the preview framing and the AR
        // placement work from the same numbers.
        const box = new THREE.Box3().setFromObject(gltf.scene);
        this.size = box.getSize(new THREE.Vector3());
        this.center = box.getCenter(new THREE.Vector3());

        // Recentre so rotation in the preview pivots around the piece
        // rather than around wherever the mesh happens to sit.
        gltf.scene.position.sub(this.center);
        return this.size;
    }

    /** Orbit preview — the desktop experience, and the staging view everywhere else. */
    startPreview() {
        this.placement.position.set(0, 0, 0);
        this.placement.quaternion.identity();
        this.placement.visible = true;
        this.modelRoot.rotation.set(0, 0, 0);

        const longest = Math.max(this.size?.x || 0.5, this.size?.y || 0.5);
        this.camera.position.set(0, 0, longest * 2.35);
        this.camera.lookAt(0, 0, 0);

        if (!this.controls) {
            this.controls = new OrbitControls(this.camera, this.canvas);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            this.controls.enablePan = false;
            this.controls.minDistance = longest * 0.85;
            this.controls.maxDistance = longest * 5;
            // Stops short of the poles so the piece is never viewed
            // from exactly edge-on, where a frame is a line.
            this.controls.minPolarAngle = 0.25;
            this.controls.maxPolarAngle = Math.PI - 0.25;
        }
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        this._onResize();
        this.renderer.setAnimationLoop(() => {
            this.controls?.update();
            this.renderer.render(this.scene, this.camera);
        });
    }

    /**
     * Starts an in-page immersive-ar session with wall hit-testing.
     *
     * `dom-overlay` carries our own instruction/exit UI into the
     * session; without it the session takes over the display entirely
     * and the only way out is the system back gesture.
     */
    async startAr(overlayRoot) {
        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay', 'light-estimation'],
            domOverlay: overlayRoot ? { root: overlayRoot } : undefined,
        });

        this.session = session;
        this.isPlaced = false;
        this.controls?.dispose();
        this.controls = null;

        this.renderer.xr.enabled = true;
        await this.renderer.xr.setSession(session);

        // Hit tests are reported relative to where the viewer was
        // looking when the source was requested; 'viewer' is what makes
        // the reticle track the centre of the screen.
        const viewerSpace = await session.requestReferenceSpace('viewer');
        this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
        const localSpace = await session.requestReferenceSpace('local');

        this.placement.visible = false;
        this.modelRoot.rotation.x = WALL_TILT;

        session.addEventListener('end', () => {
            this.hitTestSource = null;
            this.session = null;
            this.renderer.xr.enabled = false;
            this.onSessionEnd?.();
        });

        this.renderer.setAnimationLoop((_, frame) => {
            if (frame && this.hitTestSource && !this.isPlaced) {
                const hits = frame.getHitTestResults(this.hitTestSource);
                if (hits.length) {
                    const pose = hits[0].getPose(localSpace);
                    if (pose) {
                        this.reticle.visible = true;
                        this.reticle.matrix.fromArray(pose.transform.matrix);
                        this._lastHit = pose.transform.matrix;
                    }
                } else {
                    this.reticle.visible = false;
                }
            }
            this.renderer.render(this.scene, this.camera);
        });

        return session;
    }

    /** Commits the piece to wherever the reticle currently sits. */
    place() {
        if (!this._lastHit) return false;
        this.placement.matrixAutoUpdate = false;
        this.placement.matrix.fromArray(this._lastHit);
        this.placement.visible = true;
        this.reticle.visible = false;
        this.isPlaced = true;
        return true;
    }

    /** Returns to reticle mode so the piece can be re-placed. */
    unplace() {
        this.isPlaced = false;
        this.placement.visible = false;
    }

    endAr() {
        this.session?.end().catch(() => {});
    }

    _onResize() {
        if (this.session) return; // XR owns the framebuffer during a session.
        const width = this.canvas.clientWidth || 1;
        const height = this.canvas.clientHeight || 1;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    dispose() {
        window.removeEventListener('resize', this._onResize);
        this.renderer.setAnimationLoop(null);
        this.controls?.dispose();
        this.session?.end().catch(() => {});
        this.environmentTexture?.dispose();
        this.scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const m of materials) {
                    m.map?.dispose();
                    m.dispose();
                }
            }
        });
        this.renderer.dispose();
    }
}
