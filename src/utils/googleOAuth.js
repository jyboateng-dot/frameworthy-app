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

const tokenCache = new Map();
const tokenClientCache = new Map();

function tokenClientKey(clientId, scope) {
    return `${clientId}::${scope}`;
}

function createTokenClient(clientId, scope) {
    const key = tokenClientKey(clientId, scope);
    const existing = tokenClientCache.get(key);
    if (existing) return existing;

    const entry = { client: null, pending: null };
    entry.client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: (response) => {
            const pending = entry.pending;
            entry.pending = null;
            if (!pending) return;
            if (response.error) {
                pending.reject(new Error(response.error_description || 'Google didn’t grant access.'));
                return;
            }
            tokenCache.set(scope, {
                token: response.access_token,
                expiresAt: Date.now() + (Number(response.expires_in) || 55 * 60) * 1000,
            });
            pending.resolve(response.access_token);
        },
        error_callback: (error) => {
            const pending = entry.pending;
            entry.pending = null;
            if (!pending) return;
            if (error?.type === 'popup_closed') {
                pending.reject(new Error('Sign-in window was closed.'));
            } else if (error?.type === 'popup_failed_to_open') {
                pending.reject(new Error('Your browser blocked the Google sign-in window — allow pop-ups and try again.'));
            } else {
                pending.reject(new Error('Couldn’t sign in with Google.'));
            }
        },
    });
    tokenClientCache.set(key, entry);
    return entry;
}

export async function prepareGoogleAccessToken(clientId, scope) {
    if (!clientId) throw new Error('Google sign-in isn’t set up yet.');
    await loadGis();
    return createTokenClient(clientId, scope);
}

export async function getGoogleAccessToken(clientId, scope) {
    if (!clientId) {
        throw new Error('Google sign-in isn’t set up yet.');
    }
    const cached = tokenCache.get(scope);
    if (cached && cached.expiresAt > Date.now() + 30_000) {
        return cached.token;
    }

    // When prepareGoogleAccessToken() ran while the source menu was open,
    // this branch contains no await. requestAccessToken() therefore executes
    // in the Drive button's original tap task, which mobile browsers require
    // in order to keep the OAuth dialog attached to its opener.
    const key = tokenClientKey(clientId, scope);
    const entry = tokenClientCache.get(key) || await prepareGoogleAccessToken(clientId, scope);
    return new Promise((resolve, reject) => {
        if (entry.pending) {
            reject(new Error('Google sign-in is already open.'));
            return;
        }
        entry.pending = { resolve, reject };
        try {
            entry.client.requestAccessToken();
        } catch (error) {
            entry.pending = null;
            reject(error);
        }
    });
}

// Exposed for tests only.
export function _resetGoogleOAuthCache() {
    tokenCache.clear();
    tokenClientCache.clear();
    gisLoadPromise = null;
}
