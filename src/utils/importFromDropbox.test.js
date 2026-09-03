import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = global.fetch;

async function freshModule() {
    vi.resetModules();
    return import('./importFromDropbox');
}

describe('importFromDropbox', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_DROPBOX_APP_KEY', 'test-app-key');
        delete window.Dropbox;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete window.Dropbox;
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('rejects when the app key is not configured', async () => {
        vi.stubEnv('VITE_DROPBOX_APP_KEY', '');
        const { importFromDropbox } = await freshModule();
        await expect(importFromDropbox()).rejects.toThrow('isn’t set up yet');
    });

    it('walks the chooser flow and returns the picked file as a File', async () => {
        window.Dropbox = {
            choose: (opts) => opts.success([{ name: 'photo.jpg', link: 'https://dl.dropboxusercontent.com/x/photo.jpg' }]),
        };
        global.fetch = vi.fn(async (url) => {
            expect(url).toBe('https://dl.dropboxusercontent.com/x/photo.jpg');
            return { ok: true, blob: async () => new Blob([1, 2, 3], { type: 'image/jpeg' }) };
        });

        const { importFromDropbox } = await freshModule();
        const file = await importFromDropbox();

        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('photo.jpg');
        expect(file.type).toBe('image/jpeg');
    });

    it('rejects when the user cancels the chooser', async () => {
        window.Dropbox = { choose: (opts) => opts.cancel() };
        const { importFromDropbox } = await freshModule();
        await expect(importFromDropbox()).rejects.toThrow('No file was selected');
    });

    it('rejects when the download itself fails', async () => {
        window.Dropbox = {
            choose: (opts) => opts.success([{ name: 'x.jpg', link: 'https://dl.dropboxusercontent.com/x.jpg' }]),
        };
        global.fetch = vi.fn(async () => ({ ok: false }));
        const { importFromDropbox } = await freshModule();
        await expect(importFromDropbox()).rejects.toThrow('Couldn’t download the picked file');
    });
});
