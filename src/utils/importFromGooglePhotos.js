import { getGooglePhotosAccessToken } from './googlePhotosAuth';

/**
 * The free, self-built Google Photos source (Uploadcare's own Google Photos
 * source is paid-locked — see the URL-import file's comment for the same
 * story with "From link"). Uses the Google Photos Picker API's session flow:
 * open a session, let the user pick in Google's own popup UI, poll until
 * they're done, then download the one photo they picked.
 *
 * https://developers.google.com/photos/picker/guides/get-started
 */

const SESSIONS_URL = 'https://photospicker.googleapis.com/v1/sessions';
const MEDIA_ITEMS_URL = 'https://photospicker.googleapis.com/v1/mediaItems';

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const POPUP_FEATURES = 'width=520,height=680,noopener';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google returns durations like "2.5s" (a protobuf Duration string).
function parseDurationMs(value, fallbackMs) {
    if (typeof value !== 'string') return fallbackMs;
    const seconds = parseFloat(value);
    return Number.isFinite(seconds) ? seconds * 1000 : fallbackMs;
}

async function authedFetch(url, token, options = {}) {
    return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
}

function extensionForMimeType(mimeType) {
    const subtype = (mimeType || '').split('/')[1] || 'jpg';
    return subtype === 'jpeg' ? 'jpg' : subtype;
}

export async function importFromGooglePhotos() {
    const token = await getGooglePhotosAccessToken();

    const sessionRes = await authedFetch(SESSIONS_URL, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickingConfig: { maxItemCount: '1' } }),
    });
    if (!sessionRes.ok) {
        throw new Error('Couldn’t start Google Photos. Try again in a moment.');
    }
    const session = await sessionRes.json();
    if (!session.id || !session.pickerUri) {
        throw new Error('Couldn’t start Google Photos. Try again in a moment.');
    }

    const popup = window.open(session.pickerUri, 'google-photos-picker', POPUP_FEATURES);
    if (!popup) {
        throw new Error('Your browser blocked the Google Photos window — allow pop-ups for this site and try again.');
    }

    const pollInterval = parseDurationMs(session.pollingConfig?.pollInterval, DEFAULT_POLL_INTERVAL_MS);
    const timeoutMs = parseDurationMs(session.pollingConfig?.timeoutIn, DEFAULT_TIMEOUT_MS);
    const deadline = Date.now() + timeoutMs;

    let mediaItemsSet = false;
    while (Date.now() < deadline) {
        await wait(pollInterval);

        const pollRes = await authedFetch(`${SESSIONS_URL}/${session.id}`, token);
        if (pollRes.ok) {
            const polled = await pollRes.json();
            if (polled.mediaItemsSet) {
                mediaItemsSet = true;
                break;
            }
        }
        if (popup.closed) {
            throw new Error('No photo was selected.');
        }
    }
    if (!popup.closed) popup.close();
    if (!mediaItemsSet) {
        throw new Error('Timed out waiting for a photo to be picked. Try again.');
    }

    const listRes = await authedFetch(`${MEDIA_ITEMS_URL}?sessionId=${encodeURIComponent(session.id)}`, token);
    if (!listRes.ok) {
        throw new Error('Couldn’t load the picked photo.');
    }
    const { mediaItems } = await listRes.json();
    const item = mediaItems?.[0];
    const baseUrl = item?.mediaFile?.baseUrl;
    if (!item || !baseUrl) {
        throw new Error('No photo was selected.');
    }

    const mimeType = item.mediaFile?.mimeType || 'image/jpeg';
    // "=d" requests the original bytes rather than a resized/rendered copy.
    const downloadRes = await authedFetch(`${baseUrl}=d`, token);
    if (!downloadRes.ok) {
        throw new Error('Couldn’t download the picked photo.');
    }
    const blob = await downloadRes.blob();
    return new File([blob], `google-photos.${extensionForMimeType(mimeType)}`, { type: mimeType });
}
