import { describe, expect, it } from 'vitest';
import prodigiCatalog from '../data/prodigiCatalog.json';
import { FRAMED_PRINT_SIZES, maxFramePrintSize } from './maxFramePrintSize';

describe('maxFramePrintSize', () => {
    it('matches every Classic/Box framed size in the Prodigi catalogue', () => {
        const catalogue = new Set(prodigiCatalog.products
            .filter((product) => /^(classic|box)/.test(product.family))
            .map((product) => product.sizeInches.replace(/"/g, '')));
        expect(new Set(FRAMED_PRINT_SIZES.map((size) => size.inches))).toEqual(catalogue);
    });

    it('returns the largest matching-aspect size that stays at or above 150 DPI', () => {
        // 3600 x 5400 px = 24 x 36 in at exactly 150 DPI
        const max = maxFramePrintSize({ w: 3600, h: 5400 });
        expect(max).toMatchObject({ inches: '24x36', orientation: 'portrait' });
    });

    it('reports landscape orientation for wide artworks', () => {
        expect(maxFramePrintSize({ w: 5400, h: 3600 })).toMatchObject({ inches: '24x36', orientation: 'landscape' });
    });

    it('prefers square frames for square artworks', () => {
        expect(maxFramePrintSize({ w: 3000, h: 3000 })).toMatchObject({ inches: '20x20', orientation: 'square' });
    });

    it('returns null for unknown or too-small resolutions', () => {
        expect(maxFramePrintSize(null)).toBeNull();
        expect(maxFramePrintSize({ w: 300, h: 400 })).toBeNull();
    });
});
