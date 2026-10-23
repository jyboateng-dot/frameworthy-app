import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FRAME_STYLES } from '../../data/constants';
import { getFrameRail, getRailTextureStyle } from '../frameRail';
import { getFrameRenderProfile } from '../frameRenderProfile';
import { railCandidates } from './arTextures';
import { buildFrameMesh } from './frameMesh';
import { buildGlb } from './glbWriter';
import { buildUsda, packUsdz } from './usdzWriter';
import { buildHardwareParts } from './frameHardware';

const frames = FRAME_STYLES.filter(frame => frame.prodigiProduct);
const noMat = { topIn: 0, sideIn: 0, bottomIn: 0 };
const meshFor = (frame, overrides = {}) => {
    const p = getFrameRenderProfile(frame);
    return buildFrameMesh({ artworkWidthIn: 16, artworkHeightIn: 20,
        ...p, canvasOnly: p.isCanvasOnly, matReveal: noMat, ...overrides });
};

describe('Prodigi rendering integration', () => {
    it('provides the same existing local face assets to 2D and AR for every framed finish', () => {
        expect(frames.filter(f => !f.canvasOnly)).toHaveLength(34);
        for (const frame of frames.filter(f => !f.canvasOnly)) {
            const rail = getFrameRail(frame);
            expect(rail, frame.id).toBeTruthy();
            expect(existsSync(resolve('public', rail.h.slice(1))), frame.id).toBe(true);
            expect(existsSync(resolve('public', rail.v.slice(1))), frame.id).toBe(true);
            expect(railCandidates(frame)[0].split('?')[0]).toBe(rail.h);
            expect(getRailTextureStyle('left', rail).transform).toBe('scaleX(-1)');
            expect(getRailTextureStyle('bottom', rail).transform).toBe('scaleY(-1)');
        }
    });

    it('keeps measured wall depth and rail width across sizes for every product', () => {
        for (const frame of frames) {
            const p = getFrameRenderProfile(frame);
            for (const size of [[5, 7], [20, 30], [48, 48]]) {
                const mesh = meshFor(frame, { artworkWidthIn: size[0], artworkHeightIn: size[1] });
                expect(mesh.depthM, frame.id).toBeCloseTo(p.totalDepthIn * 0.0254, 6);
                expect(mesh.outerWidthM).toBeCloseTo((size[0] + 2 * (p.mouldingWidthIn + p.openingGapIn)) * 0.0254, 6);
                for (const part of mesh.parts) expect(part.positions.every(Number.isFinite), frame.id).toBe(true);
            }
        }
    });

    it('places the float canvas near the frame face and builds four 38mm sides and a 5mm gap', () => {
        for (const family of ['canvas-float', 'canvas-eco']) {
            const mesh = meshFor(frames.find(f => f.prodigiProduct === family));
            const front = mesh.parts.find(p => p.material === 'art');
            expect(front.positions[2]).toBeCloseTo(0.051, 6);
            expect(mesh.parts.find(p => p.material === 'shadowGap')).toBeTruthy();
            const top = mesh.parts.find(p => p.material === 'canvasTop');
            const zs = top.positions.filter((_, i) => i % 3 === 2);
            expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(0.038, 6);
            expect(mesh.parts.find(p => p.material === 'mat')).toBeUndefined();
        }
    });

    it('exports complete materials for both formats for every family', () => {
        for (const family of new Set(frames.map(f => f.prodigiProduct))) {
            const mesh = meshFor(frames.find(f => f.prodigiProduct === family));
            const materials = Object.fromEntries(mesh.parts.map(p => [p.material, { baseColor: [0.5, 0.5, 0.5, 1] }]));
            const glb = buildGlb({ parts: mesh.parts, materials });
            const header = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
            expect(header.getUint32(0, true)).toBe(0x46546c67);
            const usda = buildUsda({ parts: mesh.parts, materials });
            expect(usda).toContain('#usda 1.0');
            const usdz = packUsdz([{ name: 'frame.usda', bytes: new TextEncoder().encode(usda) }]);
            expect(usdz.byteLength).toBeGreaterThan(1000);
        }
    });

    it('treats an absent total depth as the legacy rabbet plus backing, not zero', () => {
        const mesh = meshFor(frames[0], { totalDepthIn: null });
        expect(mesh.depthM).toBeCloseTo((17 / 25.4 + 0.1875) * 0.0254, 6);
    });

    it('generates non-degenerate isotropic UVs on railSide matching physical depth-to-width ratio', () => {
        for (const frame of frames.filter(f => !f.canvasOnly)) {
            const p = getFrameRenderProfile(frame);
            const mesh = meshFor(frame);
            const side = mesh.parts.find(part => part.material === 'railSide');
            expect(side, `railSide should exist for ${frame.id}`).toBeDefined();
            expect(side.uvs.length).toBeGreaterThan(0);

            const vs = side.uvs.filter((_, i) => i % 2 === 1);
            const maxV = Math.max(...vs);
            const minV = Math.min(...vs);
            const depthM = p.totalDepthIn * 0.0254;
            const widthM = p.mouldingWidthIn * 0.0254;
            const expectedV = depthM / widthM;

            expect(maxV, `max V for ${frame.id}`).toBeCloseTo(expectedV, 4);
            expect(minV, `min V for ${frame.id}`).toBeLessThan(0.05 * expectedV);
        }
    });

    it('deduplicates texture image buffers in GLB when rail and railSide share texture bytes', () => {
        const frame = frames.find(f => !f.canvasOnly);
        const mesh = meshFor(frame);
        const sharedBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
        const materials = {
            rail: { texture: sharedBytes, unlit: true },
            railSide: { texture: sharedBytes, metallic: 0, roughness: 0.8 },
            railInner: { baseColor: [0.1, 0.1, 0.1, 1] },
            backing: { baseColor: [0.18, 0.16, 0.15, 1] },
            art: { baseColor: [1, 1, 1, 1] },
        };
        const glb = buildGlb({ parts: mesh.parts, materials });
        const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
        const jsonLength = view.getUint32(12, true);
        const jsonText = new TextDecoder().decode(new Uint8Array(glb.buffer, glb.byteOffset + 20, jsonLength));
        const gltf = JSON.parse(jsonText);

        expect(gltf.images.length).toBe(1);
        expect(gltf.textures.length).toBe(1);
        const railMat = gltf.materials.find(m => m.name === 'rail');
        const sideMat = gltf.materials.find(m => m.name === 'railSide');
        expect(railMat.pbrMetallicRoughness.baseColorTexture.index).toBe(0);
        expect(sideMat.pbrMetallicRoughness.baseColorTexture.index).toBe(0);
    });

    it('generates railBack for framed finishes and stretcherBar for stretched canvas', () => {
        // Framed finishes with split rail surfaces emit railBack for perimeter sealing/extrusion
        const classic = frames.find(f => f.prodigiProduct === 'classic');
        const classicMesh = meshFor(classic);
        expect(classicMesh.parts.find(p => p.material === 'railBack')).toBeDefined();
        expect(classicMesh.parts.find(p => p.material === 'backing')).toBeDefined();

        // Stretched canvas emits pine stretcher bars and recessed raw canvas back
        const stretched = frames.find(f => f.canvasOnly);
        const canvasMesh = meshFor(stretched);
        expect(canvasMesh.parts.find(p => p.material === 'stretcherBar')).toBeDefined();
        expect(canvasMesh.parts.find(p => p.material === 'backing')).toBeDefined();
        expect(canvasMesh.parts.find(p => p.material === 'railBack')).toBeUndefined();
    });

    it('attaches accurate hanging hardware and preserves physical depth and profiles across all families', () => {
        // 1. Classic Frame: 22mm depth, Cobra hook hardware, kraft tape railBack
        const classic = frames.find(f => f.prodigiProduct === 'classic');
        const classicMesh = meshFor(classic);
        const classicHardware = buildHardwareParts('cobra-hook', classicMesh);
        classicMesh.parts.push(...classicHardware);

        expect(classicMesh.depthM).toBeCloseTo(22 / 25.4 * 0.0254, 4);
        expect(classicMesh.parts.some(p => p.material === 'hardware')).toBe(true);
        expect(classicMesh.parts.some(p => p.material === 'railSide')).toBe(true);
        expect(classicMesh.parts.some(p => p.material === 'railBack')).toBe(true);
        expect(classicMesh.parts.some(p => p.material === 'backing')).toBe(true);

        // Hardware sits behind the frame (z <= 0)
        const hwPart = classicMesh.parts.find(p => p.material === 'hardware');
        const hwZs = hwPart.positions.filter((_, i) => i % 3 === 2);
        expect(Math.max(...hwZs)).toBeLessThanOrEqual(0.001);

        // 2. Aluminium Frame: 19mm depth, built-in rear hanger
        const alu = frames.find(f => f.prodigiProduct === 'aluminium');
        const aluMesh = meshFor(alu);
        const aluHardware = buildHardwareParts('built-in-rear-hanger', aluMesh);
        aluMesh.parts.push(...aluHardware);

        expect(aluMesh.depthM).toBeCloseTo(19 / 25.4 * 0.0254, 4);
        expect(aluMesh.parts.some(p => p.material === 'hardware')).toBe(true);
        expect(aluMesh.parts.some(p => p.material === 'railSide')).toBe(true);
        expect(aluMesh.parts.some(p => p.material === 'railBack')).toBe(true);

        // 3. Stretched Canvas: 38mm depth, 4 wrapped canvas sides, no hardware
        const stretched = frames.find(f => f.canvasOnly);
        const canvasMesh = meshFor(stretched);
        // Canvas hanging hardware must be 'none'
        const canvasHardware = buildHardwareParts('none', canvasMesh);
        expect(canvasHardware).toEqual([]);

        expect(canvasMesh.depthM).toBeCloseTo(38 / 25.4 * 0.0254, 4);
        expect(canvasMesh.parts.some(p => p.material === 'hardware')).toBe(false);
        for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
            expect(canvasMesh.parts.some(p => p.material === `canvas${side}`)).toBe(true);
        }
        expect(canvasMesh.parts.some(p => p.material === 'stretcherBar')).toBe(true);
        expect(canvasMesh.parts.some(p => p.material === 'backing')).toBe(true);

        // 4. Float Canvas Frame: 53mm depth, 38mm canvas, 5mm shadow gap, no hardware
        const floater = frames.find(f => f.prodigiProduct === 'canvas-float');
        const floaterMesh = meshFor(floater);
        const floaterHardware = buildHardwareParts('none', floaterMesh);
        expect(floaterHardware).toEqual([]);

        expect(floaterMesh.depthM).toBeCloseTo(53 / 25.4 * 0.0254, 4);
        expect(floaterMesh.parts.some(p => p.material === 'shadowGap')).toBe(true);
        expect(floaterMesh.parts.some(p => p.material === 'railSide')).toBe(true);
        for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
            expect(floaterMesh.parts.some(p => p.material === `canvas${side}`)).toBe(true);
        }
    });

    it('accurately applies mount reveal and maintains identical outer frame dimensions between mounted and unmounted states', () => {
        const classic = frames.find(f => f.prodigiProduct === 'classic');
        const p = getFrameRenderProfile(classic);
        const glazingW = 16;
        const glazingH = 20;
        const mountWidthIn = 2;
        const mountReveal = { topIn: mountWidthIn, sideIn: mountWidthIn, bottomIn: mountWidthIn };

        // 1. Unmounted state: art fills the 16x20 opening
        const unmountedMesh = buildFrameMesh({
            artworkWidthIn: glazingW,
            artworkHeightIn: glazingH,
            ...p,
            matReveal: noMat,
        });

        // 2. Mounted state: frame opening stays 16x20, art opening shrinks to 12x16
        const mountedMesh = buildFrameMesh({
            artworkWidthIn: glazingW - mountWidthIn * 2,
            artworkHeightIn: glazingH - mountWidthIn * 2,
            ...p,
            matReveal: mountReveal,
        });

        // Outer frame dimensions must be IDENTICAL in both states
        expect(mountedMesh.outerWidthM).toBeCloseTo(unmountedMesh.outerWidthM, 5);
        expect(mountedMesh.outerHeightM).toBeCloseTo(unmountedMesh.outerHeightM, 5);
        expect(mountedMesh.outerWidthM).toBeCloseTo((glazingW + 2 * p.mouldingWidthIn) * 0.0254, 5);
        expect(mountedMesh.outerHeightM).toBeCloseTo((glazingH + 2 * p.mouldingWidthIn) * 0.0254, 5);

        // Mounted state contains mat and precision mat bevel
        expect(mountedMesh.parts.some(part => part.material === 'mat')).toBe(true);
        expect(mountedMesh.parts.some(part => part.material === 'matBevel')).toBe(true);

        // Unmounted state has no mat or bevel
        expect(unmountedMesh.parts.some(part => part.material === 'mat')).toBe(false);
        expect(unmountedMesh.parts.some(part => part.material === 'matBevel')).toBe(false);

        // Visible art aperture matches physical dimensions
        const artPart = mountedMesh.parts.find(part => part.material === 'art');
        const artXs = artPart.positions.filter((_, i) => i % 3 === 0);
        const artYs = artPart.positions.filter((_, i) => i % 3 === 1);
        const artWidthM = Math.max(...artXs) - Math.min(...artXs);
        const artHeightM = Math.max(...artYs) - Math.min(...artYs);

        expect(artWidthM).toBeCloseTo((glazingW - mountWidthIn * 2) * 0.0254, 4);
        expect(artHeightM).toBeCloseTo((glazingH - mountWidthIn * 2) * 0.0254, 4);
    });
});

