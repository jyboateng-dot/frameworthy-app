import { describe, expect, it } from 'vitest';
import { isFramableMuseumArtwork } from './museumCollectionPolicy';

describe('museum collection policy', () => {
    const image = 'https://example.test/art.jpg';

    it('keeps paintings, drawings, and prints with images', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', { image, classification: 'Painting' })).toBe(true);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', { image, type: 'Drawing' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Estampe' })).toBe(true);
    });

    it('rejects photographic portraits and non-art objects', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', { image, classification: 'Photograph', title: 'Portrait' })).toBe(false);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', { image, type: 'Sculpture', medium: 'Oil paint' })).toBe(false);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Mobilier' })).toBe(false);
    });

    it('requires a usable image', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', { classification: 'Painting' })).toBe(false);
    });

    it('rejects records whose known pixel dimensions cannot support 5x7 at 75 native DPI (< 375x525)', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', {
            image,
            classification: 'Painting',
            width: 250,
            height: 300,
        })).toBe(false);
        expect(isFramableMuseumArtwork('national-gallery-of-art', {
            image,
            classification: 'Painting',
            width: 600,
            height: 900,
        })).toBe(true);
    });
});

