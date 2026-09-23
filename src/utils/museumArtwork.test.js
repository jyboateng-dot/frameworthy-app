import { describe, expect, it } from 'vitest';
import { normalizeMuseumArtwork, recommendFrameSize } from './museumArtwork';

describe('museum artwork normalization', () => {
    it('recommends an aspect-ratio and resolution-aware frame size', () => {
        const size = recommendFrameSize({ width: 2400, height: 3600 });
        expect(size.orientation).toBe('portrait');
        expect(size.width / size.height).toBeCloseTo(2 / 3, 2);
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
});
