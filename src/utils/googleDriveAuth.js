import { getGoogleAccessToken, _resetGoogleOAuthCache } from './googleOAuth';

/** Requests access only to files selected through this application's picker. */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function getGoogleDriveAccessToken() {
    return getGoogleAccessToken(CLIENT_ID, SCOPE);
}

export function _resetGoogleDriveAuthCache() {
    _resetGoogleOAuthCache();
}
