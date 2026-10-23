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
        const subMinRecord = { id: 'met_313290' }; // 300x451, below 75 native DPI floor
        const tallArtwork = getMetRecommendedSize(tallRecord);
        const landscapeArtwork = getMetRecommendedSize(landscapeRecord);

        expect(tallArtwork.orientation).toBe('portrait');
        expect(landscapeArtwork.orientation).toBe('landscape');
        expect(isMetArtworkPrintable(subMinRecord)).toBe(false);
        expect(isMetArtworkPrintable(tallRecord)).toBe(true);
        expect(doesSizeMeetMinDpi(landscapeArtwork, getMetArtworkPixelSize(landscapeRecord), MIN_PRINT_DPI)).toBe(true);
    });

    it('sorts categories so actual paintings/portraits appear first and artefacts pushed back', async () => {
        const { MET_LOCAL_COLLECTIONS } = await import('../data/metLocal');
        const { MET_PAINTING_PORTRAIT_CATEGORIES } = await import('./metArtworkSizing');
        const sorted = getSortedMetCategories(MET_LOCAL_COLLECTIONS);

        expect(Array.isArray(sorted)).toBe(true);
        expect(sorted.length).toBeGreaterThan(0);

        // First category should be an actual painting/portrait category
        expect(MET_PAINTING_PORTRAIT_CATEGORIES.has(sorted[0])).toBe(true);
        expect(sorted[0]).toBe('European Paintings');

        // All 8 painting & portrait categories must appear before any artefact categories
        const paintingCategories = [...MET_PAINTING_PORTRAIT_CATEGORIES];
        const artefactCategories = [
            'Greek and Roman Art',
            'Arms and Armor',
            'Egyptian Art',
            'Asian Art',
            'European Sculpture and Decorative Arts',
            'Ancient West Asian Art',
            'Musical Instruments',
            'The Costume Institute',
        ];

        for (const painting of paintingCategories) {
            const pIdx = sorted.indexOf(painting);
            expect(pIdx).toBeGreaterThanOrEqual(0);
            for (const artefact of artefactCategories) {
                const aIdx = sorted.indexOf(artefact);
                expect(aIdx).toBeGreaterThanOrEqual(0);
                expect(pIdx).toBeLessThan(aIdx);
            }
        }

        // Within paintings tier, biggest max frame sizes appear first
        expect(sorted.indexOf('European Paintings')).toBeLessThan(sorted.indexOf('Vincent van Gogh'));
        expect(sorted.indexOf('Vincent van Gogh')).toBeLessThan(sorted.indexOf('Claude Monet'));

        // Within artefacts tier, biggest max frame sizes appear first (Asian Art now unlocks 36x48 at 75 native DPI, before Greek and Roman Art)
        expect(sorted.indexOf('Asian Art')).toBeLessThan(sorted.indexOf('Greek and Roman Art'));
    });
});
