import { describe, expect, it } from 'vitest';
import { getMetArtworkPixelSize, getMetRecommendedSize, isMetArtworkPrintable, getSortedMetCategories } from './metArtworkSizing';
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

    it('sorts categories so that categories with the biggest max frame sizes appear first', async () => {
        const { MET_LOCAL_COLLECTIONS } = await import('../data/metLocal');
        const sorted = getSortedMetCategories(MET_LOCAL_COLLECTIONS);

        expect(Array.isArray(sorted)).toBe(true);
        expect(sorted.length).toBeGreaterThan(0);

        // Greek and Roman Art has 30x34 max frame size, the largest in the collection
        expect(sorted[0]).toBe('Greek and Roman Art');

        // Asian Art (15x20) and European Paintings (16x16) should appear before categories with smaller max frame sizes like Claude Monet (11.7x16.5)
        expect(sorted.indexOf('Greek and Roman Art')).toBeLessThan(sorted.indexOf('Asian Art'));
        expect(sorted.indexOf('Asian Art')).toBeLessThan(sorted.indexOf('European Paintings'));
        expect(sorted.indexOf('European Paintings')).toBeLessThan(sorted.indexOf('Vincent van Gogh'));
        expect(sorted.indexOf('Vincent van Gogh')).toBeLessThan(sorted.indexOf('Claude Monet'));
    });
});
