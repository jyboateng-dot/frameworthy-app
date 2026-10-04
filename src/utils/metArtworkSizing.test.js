import { describe, expect, it } from 'vitest';
import { getMetRecommendedSize } from './metArtworkSizing';

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
        const tallArtwork = getMetRecommendedSize({ id: 'met_local_9b2yni830' });
        const landscapeArtwork = getMetRecommendedSize({ id: 'met_312231' });

        expect(tallArtwork).toMatchObject({ id: '17x60cm', orientation: 'portrait' });
        expect(landscapeArtwork).toMatchObject({ id: '25x60cm', orientation: 'landscape' });
    });
});
