import { describe, it, expect } from 'vitest';
import {
    computePrintDimensions,
    capToCloudinaryLimit,
    needsHiResEscalation,
    buildCappedIntermediateUrl
} from '../hiResPrintFile.js';

describe('computePrintDimensions', () => {
    it('computes 300 DPI pixel dimensions, keeping width < height for portrait', () => {
        expect(computePrintDimensions({ width: 8, height: 10 }, 'portrait')).toEqual({ finalW: 2400, finalH: 3000 });
    });

    it('swaps width/height for landscape', () => {
        expect(computePrintDimensions({ width: 8, height: 10 }, 'landscape')).toEqual({ finalW: 3000, finalH: 2400 });
    });
});

describe('capToCloudinaryLimit', () => {
    it('leaves dimensions under the cap untouched', () => {
        expect(capToCloudinaryLimit(2400, 3000)).toEqual({ cappedW: 2400, cappedH: 3000, wasCapped: false });
    });

    it('scales dimensions over the cap down, preserving aspect ratio', () => {
        // 7200x10800 = 77.76MP, over the 24.9M cap
        const result = capToCloudinaryLimit(7200, 10800);
        expect(result.wasCapped).toBe(true);
        expect(result.cappedW * result.cappedH).toBeLessThanOrEqual(24_900_000);
        // aspect ratio preserved (within rounding from the floor)
        expect(result.cappedW / result.cappedH).toBeCloseTo(7200 / 10800, 2);
    });
});

describe('needsHiResEscalation', () => {
    it('is false when selectedSize is missing', () => {
        expect(needsHiResEscalation({})).toBe(false);
        expect(needsHiResEscalation({ selectedSize: {} })).toBe(false);
    });

    it('is false for sizes Cloudinary already delivers at full 300 DPI', () => {
        expect(needsHiResEscalation({ selectedSize: { width: 8, height: 10 }, orientation: 'portrait' })).toBe(false);
    });

    it('is false for large sizes whose capped DPI still stays above the floor', () => {
        // 24x36in caps to ~170 DPI (see storage.test.js) — above the 150 floor
        expect(needsHiResEscalation({ selectedSize: { width: 24, height: 36 }, orientation: 'portrait' })).toBe(false);
    });

    it('is true for very large sizes whose capped DPI drops below the floor', () => {
        // 48x48in caps to ~104 DPI — below the 150 floor
        expect(needsHiResEscalation({ selectedSize: { width: 48, height: 48 }, orientation: 'portrait' })).toBe(true);
    });
});

describe('buildCappedIntermediateUrl', () => {
    it('inserts the gated e_upscale steps and capped dimensions before the upload public_id', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        expect(buildCappedIntermediateUrl(url, 4074, 6111)).toBe(
            'https://res.cloudinary.com/demo/image/upload/if_iw_lt_2000_and_ih_lt_2000/if_iw_lt_4074_or_ih_lt_6111/e_upscale/if_end/if_end/w_4074,h_6111,c_fill,g_auto,e_improve/f_jpg,q_90/v1/photo.jpg'
        );
    });
});
