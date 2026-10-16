import { getFrameRenderProfile } from '../frameRenderProfile';
import { buildFrameMesh } from './frameMesh';
import { buildHardwareParts } from './frameHardware';
import { buildGlb } from './glbWriter';
import { buildUsda, packUsdz } from './usdzWriter';
import { loadRailTexture, renderArtworkTexture, renderCanvasEdgeTextures } from './arTextures';

/**
 * Builds the pair of models the AR viewer needs — .glb for Android and
 * WebXR, .usdz for iOS — from a live frame configuration.
 *
 * Both are produced from one mesh and one set of textures, so the two
 * platforms cannot drift apart: a change to the moulding profile or the
 * mat construction lands in both or neither.
 */

// Surface response per catalogue finish. Metallic mouldings need a real
// metallic factor or gilding reads as beige plastic under AR's
// environment lighting; matte wood needs the opposite or it reads as
// wet varnish.
const FINISH_SURFACE = {
    metallic: { metallic: 0.85, roughness: 0.32 },
    gloss: { metallic: 0.12, roughness: 0.16 },
    matte: { metallic: 0.0, roughness: 0.72 },
};

const hexToRgb = (hex) => {
    const clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return [1, 1, 1];
    const int = parseInt(clean, 16);
    if (!Number.isFinite(int)) return [1, 1, 1];
    // sRGB -> linear, because both glTF and USD take base colour in
    // linear space. Skipping it makes every mat noticeably paler than
    // the swatch the customer picked.
    return [
        ((int >> 16) & 255) / 255,
        ((int >> 8) & 255) / 255,
        (int & 255) / 255,
    ].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
};

// Rebuilding costs an image decode, a canvas composite, two PNG
// encodes, and two file writes — worth avoiding when a customer toggles
// AR off and straight back on, or flips between two sizes and returns.
// Six is enough to cover that kind of back-and-forth without holding
// many megabytes of blob alive.
const CACHE_LIMIT = 6;
const cache = new Map();

function releaseEntry(entry) {
    URL.revokeObjectURL(entry.glbUrl);
    URL.revokeObjectURL(entry.usdzUrl);
}

/**
 * Frees every cached model. Call when leaving the customizer — blob
 * URLs are owned by the document, so without this they outlive the
 * component that created them for as long as the tab is open.
 */
export function clearArModelCache() {
    for (const entry of cache.values()) releaseEntry(entry);
    cache.clear();
}

/**
 * @param {object} config
 * @param {object} config.frame       catalogue frame record
 * @param {number} config.widthIn     artwork width
 * @param {number} config.heightIn    artwork height
 * @param {{topIn: number, sideIn: number, bottomIn: number}} [config.matReveal]
 *                                    mat reveal per edge, all 0 for none — see
 *                                    buildFrameMesh's own doc for why this is
 *                                    three numbers rather than one.
 * @param {string} config.matColorHex
 * @param {string} config.artworkUrl
 * @returns {Promise<{glbUrl: string, usdzUrl: string, outerWidthM: number, outerHeightM: number, profile: string, isMeasured: boolean}>}
 */
export async function buildArModel({ frame, widthIn, heightIn, matReveal, matColorHex, glassType = 'standard', artworkUrl, hardwareType, canvasWrap = 'ImageWrap' }) {
    const key = JSON.stringify([
        frame?.id, widthIn, heightIn, matReveal, matColorHex, glassType, artworkUrl, hardwareType, canvasWrap,
    ]);

    if (cache.has(key)) {
        // Re-inserting refreshes recency for the eviction order below.
        const hit = cache.get(key);
        cache.delete(key);
        cache.set(key, hit);
        return hit;
    }

    const renderProfile = getFrameRenderProfile(frame);
    const surface = FINISH_SURFACE[renderProfile.finish] || FINISH_SURFACE.matte;

    const [railTexture, artTexture] = await Promise.all([
        // Exposure parity with the 2D asset makes a dynamic normal map
        // inappropriate here: unlit materials intentionally ignore it.
        loadRailTexture(frame, { includeNormal: false }),
        renderArtworkTexture(artworkUrl, widthIn, heightIn, glassType),
    ]);

    const mesh = buildFrameMesh({
        artworkWidthIn: widthIn,
        artworkHeightIn: heightIn,
        mouldingWidthIn: renderProfile.mouldingWidthIn,
        rabbetDepthIn: renderProfile.rabbetDepthIn,
        totalDepthIn: renderProfile.totalDepthIn,
        openingGapIn: renderProfile.openingGapIn,
        canvasThicknessIn: renderProfile.canvasThicknessIn,
        canvasOnly: renderProfile.isCanvasOnly,
        crossSection: renderProfile.crossSection,
        splitRailSurfaces: renderProfile.splitRailSurfaces,
        matBoardIn: renderProfile.matBoardIn,
        profile: renderProfile.profile,
        matReveal: frame?.isCanvas ? { topIn: 0, sideIn: 0, bottomIn: 0 } : matReveal,
        // Falls back to a 4:1 strip when no rail photography resolved,
        // which only affects how often a texture that isn't there would
        // have repeated.
        railTileAspect: railTexture?.aspect || 4,
        // Disabled (2026-08-31, the day it shipped): the corner photo is
        // an oblique product shot, and mapping it via the wedge's UV —
        // (u: tip-to-middle along the rail, v: outer-to-inner across the
        // profile) — implicitly assumes a front-on, fully-packed texture
        // the same way the straight rail texture is. An oblique photo
        // isn't that: large parts of its frame are the photo's own
        // white studio background, which the UV mapping stretches across
        // the wedge as if it were material. Rendering the actual result
        // (not just checking the geometry, which is correct) showed an
        // obvious white-and-jagged artifact at every corner, in both an
        // orthographic front view and a realistic angled AR perspective
        // — this is live in production right now and needs to come back
        // out immediately. The corner-splitting geometry itself stays
        // (harmless with hasCorner false, and it's still correct — see
        // arModel.test.js), so re-enabling is just flipping this back to
        // Boolean(cornerTexture) once the texture side has a real fix:
        // most likely rectifying the photo into a front-on tile first,
        // the same unstarted piece already flagged for the 2D visualizer
        // in the ar-frame-asset-gap memory note.
        hasCorner: false,
        showCornerSeams: frame?.id === 'frame-10728',
    });

    // Hanging hardware mounts to the back, so it needs the frame's
    // finished outer size rather than the artwork's — a D-ring sits a
    // third down the frame, not a third down the picture. Stretched canvas
    // hangs directly from its stretcher bar, so hardware is omitted.
    if (!renderProfile.isCanvasOnly && hardwareType && hardwareType !== 'none') {
        mesh.parts.push(...buildHardwareParts(hardwareType, mesh));
    }

    const canvasEdges = renderProfile.canvasThicknessIn > 0
        ? await renderCanvasEdgeTextures(artTexture, widthIn, heightIn, renderProfile.canvasThicknessIn, canvasWrap)
        : {};

    const materials = {
        rail: railTexture
            ? {
                texture: railTexture.bytes,
                unlit: true,
                ...surface,
            }
            : { baseColor: [...hexToRgb(frame?.baseColor), 1], unlit: true, ...surface },
        art: {
            texture: artTexture,
            // Match the colour-managed 2D preview exactly. Lighting is
            // reserved for the physical frame construction; otherwise
            // AR environment probes alter artwork exposure and colour.
            unlit: true,
            metallic: 0,
            roughness: 1,
        },
        ...Object.fromEntries(Object.entries(canvasEdges).map(([name, texture]) => [name, {
            texture,
            metallic: 0,
            roughness: 0.9,
        }])),
        railSide: {
            ...(railTexture ? { texture: railTexture.bytes } : {}),
            baseColor: [...hexToRgb(frame?.baseColor), 1],
            metallic: frame?.prodigiProduct === 'aluminium' ? 0.85 : renderProfile.finish === 'metallic' ? 0.55 : 0,
            roughness: frame?.prodigiProduct === 'aluminium' ? 0.35 : renderProfile.finish === 'metallic' ? 0.48 : 0.8,
        },
        railInner: { baseColor: [...hexToRgb(frame?.canvasGapMm && frame?.prodigiColor === 'natural' ? '#202022' : frame?.baseColor), 1],
            metallic: frame?.prodigiProduct === 'aluminium' ? 0.85 : 0,
            roughness: frame?.prodigiProduct === 'aluminium' ? 0.35 : 0.9 },
        railBack: {
            baseColor: frame?.prodigiProduct === 'aluminium'
                ? [...hexToRgb(frame?.baseColor), 1]
                : [...hexToRgb('#9e815a'), 1], // kraft framer's sealing tape
            metallic: frame?.prodigiProduct === 'aluminium' ? 0.85 : 0,
            roughness: frame?.prodigiProduct === 'aluminium' ? 0.35 : 0.92,
        },
        stretcherBar: {
            baseColor: [...hexToRgb('#d2b896'), 1], // natural kiln-dried European pine
            metallic: 0,
            roughness: 0.88,
        },
        shadowGap: { baseColor: [...hexToRgb('#24211e'), 1], metallic: 0, roughness: 1 },
        // Mat board is uncoated stock — flat, and never shiny.
        mat: { baseColor: [...hexToRgb(matColorHex || '#ffffff'), 1], unlit: true, metallic: 0, roughness: 0.94 },
        // The bevel is the board's own cut core, which is near-white on
        // conservation stock whatever the surface colour is.
        matBevel: { baseColor: [...hexToRgb('#f7f4ee'), 1], unlit: true, metallic: 0, roughness: 0.88 },
        // Warm natural kraft MDF backing board for frames, or unprimed raw cotton canvas for stretched canvas
        backing: {
            baseColor: [...hexToRgb(renderProfile.isCanvasOnly ? '#ebe4d6' : '#c5ab86'), 1],
            metallic: 0,
            roughness: 0.94,
        },
        // Plated steel fittings — catches backFill light with metallic sheen
        hardware: {
            baseColor: [...hexToRgb('#2c2c2e'), 1],
            metallic: 0.85,
            roughness: 0.32,
        },
        railSeam: { baseColor: [...hexToRgb('#9b9b9b'), 1], unlit: true, metallic: 0, roughness: 0.9 },
    };

    // Only ship materials the mesh actually references — a matless
    // configuration has no mat or bevel geometry, and an unused
    // material is a validation warning in both formats.
    const used = new Set(mesh.parts.map((p) => p.material));
    const activeMaterials = Object.fromEntries(
        Object.entries(materials).filter(([name]) => used.has(name))
    );

    const glb = buildGlb({ parts: mesh.parts, materials: activeMaterials });

    const usda = buildUsda({ parts: mesh.parts, materials: activeMaterials });
    const usdzEntries = [
        { name: 'frame.usda', bytes: new TextEncoder().encode(usda) },
        ...Object.entries(activeMaterials).flatMap(([name, spec]) => [
            spec.texture ? { name: `textures/${name}.png`, bytes: spec.texture } : null,
            spec.normalTexture
                ? { name: `textures/${name}-normal.png`, bytes: spec.normalTexture }
                : null,
        ].filter(Boolean)),
    ];
    const usdz = packUsdz(usdzEntries);

    const entry = {
        glbUrl: URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })),
        usdzUrl: URL.createObjectURL(new Blob([usdz], { type: 'model/vnd.usdz+zip' })),
        outerWidthM: mesh.outerWidthM,
        outerHeightM: mesh.outerHeightM,
        profile: renderProfile.profile,
        isMeasured: renderProfile.isMeasured,
    };

    cache.set(key, entry);
    if (cache.size > CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        releaseEntry(cache.get(oldestKey));
        cache.delete(oldestKey);
    }

    return entry;
}
