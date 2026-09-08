/** Loads Google Identity Services and keeps short-lived access tokens in memory. */

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let gisLoadPromise = null;

function loadGis() {
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        return Promise.resolve();
    }
    if (gisLoadPromise) return gisLoadPromise;

    gisLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Could not load Google’s sign-in script.')));
            return;
        }
        const script = document.createElement('script');
        script.src = GIS_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => {
            gisLoadPromise = null;
            reject(new Error('Could not load Google’s sign-in script.'));
        };
        document.head.appendChild(script);
    });
    return gisLoadPromise;
}

export function preloadGoogleOAuth() {
    return loadGis();
}

const tokenCache = new Map();

export async function getGoogleAccessToken(clientId, scope) {
    if (!clientId) {
        throw new Error('Google sign-in isn’t set up yet.');
    }
    const cached = tokenCache.get(scope);
    if (cached && cached.expiresAt > Date.now() + 30_000) {
        return cached.token;
    }

    await loadGis();

    return new Promise((resolve, reject) => {
        let settled = false;
        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope,
            callback: (response) => {
                settled = true;
                if (response.error) {
                    reject(new Error(response.error_description || 'Google didn’t grant access.'));
                    return;
                }
                tokenCache.set(scope, {
                    token: response.access_token,
                    expiresAt: Date.now() + (Number(response.expires_in) || 55 * 60) * 1000,
                });
                resolve(response.access_token);
            },
            error_callback: (err) => {
                if (settled) return;
                settled = true;
                if (err?.type === 'popup_closed') {
                    reject(new Error('Sign-in window was closed.'));
                } else if (err?.type === 'popup_failed_to_open') {
                    reject(new Error('Your browser blocked the Google sign-in window — allow pop-ups and try again.'));
                } else {
                    reject(new Error('Couldn’t sign in with Google.'));
                }
            },
        });
        client.requestAccessToken();
    });
}

// Exposed for tests only.
export function _resetGoogleOAuthCache() {
    tokenCache.clear();
    gisLoadPromise = null;
}
