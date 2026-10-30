import { describe, expect, it } from 'vitest';
import { isFramableMuseumArtwork } from './museumCollectionPolicy';

describe('museum collection policy', () => {
    const image = 'https://example.test/art.jpg';

    it('accepts any museum collection record with an image without medium exclusions', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', { image, classification: 'Painting' })).toBe(true);
        expect(isFramableMuseumArtwork('national-gallery-of-art', { image, classification: 'Photograph' })).toBe(true);
        expect(isFramableMuseumArtwork('national-gallery-of-art', { image, classification: 'Sculpture' })).toBe(true);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', { image, type: 'Drawing' })).toBe(true);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', { image, type: 'Sculpture' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Estampe' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Mobilier' })).toBe(true);
    });

    it('accepts records with fullRes even if image preview property is empty', () => {
        expect(isFramableMuseumArtwork('smithsonian-open-access', { fullRes: 'https://example.test/full.jpg' })).toBe(true);
    });

    it('rejects records without a usable image', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', { classification: 'Painting' })).toBe(false);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', null)).toBe(false);
        expect(isFramableMuseumArtwork('paris-musees', {})).toBe(false);
    });

    it('keeps all archival feeds with images without exclusions', () => {
        expect(isFramableMuseumArtwork('nasa-open-media', { image })).toBe(true);
        expect(isFramableMuseumArtwork('library-of-congress', { image })).toBe(true);
        expect(isFramableMuseumArtwork('biodiversity-heritage-library', { image })).toBe(true);
    });
});
