import { describe, expect, it } from 'vitest';
import catalogue from './prodigiCatalog.json';

describe('Prodigi catalogue snapshot', () => {
    it('includes the box-frame and framed-canvas lines planned for the Jersey and UK markets', () => {
        const families = new Set(catalogue.products.map((product) => product.family));
        expect(families).toEqual(new Set([
            'classic',
            'classic-mounted',
            'classic-float',
            'classic-mounted-float',
            'classic-motheye',
            'classic-mounted-motheye',
            'box',
            'box-mounted',
            'box-float',
            'box-mounted-float',
            'box-motheye',
            'box-mounted-motheye',
            'aluminium',
            'canvas-float',
            'canvas-classic',
            'canvas-eco',
            'stretched-canvas',
        ]));
    });

    it('has positive GBP item and standard-shipping prices for both destinations', () => {
        expect(catalogue.products.length).toBeGreaterThan(1000);
        for (const product of catalogue.products) {
            expect(product.sizeInches).toBeTruthy();
            if (product.family !== 'stretched-canvas') expect(product.options.color).toBeTruthy();
            for (const market of ['GB', 'JE']) {
                if (!product.markets[market]) continue;
                expect(['GBP', 'EUR', 'USD']).toContain(product.markets[market]?.productCurrency);
                expect(product.markets[market]?.shippingCurrency).toBe(product.markets[market]?.productCurrency);
                expect(product.markets[market]?.productPrice).toBeGreaterThan(0);
                expect(product.markets[market]?.shippingPrice).toBeGreaterThanOrEqual(0);
                expect(product.markets[market]?.shippingMethod).toBe('Standard');
            }
        }
        expect(catalogue.products.some((product) => product.markets.JE && product.markets.GB)).toBe(true);
        expect(catalogue.products.every((product) => product.markets.JE && product.markets.GB)).toBe(true);
    });

    it('keeps mount and edge options faithful to the source rows', () => {
        const classic = catalogue.products.find((product) => product.sku === 'GLOBAL-CFP-18X24');
        const aluminium = catalogue.products.find((product) => product.sku === 'GLOBAL-FRA-ALU-8X10');
        const mountedBox = catalogue.products.find((product) => product.sku === 'GLOBAL-BOXM-12X16');
        const floatCanvas = catalogue.products.find((product) => product.sku === 'GLOBAL-FRA-CAN-12X18');
        const ecoCanvas = catalogue.products.find((product) => product.sku === 'ECO-FRA-CAN-12X12');
        const stretchedCanvas = catalogue.products.find((product) => product.sku === 'GLOBAL-CAN-12X16' && product.options.wrap === 'ImageWrap');

        expect(classic).toMatchObject({ family: 'classic', frame: 'Classic' });
        expect(aluminium).toMatchObject({ family: 'aluminium', frame: 'Aluminium' });
        expect(mountedBox.options).toMatchObject({ mount: '2.4mm', mountColor: 'Snow white' });
        expect(floatCanvas.options.wrap).toBeTruthy();
        expect(ecoCanvas.options.substrateWeight).toBe('330gsm');
        expect(stretchedCanvas).toMatchObject({ family: 'stretched-canvas', frame: '38mm standard stretcher bar' });
        expect(stretchedCanvas.markets).toHaveProperty('GB');
        expect(stretchedCanvas.markets).toHaveProperty('JE');
        expect(stretchedCanvas.options.wrap).toBe('ImageWrap');
        expect(catalogue.products.some((product) => product.family === 'stretched-canvas' && /19mm/i.test(product.frame))).toBe(false);
    });

    it('contains the complete GB and JE aluminium range', () => {
        const aluminium = catalogue.products.filter((product) => product.family === 'aluminium');
        const skus = [...new Set(aluminium.map((product) => product.sku))].sort();

        expect(skus).toEqual([
            'GLOBAL-FRA-ALU-10X10',
            'GLOBAL-FRA-ALU-18X24',
            'GLOBAL-FRA-ALU-20X20',
            'GLOBAL-FRA-ALU-24X36',
            'GLOBAL-FRA-ALU-8X10',
        ]);
        expect(aluminium).toHaveLength(15);

        for (const sku of skus) {
            const variants = aluminium.filter((product) => product.sku === sku);
            expect(variants.map((product) => product.options.color).sort(), sku).toEqual(['black', 'gold', 'silver']);
            for (const product of variants) {
                expect(product).toMatchObject({
                    frame: 'Aluminium',
                    options: {
                        glaze: 'Acrylic / Perspex',
                        mount: 'No mount / Mat',
                        paper: 'EMA',
                        substrateWeight: '200gsm',
                    },
                });
                expect(Object.keys(product.markets).sort(), `${sku} · ${product.options.color}`).toEqual(['GB', 'JE']);
            }
        }
    });

    it('does not expose the retired wrapped-canvas SKU family', () => {
        expect(catalogue.products.some((product) => /CAN-WRAP/i.test(product.sku))).toBe(false);
    });

    it('does not fold print-free backloader frames into the classic print range', () => {
        expect(catalogue.products.some((product) => /BACKLOADER/i.test(product.sku))).toBe(false);
    });
});
