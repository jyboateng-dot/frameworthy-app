import { describe, expect, it } from 'vitest';
import { bestFitOptions } from './bestFitOptions';
import { FRAME_SIZES, FRAME_STYLES } from '../data/constants';
import {
    prodigiAvailableSizes,
    prodigiConfigurationFromSelection,
    resolveProdigiProduct,
} from './prodigiFlow';

describe('bestFitOptions', () => {
    const natural = { w: 3000, h: 2000 }; // 3:2 landscape photo

    it('returns valid alternative fits for a standard frame from FRAME_SIZES', () => {
        const frame = FRAME_STYLES.find(f => f.id === 'modern-black');
        const size = FRAME_SIZES.find(s => s.id === '8x10');
        const options = bestFitOptions({
            sizes: FRAME_SIZES,
            natural,
            size,
            orientation: 'portrait',
            mat: '1.5',
            rail: 0.75,
            frame,
            price: 250,
            matPrice: 75,
        });

        expect(options.length).toBeGreaterThan(0);
        expect(options.length).toBeLessThanOrEqual(3);
        for (const option of options) {
            expect(option.retained).toBeGreaterThan(0);
            expect(option.retained).toBeLessThanOrEqual(1);
            expect(Number.isFinite(option.price)).toBe(true);
            expect(FRAME_SIZES.some(s => s.id === option.size.id)).toBe(true);
        }
    });

    it('ensures every best fit option for a Prodigi frame matches a valid, orderable Prodigi SKU', () => {
        const prodigiFrames = [
            FRAME_STYLES.find(f => f.id === 'prodigi-aluminium-black'),
            FRAME_STYLES.find(f => f.id === 'prodigi-box-black'),
            FRAME_STYLES.find(f => f.id === 'prodigi-classic-black'),
            FRAME_STYLES.find(f => f.id === 'prodigi-stretched-canvas'),
        ];

        for (const frame of prodigiFrames) {
            const config = prodigiConfigurationFromSelection(null);
            const sizes = prodigiAvailableSizes(frame, config);
            const initialSize = sizes[0];

            const options = bestFitOptions({
                sizes,
                natural,
                size: initialSize,
                orientation: 'portrait',
                mat: 'none',
                rail: 0.75,
                frame,
                price: 45,
                matPrice: 0,
                prodigiConfiguration: config,
            });

            expect(options.length).toBeGreaterThan(0);
            for (const option of options) {
                // Must be an orderable product SKU in the catalogue
                const resolved = resolveProdigiProduct(frame, option.size, {
                    ...config,
                    mounted: option.mat !== 'none',
                });
                expect(resolved).toBeTruthy();
                expect(resolved?.sku).toBeDefined();

                // Aluminium and Canvas frames must never be offered with a mat
                if (['aluminium', 'stretched-canvas'].includes(frame.prodigiProduct) || frame.id.includes('canvas')) {
                    expect(option.mat).toBe('none');
                }
            }
        }
    });

    it('uses the exact Prodigi mount width tier for mounted Prodigi options', () => {
        const classic = FRAME_STYLES.find(f => f.id === 'prodigi-classic-black');
        const config = prodigiConfigurationFromSelection({ attributes: { mount: '2.4mm', mountColor: 'Snow white' } });
        const sizes = prodigiAvailableSizes(classic, config);
        const size = sizes.find(s => s.prodigiSizeInches === '8x10"') || sizes[0];

        const options = bestFitOptions({
            sizes,
            natural,
            size,
            orientation: 'portrait',
            mat: '1.5',
            rail: 0.8,
            frame: classic,
            price: 50,
            matPrice: 0,
            prodigiConfiguration: config,
        });

        for (const option of options) {
            if (option.mat !== 'none') {
                const resolved = resolveProdigiProduct(classic, option.size, { ...config, mounted: true });
                expect(resolved).toBeTruthy();
                // Prodigi mount widths are strictly 1, 1.5, 2, or 3 inches
                expect(['1', '1.5', '2', '3']).toContain(option.mat);
            }
        }
    });
});
