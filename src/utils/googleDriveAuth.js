import { getGoogleAccessToken, _resetGoogleOAuthCache } from './googleOAuth';

/**
 * Gets a short-lived OAuth access token scoped to drive.file — Google's
 * recommended narrow scope for a file-picker use case: it only grants access
 * to files the user explicitly picks through this app, not their whole
 * Drive. Unlike the Photos Picker scope, this one is non-sensitive and needs
 * no Google app-verification review. See googleOAuth.js for the actual
 * Identity Services mechanics.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function getGoogleDriveAccessToken() {
    return getGoogleAccessToken(CLIENT_ID, SCOPE);
}

// Exposed for tests only.
export function _resetGoogleDriveAuthCache() {
    _resetGoogleOAuthCache();
}
