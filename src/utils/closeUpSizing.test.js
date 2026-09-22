import { describe, it, expect } from 'vitest';
import { getCloseUpSize } from './closeUpSizing';

const size = (widthCm, heightCm, viewportWidth = 1000, viewportHeight = 800) => getCloseUpSize({
    widthCm, heightCm, outerWidthCm: widthCm + 4, outerHeightCm: heightCm + 4, viewportWidth, viewportHeight,
});

describe('Close-Up size progression', () => {
    it('grows continuously through square formats including the largest additions', () => {
        for (const viewport of [[1000, 800], [375, 440]]) {
            const widths = [13, 20, 30, 40, 60, 100, 150, 180].map(cm => size(cm, cm, ...viewport).width);
            widths.slice(1).forEach((width, index) => expect(width).toBeGreaterThan(widths[index]));
        }
    });
    it('preserves aspect ratio and identical rotated dimensions', () => {
        for (const [w, h] of [[13, 18], [100, 150], [100, 180], [13, 180], [180, 180]]) {
            const portrait = size(w, h, 375, 440);
            const landscape = size(h, w, 375, 440);
            expect(portrait.width / portrait.height).toBeCloseTo((w + 4) / (h + 4));
            expect(portrait.width).toBeCloseTo(landscape.height);
            expect(portrait.height).toBeCloseTo(landscape.width);
            expect(Math.max(portrait.width, portrait.height)).toBeLessThanOrEqual(375 * 0.85);
        }
    });
    it('keeps the smallest inspectable and gives nearby custom sizes distinct targets', () => {
        expect(size(13, 18).height).toBeCloseTo(720 * 0.6);
        expect(size(180, 180).height).toBeCloseTo(720 * 0.9);
        expect(size(100, 151).height).toBeGreaterThan(size(100, 150).height);
    });
    it('does not return invalid dimensions during layout initialization', () => {
        expect(size(30, 40, 0, 0)).toBeNull();
    });
});
