import { describe, expect, it } from 'vitest';
import { FRAME_STYLES } from '../data/constants';
import { getFrameExteriorDimensions, getFrameRenderProfile } from './frameRenderProfile';

describe('Prodigi render profiles', () => {
    it('uses the measured fields carried by Prodigi records', () => {
        const frame = FRAME_STYLES.find((item) => item.id === 'prodigi-float-canvas-black');
        const profile = getFrameRenderProfile(frame);

        expect(profile.profile).toBe('floater');
        expect(profile.mouldingWidthIn).toBeCloseTo(12 / 25.4, 8);
        expect(profile.rabbetDepthIn).toBeCloseTo(40 / 25.4, 8);
        expect(profile.totalDepthIn).toBeCloseTo(53 / 25.4, 8);
        expect(profile.openingGapIn).toBeCloseTo(5 / 25.4, 8);
        expect(profile.isMeasured).toBe(true);
    });

    it('includes the float gap and rail in exterior dimensions', () => {
        const frame = FRAME_STYLES.find((item) => item.id === 'prodigi-float-canvas-black');
        const dimensions = getFrameExteriorDimensions(16, 20, frame, 2);
        expect(dimensions.outerWidthIn).toBeCloseTo(16 + (12 + 5) * 2 / 25.4, 8);
        expect(dimensions.outerHeightIn).toBeCloseTo(20 + (12 + 5) * 2 / 25.4, 8);
    });

    it('represents stretched canvas as a rail-free 38 mm body', () => {
        const frame = FRAME_STYLES.find((item) => item.id === 'prodigi-stretched-canvas');
        const profile = getFrameRenderProfile(frame);
        expect(profile.isCanvasOnly).toBe(true);
        expect(profile.canvasThicknessIn).toBeCloseTo(38 / 25.4, 8);
        expect(getFrameExteriorDimensions(16, 20, frame)).toMatchObject({
            outerWidthIn: 16,
            outerHeightIn: 20,
        });
    });

    it('matches every catalogue color name to its Prodigi visual record', () => {
        for (const family of ['canvas-classic', 'canvas-float', 'canvas-eco']) {
            const colors = new Set(FRAME_STYLES.filter((item) => item.prodigiProduct === family).map((item) => item.prodigiColor));
            for (const expected of family === 'canvas-classic'
                ? ['black', 'white', 'natural', 'silver', 'brown', 'gold', 'dark grey', 'light grey']
                : ['black', 'white', 'gold', 'silver', 'natural', 'brown']) {
                expect(colors.has(expected), `${family}: ${expected}`).toBe(true);
            }
        }
    });
});
