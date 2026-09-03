import { describe, it, expect, vi, afterEach } from 'vitest';
import { importImageFromUrl } from './importImageFromUrl';

const originalFetch = global.fetch;
afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('importImageFromUrl', () => {
    it('rejects an empty/whitespace-only url without ever fetching', async () => {
        global.fetch = vi.fn();
        await expect(importImageFromUrl('   ')).rejects.toThrow('Paste an image link first.');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('calls the server proxy with the url encoded as a query param', async () => {
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
        global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });

        await importImageFromUrl('https://example.com/a photo.png?x=1&y=2');

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/import-image-url?url=' + encodeURIComponent('https://example.com/a photo.png?x=1&y=2')
        );
    });

    it('returns a File built from the response blob, named by its content-type', async () => {
        const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
        global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });

        const file = await importImageFromUrl('https://example.com/photo');

        expect(file).toBeInstanceOf(File);
        expect(file.type).toBe('image/png');
        expect(file.name).toBe('url-import.png');
        expect(file.size).toBe(4);
    });

    it('maps image/jpeg to a .jpg extension', async () => {
        const blob = new Blob([new Uint8Array([1])], { type: 'image/jpeg' });
        global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
        const file = await importImageFromUrl('https://example.com/photo');
        expect(file.name).toBe('url-import.jpg');
    });

    it('surfaces a friendly message for a known error status', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 415 });
        await expect(importImageFromUrl('https://example.com/page.html')).rejects.toThrow('isn’t an image');
    });

    it('falls back to a generic message for an unmapped error status', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
        await expect(importImageFromUrl('https://example.com/x')).rejects.toThrow('Couldn’t load that image.');
    });

    it('surfaces a friendly message when the fetch itself throws (offline, DNS, etc.)', async () => {
        global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(importImageFromUrl('https://example.com/x')).rejects.toThrow('Couldn’t reach that link');
    });
});
