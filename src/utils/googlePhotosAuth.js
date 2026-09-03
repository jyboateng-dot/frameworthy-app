import { getGoogleAccessToken, _resetGoogleOAuthCache } from './googleOAuth';

/**
 * Gets a short-lived OAuth access token scoped to the Google Photos Picker
 * API. See googleOAuth.js for the actual Identity Services mechanics — this
 * file just pins the scope for Photos.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

export function getGooglePhotosAccessToken() {
    return getGoogleAccessToken(CLIENT_ID, SCOPE);
}

// Exposed for tests only.
export function _resetGooglePhotosAuthCache() {
    _resetGoogleOAuthCache();
}
