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

    it('returns the largest matching-aspect size at default paper print DPI (240)', () => {
        // At 240 DPI: 5760 x 8640 px = 24 x 36 in
        const max = maxFramePrintSize({ w: 5760, h: 8640 });
        expect(max).toMatchObject({ inches: '24x36', orientation: 'portrait' });
    });

    it('honours custom minDpi when specified (e.g. 150 DPI)', () => {
        // 3600 x 5400 px = 24 x 36 in at 150 DPI
        const max = maxFramePrintSize({ w: 3600, h: 5400 }, 150);
        expect(max).toMatchObject({ inches: '24x36', orientation: 'portrait' });
    });

    it('reports landscape orientation for wide artworks', () => {
        expect(maxFramePrintSize({ w: 8640, h: 5760 })).toMatchObject({ inches: '24x36', orientation: 'landscape' });
    });

    it('prefers square frames for square artworks', () => {
        // At 240 DPI: 4800 x 4800 px = 20 x 20 in
        expect(maxFramePrintSize({ w: 4800, h: 4800 })).toMatchObject({ inches: '20x20', orientation: 'square' });
    });

    it('returns null for unknown or too-small resolutions', () => {
        expect(maxFramePrintSize(null)).toBeNull();
        expect(maxFramePrintSize({ w: 300, h: 400 })).toBeNull();
    });
});
