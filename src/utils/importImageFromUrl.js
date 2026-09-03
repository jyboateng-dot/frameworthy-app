// Client side of the "paste an image URL" upload option (see
// ImageUrlImportField.jsx). The actual fetch happens server-side —
// functions/index.js's importImageFromUrl — because a browser fetch to an
// arbitrary third-party host is blocked by CORS far more often than not,
// and even when it isn't, the server side is where the safety checks
// (private-IP/SSRF blocking, content-type, size cap) actually have to live;
// a client-side check is trivial to bypass and protects nobody.
const ENDPOINT = '/api/import-image-url';

const FRIENDLY_MESSAGES = {
    400: 'That doesn’t look like a valid image URL.',
    403: 'That link isn’t allowed.',
    404: 'Nothing was found at that link.',
    413: 'That image is too large (20MB max).',
    415: 'That link isn’t an image.',
    502: 'Couldn’t load that link — the site may be down or blocking us.',
};

function extensionFor(contentType) {
    const subtype = (contentType.split('/')[1] || '').split(';')[0].trim().toLowerCase();
    if (subtype === 'jpeg') return 'jpg';
    if (subtype === 'svg+xml') return 'svg';
    return /^[a-z0-9]+$/.test(subtype) ? subtype : 'jpg';
}

/**
 * Fetches a customer-pasted image URL and hands back a File, ready for the
 * same applyImageFile() pipeline every other upload source already uses.
 * Throws an Error with a message safe to show the customer directly.
 */
export async function importImageFromUrl(rawUrl) {
    const url = rawUrl.trim();
    if (!url) throw new Error('Paste an image link first.');

    let response;
    try {
        response = await fetch(`${ENDPOINT}?url=${encodeURIComponent(url)}`);
    } catch {
        throw new Error('Couldn’t reach that link — check your connection and try again.');
    }

    if (!response.ok) {
        throw new Error(FRIENDLY_MESSAGES[response.status] || 'Couldn’t load that image.');
    }

    const blob = await response.blob();
    const contentType = blob.type || 'image/jpeg';
    const name = `url-import.${extensionFor(contentType)}`;
    return new File([blob], name, { type: contentType });
}
