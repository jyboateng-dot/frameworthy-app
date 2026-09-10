import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

async function freshModule() {
    vi.resetModules();
    return import('./googleDriveAuth');
}

describe('getGoogleDriveAccessToken', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID);
        delete window.google;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete window.google;
    });

    it('rejects when the client id is not configured', async () => {
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
        const { getGoogleDriveAccessToken } = await freshModule();
        await expect(getGoogleDriveAccessToken()).rejects.toThrow('isn’t set up yet');
    });

    it('resolves the access token from a successful sign-in, requesting the per-file Drive scope', async () => {
        const initTokenClient = vi.fn((opts) => ({
            requestAccessToken: () => opts.callback({ access_token: 'tok-drive', expires_in: 3600 }),
        }));
        window.google = { accounts: { oauth2: { initTokenClient } } };
        const { getGoogleDriveAccessToken } = await freshModule();

        await expect(getGoogleDriveAccessToken()).resolves.toBe('tok-drive');
        expect(initTokenClient).toHaveBeenCalledWith(
            expect.objectContaining({ scope: 'https://www.googleapis.com/auth/drive.file' })
        );
    });

    it('caches the token instead of prompting again while it is still fresh', async () => {
        const initTokenClient = vi.fn((opts) => ({
            requestAccessToken: () => opts.callback({ access_token: 'tok-drive', expires_in: 3600 }),
        }));
        window.google = { accounts: { oauth2: { initTokenClient } } };
        const { getGoogleDriveAccessToken } = await freshModule();

        await getGoogleDriveAccessToken();
        await getGoogleDriveAccessToken();

        expect(initTokenClient).toHaveBeenCalledTimes(1);
    });

    it('prepares the token client before the later user-triggered request', async () => {
        let options;
        const requestAccessToken = vi.fn(() => options.callback({ access_token: 'prepared-token', expires_in: 3600 }));
        const initTokenClient = vi.fn((clientOptions) => {
            options = clientOptions;
            return { requestAccessToken };
        });
        window.google = { accounts: { oauth2: { initTokenClient } } };
        const { preloadGoogleDriveAuth, getGoogleDriveAccessToken } = await freshModule();

        await preloadGoogleDriveAuth();
        expect(initTokenClient).toHaveBeenCalledTimes(1);
        expect(requestAccessToken).not.toHaveBeenCalled();

        const tokenPromise = getGoogleDriveAccessToken();
        expect(requestAccessToken).toHaveBeenCalledTimes(1);
        await expect(tokenPromise).resolves.toBe('prepared-token');
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
        const { getGoogleDriveAccessToken } = await freshModule();
        await expect(getGoogleDriveAccessToken()).rejects.toThrow('blocked the Google sign-in window');
    });
});
