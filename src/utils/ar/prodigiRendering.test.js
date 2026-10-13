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
});
