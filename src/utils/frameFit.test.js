import { expect, it } from 'vitest';
import { frameGeometry, imageCrop } from './frameFit';

it('keeps equal mat borders and aperture dimensions in physical units', () => {
    const g = frameGeometry({ width: 8, height: 10 }, 'landscape', 1, 0.5);
    expect([g.width, g.height, g.apertureWidth, g.apertureHeight, g.outerWidth]).toEqual([10, 8, 8, 6, 11]);
});
it('keeps zoomed crops within the image at either position limit', () => {
    const g = frameGeometry({ width: 8, height: 10 }, 'portrait', 1);
    for (const x of [0, 0.5, 1]) for (const y of [0, 0.5, 1]) {
        const crop = imageCrop({ w: 2000, h: 1000 }, g, { x, y, zoom: 2 });
        expect(crop.w / crop.h).toBeCloseTo(6 / 8);
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.w).toBeLessThanOrEqual(2000);
        expect(crop.y + crop.h).toBeLessThanOrEqual(1000);
    }
});
it('rejects collapsed openings', () => {
    expect(imageCrop({ w: 100, h: 100 }, frameGeometry({ width: 8, height: 10 }, 'portrait', 5))).toBeNull();
});
