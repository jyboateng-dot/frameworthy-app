import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./googleDriveAuth', () => ({
    getGoogleDriveAccessToken: vi.fn(),
}));

// A minimal fake of Google's Picker API surface. `outcome` controls what the
// built picker "does" when shown: 'picked' invokes the callback with a fake
// doc, 'cancel' invokes it with a CANCEL action.
function makeFakePicker(outcome, doc) {
    let capturedCallback;
    const builderChain = {
        addView: () => builderChain,
        setOAuthToken: () => builderChain,
        setDeveloperKey: () => builderChain,
        setCallback: (cb) => {
            capturedCallback = cb;
            return builderChain;
        },
        build: () => ({
            setVisible: () => {
                if (outcome === 'picked') {
                    capturedCallback({ action: 'picked', docs: [doc] });
                } else if (outcome === 'cancel') {
                    capturedCallback({ action: 'cancel' });
                }
            },
        }),
    };
    // DocsView is used with `new`, so it must be a real constructor —
    // an arrow function can't be. Returning an object from it makes `new`
    // use that object, chainable setMode included.
    function DocsView() {
        const view = { setMode: () => view };
        return view;
    }
    // PickerBuilder is also used with `new` — same constraint as DocsView.
    function PickerBuilder() {
        return builderChain;
    }
    return {
        DocsView: vi.fn(DocsView),
        ViewId: { DOCS_IMAGES: 'DOCS_IMAGES' },
        DocsViewMode: { GRID: 'GRID' },
        PickerBuilder: vi.fn(PickerBuilder),
        Action: { PICKED: 'picked', CANCEL: 'cancel' },
    };
}

const originalFetch = global.fetch;

describe('importFromGoogleDrive', () => {
    // The API key is read as a module-level constant, so a plain
    // vi.stubEnv() alone only reaches a module that's imported AFTER the
    // stub is in place — reusing whatever instance was cached from an
    // earlier test (or, worse, from whatever a developer's own real
    // .env.local happens to set) is exactly what let this suite pass
    // locally while failing in CI, where no real key is ever present.
    // Resetting the module registry and re-importing fresh in every
    // beforeEach is what keeps each test's env stub actually effective.
    let importFromGoogleDrive;
    let getGoogleDriveAccessToken;

    beforeEach(async () => {
        vi.resetModules();
        vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', 'test-api-key');
        ({ importFromGoogleDrive } = await import('./importFromGoogleDrive'));
        ({ getGoogleDriveAccessToken } = await import('./googleDriveAuth'));
        getGoogleDriveAccessToken.mockResolvedValue('tok-drive');
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete window.google;
        delete window.gapi;
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('rejects without ever requesting a token when the API key is not configured', async () => {
        // Overrides beforeEach's default stub with an empty key, then
        // re-resets and re-imports again so THIS test's module instance
        // reflects that empty value instead.
        vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', '');
        vi.resetModules();
        const { importFromGoogleDrive: freshImport } = await import('./importFromGoogleDrive');
        const { getGoogleDriveAccessToken: freshGetToken } = await import('./googleDriveAuth');

        await expect(freshImport()).rejects.toThrow('isn’t set up yet');
        expect(freshGetToken).not.toHaveBeenCalled();
    });

    it('walks the full picker flow and returns the picked file as a File', async () => {
        window.google = { picker: makeFakePicker('picked', { id: 'file-1', name: 'photo.png', mimeType: 'image/png' }) };
        global.fetch = vi.fn(async (url, opts) => {
            expect(url).toBe('https://www.googleapis.com/drive/v3/files/file-1?alt=media');
            expect(opts.headers.Authorization).toBe('Bearer tok-drive');
            return { ok: true, blob: async () => new Blob([1, 2, 3], { type: 'image/png' }) };
        });

        const file = await importFromGoogleDrive();

        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('photo.png');
        expect(file.type).toBe('image/png');
    });

    it('falls back to a generated name when the picked doc has none', async () => {
        window.google = { picker: makeFakePicker('picked', { id: 'file-2', mimeType: 'image/jpeg' }) };
        global.fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob([1], { type: 'image/jpeg' }) }));

        const file = await importFromGoogleDrive();
        expect(file.name).toBe('google-drive.jpg');
    });

    it('rejects when the user cancels the picker', async () => {
        window.google = { picker: makeFakePicker('cancel') };
        await expect(importFromGoogleDrive()).rejects.toThrow('No file was selected');
    });

    it('rejects when the download itself fails', async () => {
        window.google = { picker: makeFakePicker('picked', { id: 'file-3', name: 'x.png', mimeType: 'image/png' }) };
        global.fetch = vi.fn(async () => ({ ok: false }));

        await expect(importFromGoogleDrive()).rejects.toThrow('Couldn’t download the picked file');
    });
});
