import { getGoogleAccessToken, prepareGoogleAccessToken, _resetGoogleOAuthCache } from './googleOAuth';

/** Google Picker grants access only to the Drive file a customer selects. */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function getGoogleDriveAccessToken() {
    return getGoogleAccessToken(CLIENT_ID, SCOPE);
}

export function preloadGoogleDriveAuth() {
    return prepareGoogleAccessToken(CLIENT_ID, SCOPE);
}

export function _resetGoogleDriveAuthCache() {
    _resetGoogleOAuthCache();
}
