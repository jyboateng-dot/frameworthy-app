/**
 * The free, self-built Dropbox source — Dropbox's own "Chooser" embed
 * (dropins.js), not an OAuth flow. No backend, no signed requests: the
 * Chooser popup itself handles the user's Dropbox sign-in, and hands back a
 * temporary, directly-downloadable link for the one file they pick.
 *
 * https://www.dropbox.com/developers/chooser
 */

const APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY;
const DROPINS_SCRIPT_SRC = 'https://www.dropbox.com/static/api/2/dropins.js';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.heic'];

let dropinsLoadPromise = null;

function loadDropins() {
    if (typeof window !== 'undefined' && window.Dropbox?.choose) {
        return Promise.resolve();
    }
    if (dropinsLoadPromise) return dropinsLoadPromise;

    dropinsLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${DROPINS_SCRIPT_SRC}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Could not load Dropbox’s picker script.')));
            return;
        }
        const script = document.createElement('script');
        script.id = 'dropboxjs';
        script.dataset.appKey = APP_KEY;
        script.src = DROPINS_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => {
            dropinsLoadPromise = null;
            reject(new Error('Could not load Dropbox’s picker script.'));
        };
        document.head.appendChild(script);
    });
    return dropinsLoadPromise;
}

function extensionForMimeType(mimeType) {
    const subtype = (mimeType || '').split('/')[1] || 'jpg';
    return subtype === 'jpeg' ? 'jpg' : subtype;
}

export async function importFromDropbox() {
    if (!APP_KEY) {
        throw new Error('Dropbox isn’t set up yet.');
    }

    await loadDropins();

    const picked = await new Promise((resolve, reject) => {
        window.Dropbox.choose({
            success: (files) => resolve(files[0]),
            cancel: () => reject(new Error('No file was selected.')),
            linkType: 'direct',
            multiselect: false,
            extensions: IMAGE_EXTENSIONS,
        });
    });

    const downloadRes = await fetch(picked.link);
    if (!downloadRes.ok) {
        throw new Error('Couldn’t download the picked file.');
    }
    const blob = await downloadRes.blob();
    const mimeType = blob.type || 'image/jpeg';
    const name = picked.name || `dropbox.${extensionForMimeType(mimeType)}`;
    return new File([blob], name, { type: mimeType });
}
