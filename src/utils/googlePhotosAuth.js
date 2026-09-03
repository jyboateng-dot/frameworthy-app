/**
 * Gets a short-lived OAuth access token scoped to the Google Photos Picker
 * API, via Google Identity Services (GIS) — the client-side token popup, not
 * the old server-redirect OAuth flow. No backend involved: the token comes
 * straight back to the browser and is used directly against
 * photospicker.googleapis.com (see importFromGooglePhotos.js).
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_PHOTOS_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
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

// Cached in memory only (not localStorage) — a fresh popup on every page
// load is an acceptable trade for not persisting a token client-side longer
// than it needs to live.
let cachedToken = null; // { token, expiresAt }

export async function getGooglePhotosAccessToken() {
    if (!CLIENT_ID) {
        throw new Error('Google Photos isn’t set up yet.');
    }
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
        return cachedToken.token;
    }

    await loadGis();

    return new Promise((resolve, reject) => {
        let settled = false;
        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE,
            callback: (response) => {
                settled = true;
                if (response.error) {
                    reject(new Error(response.error_description || 'Google didn’t grant access to your photos.'));
                    return;
                }
                cachedToken = {
                    token: response.access_token,
                    expiresAt: Date.now() + (Number(response.expires_in) || 55 * 60) * 1000,
                };
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
export function _resetGooglePhotosAuthCache() {
    cachedToken = null;
    gisLoadPromise = null;
}
