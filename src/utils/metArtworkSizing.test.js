import { describe, expect, it } from 'vitest';
import { getMetArtworkPixelSize, getMetRecommendedSize, isMetArtworkPrintable } from './metArtworkSizing';
import { doesSizeMeetMinDpi, MIN_PRINT_DPI } from './museumArtwork';

describe('Met artwork size recommendations', () => {
    it('uses the Met dimension mapping to resolve the matching frame size', () => {
        const size = getMetRecommendedSize({
            image: 'https://images.metmuseum.org/CRDImages/ep/original/example.jpg',
        });

        expect(size).toMatchObject({ id: '16x20', label: '40 x 50 cm', orientation: 'portrait' });
    });

    it('preserves the artwork orientation when recommending a frame size', () => {
        const size = getMetRecommendedSize({
            image: 'https://images.metmuseum.org/CRDImages/ep/original/example.jpg',
            orientation: 'landscape',
        });

        expect(size).toMatchObject({ id: '16x20', orientation: 'landscape' });
    });

    it('uses measured Met image pixels to fit both the frame ratio and print resolution', () => {
        const tallRecord = { id: 'met_local_9b2yni830' };
        const landscapeRecord = { id: 'met_312231' };
        const tallArtwork = getMetRecommendedSize(tallRecord);
        const landscapeArtwork = getMetRecommendedSize(landscapeRecord);

        expect(tallArtwork.orientation).toBe('portrait');
        expect(landscapeArtwork.orientation).toBe('landscape');
        expect(isMetArtworkPrintable(tallRecord)).toBe(false);
        expect(doesSizeMeetMinDpi(landscapeArtwork, getMetArtworkPixelSize(landscapeRecord), MIN_PRINT_DPI)).toBe(true);
    });
});
