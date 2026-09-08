import { getGoogleAccessToken, prepareGoogleAccessToken, _resetGoogleOAuthCache } from './googleOAuth';

/** Read-only Drive access enables thumbnails before a file is selected. */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export function getGoogleDriveAccessToken() {
    return getGoogleAccessToken(CLIENT_ID, SCOPE);
}

export function preloadGoogleDriveAuth() {
    return prepareGoogleAccessToken(CLIENT_ID, SCOPE);
}

export function _resetGoogleDriveAuthCache() {
    _resetGoogleOAuthCache();
}
