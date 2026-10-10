import { describe, it, expect } from 'vitest';
import prodigiCatalog from './prodigiCatalog.json';
import { FRAME_STYLES, FRAME_SIZES } from './constants';
import { findProdigiSku, isProdigiOrderable } from './prodigiSku';

const frame = (id) => FRAME_STYLES.find((item) => item.id === id);
const size = (id) => FRAME_SIZES.find((item) => item.id === id);
const { products } = prodigiCatalog;

describe('findProdigiSku', () => {
    it('maps a box frame and size to the unmounted box SKU', () => {
        expect(findProdigiSku(products, frame('prodigi-box-black'), size('8x10'), 'GB'))
            .toEqual({ sku: 'GLOBAL-BOX-8X10', attributes: { color: 'black' }, sizeInches: '8x10"' });
    });

    it('matches A4 to the sheet’s rounded 8.3x11.7" size', () => {
        expect(findProdigiSku(products, frame('prodigi-box-white'), size('a4'), 'JE')?.sizeInches).toBe('8.3x11.7"');
    });

    it('translates picker colours and adds the canvas wrap', () => {
        const result = findProdigiSku(products, frame('prodigi-float-canvas-antique-gold'), size('16x20'), 'GB');
        expect(result.attributes).toEqual({ color: 'gold', wrap: 'Black' });
        expect(result.sku).toMatch(/16X20/);
    });

    it('returns null for a size Prodigi does not make', () => {
        expect(findProdigiSku(products, frame('prodigi-box-black'), { width: 7, height: 9 }, 'GB')).toBeNull();
    });

    it('keeps Classic and Aluminium framed prints unorderable until they are in the price sheet', () => {
        expect(isProdigiOrderable(frame('prodigi-classic-black'))).toBe(false);
        expect(isProdigiOrderable(frame('prodigi-aluminium-black'))).toBe(false);
        expect(findProdigiSku(products, frame('prodigi-classic-black'), size('8x10'), 'GB')).toBeNull();
    });

    it('finds a SKU for every orderable frame in at least one standard size', () => {
        for (const item of FRAME_STYLES.filter(isProdigiOrderable)) {
            const hits = FRAME_SIZES.filter((s) => findProdigiSku(products, item, s, 'GB'));
            expect(hits.length, item.id).toBeGreaterThan(0);
        }
    });
});
