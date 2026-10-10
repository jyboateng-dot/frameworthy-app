import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importArtworkFromDevice, importArtworkFromUrl } from './artworkImport';
import { getAppCheckToken } from './firebase';

vi.mock('./firebase', () => ({ getAppCheckToken: vi.fn() }));

const originalFetch = globalThis.fetch;

beforeEach(() => {
    getAppCheckToken.mockResolvedValue(null);
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('artworkImport', () => {
    it('normalizes an image selected from the device', async () => {
        const file = new File(['pixels'], 'portrait.png', { type: 'image/png' });
        await expect(importArtworkFromDevice(file)).resolves.toEqual({
            file,
            source: 'device',
            name: 'portrait.png',
            mimeType: 'image/png',
        });
    });

    it('rejects non-image device files and images over 20 MB', async () => {
        await expect(importArtworkFromDevice(new File(['text'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow('Choose an image file.');
        const oversized = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' });
        await expect(importArtworkFromDevice(oversized)).rejects.toThrow('smaller than 20 MB');
    });

    it('imports a URL through the JSON POST endpoint', async () => {
        const blob = new Blob(['pixels'], { type: 'image/png' });
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'image/png', 'x-artwork-filename': 'art.png' }),
            blob: async () => blob,
        });

        const artwork = await importArtworkFromUrl(' https://example.com/art.png ');

        expect(globalThis.fetch).toHaveBeenCalledWith('/api/artwork/import-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com/art.png' }),
        });
        expect(artwork.source).toBe('url');
        expect(artwork.file.name).toBe('art.png');
        expect(artwork.file.type).toBe('image/png');
    });

    it('sends an App Check token when Firebase provides one', async () => {
        getAppCheckToken.mockResolvedValue('app-check-token');
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'image/png' }),
            blob: async () => new Blob(['pixels'], { type: 'image/png' }),
        });

        await importArtworkFromUrl('https://example.com/art.png');

        expect(globalThis.fetch).toHaveBeenCalledWith('/api/artwork/import-url', expect.objectContaining({
            headers: {
                'Content-Type': 'application/json',
                'X-Firebase-AppCheck': 'app-check-token',
            },
        }));
    });

    it('maps endpoint failures to actionable messages', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 415 });
        await expect(importArtworkFromUrl('https://example.com/page')).rejects.toThrow('supported image');
    });
});
