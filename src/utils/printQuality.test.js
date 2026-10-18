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
        expect(spec).toMatchObject({ passed: true, effectiveDpi: 300, minimumDpi: 240 });
    });
});
