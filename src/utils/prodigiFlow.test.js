import { describe, expect, it } from 'vitest';
import { FRAME_STYLES } from '../data/constants';
import {
    isProdigiConfigurationAvailable,
    prodigiAvailableSizes,
    prodigiConfigurationFromSelection,
    prodigiHangingHardware,
    prodigiMountWidthInForSize,
    prodigiMountWidthMmForSize,
    formatProdigiMountWidth,
    prodigiBaseProductForProduct,
    resolveProdigiProduct,
} from './prodigiFlow';

describe('Prodigi Frame Studio flow', () => {
    const box = FRAME_STYLES.find((frame) => frame.id === 'prodigi-box-black');
    const classic = FRAME_STYLES.find((frame) => frame.id === 'prodigi-classic-black');
    const stretched = FRAME_STYLES.find((frame) => frame.id === 'prodigi-stretched-canvas');

    it('resolves a supported box frame size and configuration to the exact supplier family', () => {
        const size = prodigiAvailableSizes(box).find((item) => item.prodigiSizeInches === '8x10"');
        const product = resolveProdigiProduct(box, size, { mounted: true, glaze: 'Motheye' });
        expect(product.family).toBe('box-mounted-motheye');
        expect(product.options.color).toBe('black');
        expect(product.sku).toContain('BOXM-MOTH');
    });

    it('keeps unavailable Motheye combinations out of the active flow', () => {
        const a5 = prodigiAvailableSizes(box).find((item) => item.prodigiSizeCm.replaceAll(' ', '') === '14.8x21cm');
        expect(isProdigiConfigurationAvailable(box, a5, { mounted: false, glaze: 'Motheye' })).toBe(false);
        expect(isProdigiConfigurationAvailable(box, a5, { mounted: false, glaze: 'Acrylic / Perspex' })).toBe(true);
    });

    it('changes the box-frame size list with the selected supplier configuration', () => {
        const acrylicSizes = prodigiAvailableSizes(box, { mounted: false, glaze: 'Acrylic / Perspex' });
        const motheyeSizes = prodigiAvailableSizes(box, { mounted: false, glaze: 'Motheye' });

        expect(motheyeSizes.length).toBeLessThan(acrylicSizes.length);
        expect(motheyeSizes.every((size) =>
            resolveProdigiProduct(box, size, { mounted: false, glaze: 'Motheye' })?.family === 'box-motheye'
        )).toBe(true);
    });

    it('resolves classic frame sizes across mount and Motheye SKU families', () => {
        const size = prodigiAvailableSizes(classic, { mounted: false, glaze: 'Motheye' })
            .find((item) => item.prodigiSizeInches === '8x10"');
        const noMount = resolveProdigiProduct(classic, size, { mounted: false, glaze: 'Motheye' });
        const mounted = resolveProdigiProduct(classic, size, { mounted: true, glaze: 'Motheye' });

        expect(noMount).toMatchObject({ family: 'classic-motheye', sku: 'GLOBAL-CFP-MOTH-8X10' });
        expect(mounted).toMatchObject({ family: 'classic-mounted-motheye', sku: 'GLOBAL-CFPM-MOTH-8X10' });
        expect(prodigiBaseProductForProduct(mounted, 'GB')).toMatchObject({ family: 'classic', sku: 'GLOBAL-CFP-8X10' });
    });

    it('resolves real GB/JE float-glass SKUs for Classic and Box frames', () => {
        const cases = [
            { frame: classic, unmountedSku: 'FRA-CLA-EMA-NM-GLA-28x35', mountedSku: 'FRA-CLA-EMA-MOUNT2-GLA-28x35' },
            { frame: box, unmountedSku: 'FRA-BOX-EMA-NM-GLA-28x35', mountedSku: 'FRA-BOX-EMA-MOUNT2-GLA-28x35' },
        ];

        for (const item of cases) {
            const size = prodigiAvailableSizes(item.frame, { mounted: false, glaze: 'Acrylic / Perspex' })
                .find((candidate) => candidate.prodigiSizeInches === '11x14"');
            expect(resolveProdigiProduct(item.frame, size, { mounted: false, glaze: 'Float glass' }))
                .toMatchObject({ sku: item.unmountedSku, options: { glaze: 'Float glass' } });
            expect(resolveProdigiProduct(item.frame, size, { mounted: true, mountColor: 'Black', glaze: 'Float glass' }))
                .toMatchObject({ sku: item.mountedSku, options: { glaze: 'Float glass', mountColor: 'Black' } });
            expect(prodigiBaseProductForProduct(resolveProdigiProduct(item.frame, size, { mounted: true, glaze: 'Float glass' }), 'GB'))
                .toMatchObject({ family: item.frame === classic ? 'classic' : 'box', options: { glaze: 'Acrylic / Perspex', mount: 'No mount / Mat' } });
        }
    });

    it('maps centimetre-labelled glass products to the equivalent base frame size', () => {
        const size = prodigiAvailableSizes(classic, { mounted: false, glaze: 'Float glass' })
            .find((candidate) => candidate.prodigiSizeCm === '29x42cm');
        const glassProduct = resolveProdigiProduct(classic, size, { mounted: false, glaze: 'Float glass' });
        expect(glassProduct.sku).toBe('FRA-CLA-EMA-NM-GLA-29x42');
        expect(prodigiBaseProductForProduct(glassProduct, 'GB').sku).toBe('GLOBAL-CFP-A3');
    });

    it('uses each Classic and Box mounted SKU with every supported mountColor attribute', () => {
        const families = [
            { frame: classic, expectedSku: 'GLOBAL-CFPM-11X14' },
            { frame: box, expectedSku: 'GLOBAL-BOXM-11X14' },
        ];

        for (const { frame, expectedSku } of families) {
            const size = prodigiAvailableSizes(frame, { mounted: true, glaze: 'Acrylic / Perspex' })
                .find((item) => item.prodigiSizeInches === '11x14"');
            for (const mountColor of ['Snow white', 'Off-white', 'Black']) {
                const product = resolveProdigiProduct(frame, size, { mounted: true, mountColor, glaze: 'Acrylic / Perspex' });
                expect(product.sku).toBe(expectedSku);
                expect(product.options.mountColor).toBe(mountColor);
            }
        }
    });

    it('uses the supplier mount width tier for each glazing size', () => {
        expect(prodigiMountWidthInForSize({ width: 10, height: 10 })).toBe(1);
        expect(prodigiMountWidthInForSize({ width: 8, height: 12 })).toBe(1.5);
        expect(prodigiMountWidthInForSize({ width: 11, height: 14 })).toBe(1.5);
        expect(prodigiMountWidthInForSize({ width: 12, height: 16 })).toBe(2);
        expect(prodigiMountWidthInForSize({ width: 12, height: 14 }, { sku: 'FRA-CLA-CPWP-3M-ACRY-30X35' })).toBe(3);

        // Exact millimetre values per manufacturer spec without decimal places
        expect(prodigiMountWidthMmForSize({ width: 10, height: 10 })).toBe(25);
        expect(prodigiMountWidthMmForSize({ width: 8, height: 12 })).toBe(38);
        expect(prodigiMountWidthMmForSize({ width: 11, height: 14 })).toBe(38);
        expect(prodigiMountWidthMmForSize({ width: 12, height: 16 })).toBe(50);
        expect(prodigiMountWidthMmForSize({ width: 12, height: 14 }, { sku: 'FRA-CLA-CPWP-3M-ACRY-30X35' })).toBe(75);

        // Format label respecting active unit
        expect(formatProdigiMountWidth({ width: 10, height: 10 }, null, 'cm')).toBe('25 mm');
        expect(formatProdigiMountWidth({ width: 10, height: 10 }, null, 'in')).toBe('1"');
        expect(formatProdigiMountWidth({ width: 11, height: 14 }, null, 'cm')).toBe('38 mm');
        expect(formatProdigiMountWidth({ width: 11, height: 14 }, null, 'in')).toBe('1.5"');
        expect(formatProdigiMountWidth({ width: 16, height: 20 }, null, 'cm')).toBe('50 mm');
        expect(formatProdigiMountWidth({ width: 16, height: 20 }, null, 'in')).toBe('2"');
    });

    it('offers only real stretched-canvas sizes and resolves an edge finish', () => {
        const sizes = prodigiAvailableSizes(stretched);
        const product = resolveProdigiProduct(stretched, sizes[0], { wrap: 'ImageWrap' });
        expect(sizes.length).toBeGreaterThan(10);
        expect(product.family).toBe('stretched-canvas');
        expect(product.options.wrap).toBe('ImageWrap');
    });

    it('never exposes a size without a matching SKU for any imported frame finish', () => {
        const prodigiFrames = FRAME_STYLES.filter((frame) => frame.prodigiProduct);

        for (const frame of prodigiFrames) {
            const configuration = prodigiConfigurationFromSelection(null);
            const sizes = prodigiAvailableSizes(frame, configuration);

            expect(sizes.length, frame.id).toBeGreaterThan(0);
            for (const size of sizes) {
                const product = resolveProdigiProduct(frame, size, configuration);
                expect(product?.sku, `${frame.id} · ${size.label}`).toBeTruthy();
                expect(product?.family, `${frame.id} · ${size.label}`).toBe(
                    frame.prodigiProduct === 'box' ? 'box' : frame.prodigiProduct
                );
                if (frame.prodigiColor) expect(product?.options.color).toBe(frame.prodigiColor);
            }
        }
    });

    it('only exposes sizes with an orderable SKU in the selected GB or JE market', () => {
        const prodigiFrames = FRAME_STYLES.filter((frame) => frame.prodigiProduct);

        for (const destinationCountryCode of ['GB', 'JE']) {
            for (const frame of prodigiFrames) {
                const configuration = {
                    ...prodigiConfigurationFromSelection(null),
                    destinationCountryCode,
                };
                const sizes = prodigiAvailableSizes(frame, configuration);

                expect(sizes.length, `${destinationCountryCode} · ${frame.id}`).toBeGreaterThan(0);
                for (const size of sizes) {
                    const product = resolveProdigiProduct(frame, size, configuration);
                    expect(product?.sku, `${destinationCountryCode} · ${frame.id} · ${size.label}`).toBeTruthy();
                    expect(product?.markets?.[destinationCountryCode], `${destinationCountryCode} · ${product?.sku}`).toBeTruthy();
                }
            }
        }
    });

    it('shows the supplied hanging hardware for each product family and size', () => {
        const aluminium = FRAME_STYLES.find((frame) => frame.id === 'prodigi-aluminium-black');
        const floatCanvas = FRAME_STYLES.find((frame) => frame.id === 'prodigi-float-canvas-black');

        expect(prodigiHangingHardware(classic, { width: 20, height: 30 })).toMatchObject({ id: 'cobra-hook', included: true });
        expect(prodigiHangingHardware(box, { width: 30, height: 45 })).toMatchObject({ id: 'sawtooth', included: true });
        expect(prodigiHangingHardware(aluminium, { width: 24, height: 36 })).toMatchObject({ id: 'built-in-rear-hanger', included: true });
        expect(prodigiHangingHardware(floatCanvas, { width: 24, height: 36 })).toMatchObject({ id: 'none', included: false });
        expect(prodigiHangingHardware(stretched, { width: 24, height: 36 })).toMatchObject({ id: 'none', included: false });
    });
});
