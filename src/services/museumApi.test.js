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
                total: 1,
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
        expect(result.artworks).toHaveLength(1);
    });

    it('falls through to the live loader when a warmed snapshot is unavailable', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [], info: { total: 0 } }),
            }).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [], info: { total: 0 } }),
            });
        vi.stubGlobal('fetch', fetch);
        const { fetchMuseumArtworks, prefetchMuseumSnapshot } = await import('./museumApi.js');

        await prefetchMuseumSnapshot('cleveland-museum-of-art');
        await expect(fetchMuseumArtworks('cleveland-museum-of-art')).resolves.toEqual({ artworks: [], total: 0 });

        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch.mock.calls[1][0]).toContain('openaccess-api.clevelandart.org');
    });
});
