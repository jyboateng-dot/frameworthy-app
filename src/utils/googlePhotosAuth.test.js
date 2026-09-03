import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

async function freshModule() {
    vi.resetModules();
    return import('./googlePhotosAuth');
}

describe('getGooglePhotosAccessToken', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_GOOGLE_PHOTOS_CLIENT_ID', CLIENT_ID);
        delete window.google;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete window.google;
    });

    it('rejects when the client id is not configured', async () => {
        vi.stubEnv('VITE_GOOGLE_PHOTOS_CLIENT_ID', '');
        const { getGooglePhotosAccessToken } = await freshModule();
        await expect(getGooglePhotosAccessToken()).rejects.toThrow('isn’t set up yet');
    });

    it('resolves the access token from a successful sign-in', async () => {
        window.google = {
            accounts: {
                oauth2: {
                    initTokenClient: vi.fn((opts) => ({
                        requestAccessToken: () => opts.callback({ access_token: 'tok-1', expires_in: 3600 }),
                    })),
                },
            },
        };
        const { getGooglePhotosAccessToken } = await freshModule();
        await expect(getGooglePhotosAccessToken()).resolves.toBe('tok-1');
    });

    it('caches the token instead of prompting again while it is still fresh', async () => {
        const initTokenClient = vi.fn((opts) => ({
            requestAccessToken: () => opts.callback({ access_token: 'tok-1', expires_in: 3600 }),
        }));
        window.google = { accounts: { oauth2: { initTokenClient } } };
        const { getGooglePhotosAccessToken } = await freshModule();

        await getGooglePhotosAccessToken();
        await getGooglePhotosAccessToken();

        expect(initTokenClient).toHaveBeenCalledTimes(1);
    });

    it('rejects with the server-provided error description on failure', async () => {
        window.google = {
            accounts: {
                oauth2: {
                    initTokenClient: vi.fn((opts) => ({
                        requestAccessToken: () => opts.callback({ error: 'access_denied', error_description: 'User declined access' }),
                    })),
                },
            },
        };
        const { getGooglePhotosAccessToken } = await freshModule();
        await expect(getGooglePhotosAccessToken()).rejects.toThrow('User declined access');
    });

    it('surfaces a friendly message when the sign-in popup is closed early', async () => {
        window.google = {
            accounts: {
                oauth2: {
                    initTokenClient: vi.fn((opts) => ({
                        requestAccessToken: () => opts.error_callback({ type: 'popup_closed' }),
                    })),
                },
            },
        };
        const { getGooglePhotosAccessToken } = await freshModule();
        await expect(getGooglePhotosAccessToken()).rejects.toThrow('Sign-in window was closed');
    });

    it('surfaces a friendly message when the popup is blocked', async () => {
        window.google = {
            accounts: {
                oauth2: {
                    initTokenClient: vi.fn((opts) => ({
                        requestAccessToken: () => opts.error_callback({ type: 'popup_failed_to_open' }),
                    })),
                },
            },
        };
        const { getGooglePhotosAccessToken } = await freshModule();
        await expect(getGooglePhotosAccessToken()).rejects.toThrow('blocked the Google sign-in window');
    });
});
