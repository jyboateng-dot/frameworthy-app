import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importFromGooglePhotos } from './importFromGooglePhotos';
import { getGooglePhotosAccessToken } from './googlePhotosAuth';

vi.mock('./googlePhotosAuth', () => ({
    getGooglePhotosAccessToken: vi.fn(),
}));

const SESSION = (overrides = {}) => ({
    id: 'sess-1',
    pickerUri: 'https://photos.google.com/picker/sess-1',
    pollingConfig: { pollInterval: '0.005s', timeoutIn: '0.05s' },
    ...overrides,
});

const jsonResponse = (body, ok = true) => Promise.resolve({ ok, json: async () => body });

const originalFetch = global.fetch;
const originalOpen = window.open;

describe('importFromGooglePhotos', () => {
    beforeEach(() => {
        getGooglePhotosAccessToken.mockResolvedValue('tok-1');
    });

    afterEach(() => {
        global.fetch = originalFetch;
        window.open = originalOpen;
        vi.restoreAllMocks();
    });

    it('walks the full session flow and returns the picked photo as a File', async () => {
        const popup = { closed: false, close: vi.fn() };
        window.open = vi.fn(() => popup);

        let pollCount = 0;
        global.fetch = vi.fn((url) => {
            const u = String(url);
            if (u === 'https://photospicker.googleapis.com/v1/sessions') {
                return jsonResponse(SESSION());
            }
            if (u === 'https://photospicker.googleapis.com/v1/sessions/sess-1') {
                pollCount += 1;
                if (pollCount < 2) return jsonResponse({ mediaItemsSet: false });
                return jsonResponse({ mediaItemsSet: true });
            }
            if (u.startsWith('https://photospicker.googleapis.com/v1/mediaItems?sessionId=sess-1')) {
                return jsonResponse({
                    mediaItems: [{ mediaFile: { baseUrl: 'https://example.com/photo', mimeType: 'image/jpeg' } }],
                });
            }
            if (u === 'https://example.com/photo=d') {
                return Promise.resolve({ ok: true, blob: async () => new Blob([1, 2, 3], { type: 'image/jpeg' }) });
            }
            throw new Error(`Unexpected fetch: ${u}`);
        });

        const file = await importFromGooglePhotos();

        expect(file).toBeInstanceOf(File);
        expect(file.type).toBe('image/jpeg');
        expect(file.name).toBe('google-photos.jpg');
        expect(popup.closed).toBe(false); // we close it ourselves via .close(), not by mutating .closed
        expect(window.open).toHaveBeenCalledWith(
            'https://photos.google.com/picker/sess-1',
            'google-photos-picker',
            expect.stringContaining('width=520')
        );
    });

    it('rejects when the browser blocks the picker popup', async () => {
        window.open = vi.fn(() => null);
        global.fetch = vi.fn(() => jsonResponse(SESSION()));

        await expect(importFromGooglePhotos()).rejects.toThrow('blocked the Google Photos window');
    });

    it('rejects when the session cannot be created', async () => {
        window.open = vi.fn(() => ({ closed: false }));
        global.fetch = vi.fn(() => jsonResponse({}, false));

        await expect(importFromGooglePhotos()).rejects.toThrow('Couldn’t start Google Photos');
    });

    it('rejects when the user closes the popup before picking anything', async () => {
        const popup = { closed: false };
        window.open = vi.fn(() => popup);

        global.fetch = vi.fn((url) => {
            const u = String(url);
            if (u === 'https://photospicker.googleapis.com/v1/sessions') return jsonResponse(SESSION());
            if (u === 'https://photospicker.googleapis.com/v1/sessions/sess-1') {
                popup.closed = true; // user closed it while we were polling
                return jsonResponse({ mediaItemsSet: false });
            }
            throw new Error(`Unexpected fetch: ${u}`);
        });

        await expect(importFromGooglePhotos()).rejects.toThrow('No photo was selected');
    });

    it('times out if nothing is picked within the session timeout', async () => {
        window.open = vi.fn(() => ({ closed: false, close: vi.fn() }));
        global.fetch = vi.fn((url) => {
            const u = String(url);
            if (u === 'https://photospicker.googleapis.com/v1/sessions') return jsonResponse(SESSION());
            if (u === 'https://photospicker.googleapis.com/v1/sessions/sess-1') return jsonResponse({ mediaItemsSet: false });
            throw new Error(`Unexpected fetch: ${u}`);
        });

        await expect(importFromGooglePhotos()).rejects.toThrow('Timed out waiting');
    });
});
