import { describe, expect, it } from 'vitest';
import {
    MIN_PRINT_DPI,
    doesSizeMeetMinDpi,
    isArtworkPrintableAtMinDpi,
    normalizeMuseumArtwork,
    recommendFrameSize,
} from './museumArtwork';

describe('museum artwork normalization', () => {
    it('recommends an aspect-ratio and resolution-aware frame size', () => {
        const size = recommendFrameSize({ width: 4800, height: 7200 });
        expect(size.orientation).toBe('portrait');
        expect(size.width / size.height).toBeCloseTo(2 / 3, 2);
    });

    it('enforces the 240 DPI paper floor on recommended sizes and printability checks', () => {
        expect(MIN_PRINT_DPI).toBe(240);
        // 2400x3360 supports up to 10x14 at 240 DPI, so 11x14 must be rejected.
        expect(doesSizeMeetMinDpi({ width: 8, height: 10 }, { width: 2400, height: 3360 })).toBe(true);
        expect(doesSizeMeetMinDpi({ width: 11, height: 14 }, { width: 2400, height: 3360 })).toBe(false);

        const rec = recommendFrameSize({ width: 2400, height: 3360 });
        expect(Math.min(rec.width, rec.height) * 240).toBeLessThanOrEqual(2400);
        expect(Math.max(rec.width, rec.height) * 240).toBeLessThanOrEqual(3360);

        // Smallest 5x7 frame requires 1200x1680 at 240 DPI.
        expect(isArtworkPrintableAtMinDpi({ width: 1200, height: 1680 })).toBe(true);
        expect(isArtworkPrintableAtMinDpi({ width: 1199, height: 1680 })).toBe(false);
        expect(isArtworkPrintableAtMinDpi({ width: 1280, height: 1600 })).toBe(false);
    });

    it('preserves source metadata while normalizing display fields', () => {
        const artwork = normalizeMuseumArtwork({
            id: 42,
            title: 'A Study',
            artist_display: 'A. Painter',
            image: 'https://example.test/image.jpg',
            width: 1000,
            height: 1000,
            rights: 'CC0',
        }, { id: 'example', name: 'Example Museum' });
        expect(artwork.id).toBe('example:42');
        expect(artwork.artist).toBe('A. Painter');
        expect(artwork.rights).toBe('CC0');
        expect(artwork.recommendedSize).toBeTruthy();
    });

    it('prioritizes print dimensions over web preview dimensions for Cleveland records', () => {
        const artwork = normalizeMuseumArtwork({
            id: 94979,
            title: 'Nathaniel Hurd',
            images: {
                web: { url: 'https://example.test/web.jpg', width: '748', height: '893' },
                print: { url: 'https://example.test/print.jpg', width: '2849', height: '3400' },
            },
        }, { id: 'cleveland-museum-of-art', name: 'Cleveland Museum of Art' });
        expect(artwork.imageWidth).toBe(2849);
        expect(artwork.imageHeight).toBe(3400);
        expect(artwork.fullRes).toBe('https://example.test/print.jpg');
    });
});

