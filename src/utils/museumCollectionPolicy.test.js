import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFramableMuseumArtwork } from './museumCollectionPolicy';

describe('museum collection policy', () => {
    const image = 'https://example.test/art.jpg';

    it('keeps paintings, drawings, and prints with images', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', { image, classification: 'Painting' })).toBe(true);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', { image, type: 'Drawing' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Estampe' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Pastel' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Gouache' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Gravure' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Lithographie' })).toBe(true);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Dessin, Arts graphiques' })).toBe(true);
    });

    it('rejects photographic portraits and 3D non-art objects / artefacts', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', { image, classification: 'Photograph', title: 'Portrait' })).toBe(false);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', { image, type: 'Sculpture', medium: 'Oil paint' })).toBe(false);
        expect(isFramableMuseumArtwork('paris-musees', { image, objectType: 'Mobilier' })).toBe(false);
    });

    it('accepts records with fullRes even if image preview property is empty', () => {
        expect(isFramableMuseumArtwork('smithsonian-open-access', { fullRes: 'https://example.test/full.jpg', objectType: 'Painting' })).toBe(true);
    });

    it('accepts pre-curated snapshot and live feed records for Paris Musées, Art Institute, Smithsonian, and Cleveland', () => {
        expect(isFramableMuseumArtwork('paris-musees', {
            image,
            rights: 'CC0 / Paris Musées Open Content',
            sourceUrl: 'https://www.parismuseescollections.paris.fr/',
        })).toBe(true);
        expect(isFramableMuseumArtwork('art-institute-of-chicago', {
            image,
            artworkType: 'Artwork',
            rights: 'Public domain / Art Institute of Chicago',
        })).toBe(true);
        expect(isFramableMuseumArtwork('smithsonian-open-access', {
            image,
            artworkType: 'Artwork',
            rights: 'CC0 / Smithsonian Open Access',
        })).toBe(true);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', {
            image,
            artworkType: 'Painting',
            rights: 'CC0 / Cleveland Museum of Art',
        })).toBe(true);
    });

    it('requires a usable image', () => {
        expect(isFramableMuseumArtwork('national-gallery-of-art', { classification: 'Painting' })).toBe(false);
        expect(isFramableMuseumArtwork('cleveland-museum-of-art', null)).toBe(false);
        expect(isFramableMuseumArtwork('paris-musees', {})).toBe(false);
    });

    it('keeps archival feeds with images', () => {
        expect(isFramableMuseumArtwork('nasa-open-media', { image })).toBe(true);
        expect(isFramableMuseumArtwork('library-of-congress', { image })).toBe(true);
        expect(isFramableMuseumArtwork('biodiversity-heritage-library', { image, title: 'Botanical Drawing' })).toBe(true);
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

    it('keeps artworks in every static museum-data snapshot collection', () => {
        const snapshotSources = [
            ['paris-musees', 'paris-musees'],
            ['art-institute-of-chicago', 'art-institute-of-chicago'],
            ['smithsonian-open-access', 'smithsonian-open-access'],
            ['cleveland-museum-of-art', 'cleveland-museum-of-art'],
            ['rijksmuseum', 'rijksmuseum'],
            ['national-gallery-of-art', 'nga'],
            ['library-of-congress', 'library-of-congress'],
            ['biodiversity-heritage-library', 'biodiversity-heritage-library'],
            ['nasa-open-media', 'nasa-open-media'],
        ];
        for (const [sourceId, dir] of snapshotSources) {
            for (const page of [1, 2, 3]) {
                const filePath = path.resolve(process.cwd(), 'public/museum-data', dir, `${page}.json`);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const kept = data.artworks.filter(record => isFramableMuseumArtwork(sourceId, record));
                expect(kept.length, `${sourceId} page ${page}`).toBeGreaterThan(0);
            }
        }
    });
});

