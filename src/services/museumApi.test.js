import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('museum snapshot prefetching', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reuses a warmed snapshot for the category request', async () => {
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                artworks: [
                    { id: 'snapshot-art', title: 'Snapshot art', image: 'https://example.test/art.jpg', classification: 'Painting' },
                    { id: 'object', title: 'Vase', image: 'https://example.test/vase.jpg', classification: 'Ceramic' },
                ],
                total: 2,
            }),
        });
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks, prefetchMuseumSnapshot } = await import('./museumApi.js');

        await prefetchMuseumSnapshot('national-gallery-of-art');
        const result = await fetchMuseumArtworks('national-gallery-of-art');

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(result.artworks[0]).toMatchObject({
            id: 'national-gallery-of-art:snapshot-art',
            sourceId: 'national-gallery-of-art',
        });
        expect(result.artworks).toHaveLength(2);
    });

    it('falls through to the live loader when a warmed snapshot is unavailable', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [], info: { total: 0 } }),
            });
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks, prefetchMuseumSnapshot } = await import('./museumApi.js');

        await prefetchMuseumSnapshot('cleveland-museum-of-art');
        await expect(fetchMuseumArtworks('cleveland-museum-of-art')).resolves.toEqual({ artworks: [], total: 0 });

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][0]).toContain('openaccess-api.clevelandart.org');
    });

    it('loads NASA imagery through the live archival endpoint when no snapshot exists', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    artworks: [{ id: 'nasa-1', title: 'Nebula', image: 'https://example.test/nebula.jpg' }],
                    total: 1,
                }),
            });
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks, prefetchMuseumSnapshot } = await import('./museumApi.js');

        await prefetchMuseumSnapshot('nasa-open-media');
        const result = await fetchMuseumArtworks('nasa-open-media');

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][0]).toContain('/api/archival-artworks?source=nasa-open-media');
        expect(result.artworks).toHaveLength(1);
        expect(result.artworks[0]).toMatchObject({ title: 'Nebula', sourceId: 'nasa-open-media' });
    });

    it('reuses a warmed NASA snapshot instead of requesting the live archival endpoint', async () => {
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                artworks: [{ id: 'nasa-snapshot-1', title: 'Nebula', image: 'https://example.test/nebula.jpg' }],
                total: 1,
            }),
        });
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks, prefetchMuseumSnapshot } = await import('./museumApi.js');

        await prefetchMuseumSnapshot('nasa-open-media');
        const result = await fetchMuseumArtworks('nasa-open-media');

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][0]).toBe('/museum-data/nasa-open-media/1.json');
        expect(result.artworks[0]).toMatchObject({ title: 'Nebula', sourceId: 'nasa-open-media' });
    });

    it('loads Paris Musées through snapshot prefetching and normalizes artworks', async () => {
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                artworks: [{
                    id: 'paris-1',
                    title: 'Femme au bouquet',
                    artist: 'Edgar Degas',
                    image: 'https://apicollections.parismusees.paris.fr/sites/default/files/styles/thumbnail/art.jpg',
                    objectType: 'Peinture',
                }],
                total: 185548,
            }),
        });
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks, prefetchMuseumSnapshot } = await import('./museumApi.js');

        await prefetchMuseumSnapshot('paris-musees');
        const result = await fetchMuseumArtworks('paris-musees');

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][0]).toBe('/museum-data/paris-musees/1.json');
        expect(result.artworks[0]).toMatchObject({
            id: 'paris-musees:paris-1',
            title: 'Femme au bouquet',
            artist: 'Edgar Degas',
            sourceId: 'paris-musees',
        });
    });

    it('falls through to Paris GraphQL direct query when server endpoint is unavailable', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false }) // Snapshot not found
            .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'Server unavailable' }) }) // /api/museum-artworks failed
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        nodeQuery: {
                            entities: [{
                                entityUuid: 'direct-paris-1',
                                title: 'Vue de Paris',
                                fieldCartelAuteur: 'Camille Pissarro',
                                fieldOeuvreTypesObjet: [{ entity: { entityLabel: 'Peinture' } }],
                                fieldVisuels: [{ entity: { vignette: '/sites/default/files/paris.jpg' } }],
                            }],
                        },
                    },
                }),
            }); // Direct GraphQL call
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks } = await import('./museumApi.js');

        const result = await fetchMuseumArtworks('paris-musees', 4);

        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch.mock.calls[1][0]).toContain('/api/museum-artworks?source=paris-musees&page=4');
        expect(fetch.mock.calls[2][0]).toBe('https://apicollections.parismusees.paris.fr/graphql');
        expect(result.artworks).toHaveLength(1);
        expect(result.artworks[0]).toMatchObject({
            id: 'paris-musees:direct-paris-1',
            title: 'Vue de Paris',
            artist: 'Camille Pissarro',
            sourceId: 'paris-musees',
        });
    });

    it('loads Art Institute of Chicago through snapshot prefetching and normalizes artworks', async () => {
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                artworks: [{
                    id: 'aic-1',
                    title: 'The Bedroom',
                    artist: 'Vincent van Gogh',
                    image: 'https://example.test/bedroom.jpg',
                    artworkType: 'Painting',
                }],
                total: 1965,
            }),
        });
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks, prefetchMuseumSnapshot } = await import('./museumApi.js');

        await prefetchMuseumSnapshot('art-institute-of-chicago');
        const result = await fetchMuseumArtworks('art-institute-of-chicago');

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][0]).toBe('/museum-data/art-institute-of-chicago/1.json');
        expect(result.artworks[0]).toMatchObject({
            id: 'art-institute-of-chicago:aic-1',
            title: 'The Bedroom',
            artist: 'Vincent van Gogh',
            sourceId: 'art-institute-of-chicago',
        });
    });

    it('uses the master IIIF width rather than a 2400px cap for Art Institute of Chicago', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [{
                        id: 28560,
                        title: 'The Bedroom',
                        artist_display: 'Vincent van Gogh',
                        image_id: '6644829f-f292-c5c4-a73c-0356a6fdbf0d',
                        thumbnail: { width: 12614, height: 9875 },
                        artwork_type_title: 'Painting',
                    }],
                    pagination: { total: 1 },
                }),
            });
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks } = await import('./museumApi.js');

        const result = await fetchMuseumArtworks('art-institute-of-chicago', 1);

        expect(result.artworks[0]).toMatchObject({
            id: 'art-institute-of-chicago:28560',
            imageWidth: 12614,
            imageHeight: 9875,
            fullRes: 'https://frameworthyco.com/api/artic-image?id=6644829f-f292-c5c4-a73c-0356a6fdbf0d&width=12614',
        });
    });
});
