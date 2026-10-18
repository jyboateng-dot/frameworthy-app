import { describe, expect, it } from 'vitest';
import {
    DEFAULT_POSITION,
    frameGeometry,
    imageCrop,
    isDefaultFitPosition,
    maxZoomForMinDpi,
} from './frameFit';

describe('frameFit print quality safeguards', () => {
    it('detects whether fitPosition is at the default untouched center fit', () => {
        expect(isDefaultFitPosition(DEFAULT_POSITION)).toBe(true);
        expect(isDefaultFitPosition({ x: 0.5, y: 0.5, zoom: 1 })).toBe(true);
        expect(isDefaultFitPosition({ x: 0.5005, y: 0.4995, zoom: 1.0005 })).toBe(true);
        expect(isDefaultFitPosition({ x: 0.25, y: 0.5, zoom: 1 })).toBe(false);
        expect(isDefaultFitPosition({ x: 0.5, y: 0.5, zoom: 1.3 })).toBe(false);
    });

    it('caps maxZoomForMinDpi so cropped output never drops below 150 DPI', () => {
        const geometry = frameGeometry({ width: 10, height: 10 }, 'portrait', 'none', 1);
        // 3000x3000px on a 10x10" frame = 300 DPI at zoom 1 -> max zoom for 150 DPI is 2.0
        expect(maxZoomForMinDpi({ w: 3000, h: 3000 }, geometry, 150)).toBeCloseTo(2.0, 2);

        // 1500x1500px on a 10x10" frame = 150 DPI at zoom 1 -> max zoom is 1.0 (cannot zoom in further)
        expect(maxZoomForMinDpi({ w: 1500, h: 1500 }, geometry, 150)).toBeCloseTo(1.0, 2);

        // 6000x6000px on a 10x10" frame = 600 DPI at zoom 1 -> capped at slider ceiling 3
        expect(maxZoomForMinDpi({ w: 6000, h: 6000 }, geometry, 150)).toBe(3);
    });

    it('clamps imageCrop zoom to maxZoomForMinDpi so cropped pixel dimensions stay >= 150 DPI', () => {
        const geometry = frameGeometry({ width: 10, height: 10 }, 'portrait', 'none', 1);
        const crop = imageCrop({ w: 1800, h: 1800 }, geometry, { x: 0.5, y: 0.5, zoom: 2.5 });
        // 10" * 150 DPI = 1500px minimum crop dimension
        expect(crop.w).toBeGreaterThanOrEqual(1500);
        expect(crop.h).toBeGreaterThanOrEqual(1500);
    });
});
