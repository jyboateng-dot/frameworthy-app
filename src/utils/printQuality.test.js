import { describe, expect, it } from 'vitest';
import {
    buildPrintQualitySpec,
    minimumPrintDpiForFrame,
    MIN_CANVAS_PRINT_DPI,
    MIN_PAPER_PRINT_DPI,
} from './printQuality';

describe('print quality policy', () => {
    it('requires 240 DPI for paper and 150 DPI for canvas', () => {
        expect(minimumPrintDpiForFrame({ prodigiProduct: 'classic' })).toBe(MIN_PAPER_PRINT_DPI);
        expect(minimumPrintDpiForFrame({ prodigiProduct: 'stretched-canvas' })).toBe(MIN_CANVAS_PRINT_DPI);
    });

    it('measures the final crop and rendered output rather than trusting source dimensions alone', () => {
        const spec = buildPrintQualitySpec({
            sourceSize: { w: 9000, h: 6000 },
            geometry: { apertureWidth: 30, apertureHeight: 20 },
            position: { x: 0.5, y: 0.5, zoom: 1 },
            frame: { prodigiProduct: 'classic' },
            outputSize: { w: 4899, h: 3266 },
            assetKind: 'browser-rendered',
        });
        expect(spec.sourceDpi).toBe(300);
        expect(spec.outputDpi).toBeLessThan(240);
        expect(spec.passed).toBe(false);
    });

    it('records a passing original master against the final print aperture', () => {
        const spec = buildPrintQualitySpec({
            sourceSize: { w: 3000, h: 2400 },
            geometry: { apertureWidth: 10, apertureHeight: 8 },
            frame: { prodigiProduct: 'classic' },
            assetUrl: 'https://images.example.com/master.jpg',
        });
        expect(spec).toMatchObject({ passed: true, effectiveDpi: 300, minimumDpi: 240, aiUpscale: null });
    });

    it('qualifies an image meeting the 75 DPI native floor for AI super-resolution up to 300 DPI', () => {
        // 1800x2700 on 24x36 gives 75 native DPI -> AI upscales 4x to 300 DPI
        const spec = buildPrintQualitySpec({
            sourceSize: { w: 1800, h: 2700 },
            geometry: { apertureWidth: 24, apertureHeight: 36 },
            frame: { prodigiProduct: 'classic' },
            assetUrl: 'https://images.example.com/met-masterpiece.jpg',
        });
        expect(spec.passed).toBe(true);
        expect(spec.effectiveDpi).toBe(300);
        expect(spec.aiUpscale).toMatchObject({
            required: true,
            scale: 4,
            nativeDpi: 75,
            targetDpi: 300,
        });
    });

    it('rejects an image below the 75 DPI AI native floor', () => {
        // 1200x1800 on 24x36 gives 50 native DPI -> below 75 DPI floor
        const spec = buildPrintQualitySpec({
            sourceSize: { w: 1200, h: 1800 },
            geometry: { apertureWidth: 24, apertureHeight: 36 },
            frame: { prodigiProduct: 'classic' },
            assetUrl: 'https://images.example.com/lowres.jpg',
        });
        expect(spec.passed).toBe(false);
        expect(spec.effectiveDpi).toBe(50);
        expect(spec.aiUpscale).toBeNull();
    });
});
