import { getGoogleDriveAccessToken } from '../utils/googleDriveAuth';

const MAX_ARTWORK_BYTES = 20 * 1024 * 1024;
const URL_IMPORT_ENDPOINT = '/api/artwork/import-url';
const GOOGLE_PICKER_SCRIPT = 'https://apis.google.com/js/api.js';
const DROPBOX_SCRIPT = 'https://www.dropbox.com/static/api/2/dropins.js';
const DROPBOX_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.heic'];
const GOOGLE_APP_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.split('-')[0];

let googlePickerPromise;
let dropboxPromise;

export const ARTWORK_IMPORT_SOURCES = Object.freeze({
    drive: {
        label: 'Google Drive',
        available: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_DRIVE_API_KEY),
    },
    dropbox: {
        label: 'Dropbox',
        available: Boolean(import.meta.env.VITE_DROPBOX_APP_KEY),
    },
});

function extensionForMimeType(mimeType) {
    const subtype = (mimeType || '').split(';')[0].split('/')[1] || 'jpg';
    return subtype === 'jpeg' ? 'jpg' : subtype;
}

function normalizeArtwork(file, source) {
    if (!(file instanceof File)) throw new Error('No image was selected.');
    if (!file.type.toLowerCase().startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > MAX_ARTWORK_BYTES) throw new Error('Choose an image smaller than 20 MB.');

    return {
        file,
        source,
        name: file.name,
        mimeType: file.type,
    };
}

function loadScript({ src, id, dataset, isReady, canLoad, load }) {
    if (isReady()) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const finish = () => Promise.resolve(load?.()).then(resolve, reject);
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (isReady() || canLoad?.()) {
                finish();
                return;
            }
            existing.addEventListener('load', finish, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }

        const script = document.createElement('script');
        if (id) script.id = id;
        Object.entries(dataset || {}).forEach(([key, value]) => { script.dataset[key] = value; });
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = finish;
        script.onerror = () => reject(new Error('Could not load the file picker.'));
        document.head.appendChild(script);
    });
}

function loadGooglePicker() {
    if (!googlePickerPromise) {
        googlePickerPromise = loadScript({
            src: GOOGLE_PICKER_SCRIPT,
            isReady: () => Boolean(window.google?.picker),
            canLoad: () => Boolean(window.gapi?.load),
            load: () => new Promise((resolve, reject) => {
                if (window.google?.picker) {
                    resolve();
                    return;
                }
                window.gapi.load('picker', {
                    callback: resolve,
                    onerror: () => reject(new Error('Could not load Google Drive.')),
                });
            }),
        }).catch((error) => {
            googlePickerPromise = undefined;
            throw error;
        });
    }
    return googlePickerPromise;
}

function pickGoogleDriveFile(token) {
    return new Promise((resolve, reject) => {
        const pickerApi = window.google.picker;
        const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS_IMAGES).setMode(pickerApi.DocsViewMode.THUMBNAILS);
        new pickerApi.PickerBuilder()
            .addView(view)
            .setOAuthToken(token)
            .setDeveloperKey(import.meta.env.VITE_GOOGLE_DRIVE_API_KEY)
            .setAppId(GOOGLE_APP_ID)
            .setCallback((data) => {
                if (data.action === pickerApi.Action.PICKED) resolve(data.docs[0]);
                if (data.action === pickerApi.Action.CANCEL) reject(new Error('No image was selected.'));
            })
            .build()
            .setVisible(true);
    });
}

async function importFromGoogleDrive() {
    const token = await getGoogleDriveAccessToken();
    await loadGooglePicker();
    const picked = await pickGoogleDriveFile(token);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(picked.id)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Could not download that image from Google Drive.');

    const blob = await response.blob();
    const mimeType = picked.mimeType || blob.type || 'image/jpeg';
    const name = picked.name || `google-drive.${extensionForMimeType(mimeType)}`;
    return normalizeArtwork(new File([blob], name, { type: mimeType }), 'drive');
}

function loadDropbox() {
    if (!dropboxPromise) {
        dropboxPromise = loadScript({
            src: DROPBOX_SCRIPT,
            id: 'dropboxjs',
            dataset: { appKey: import.meta.env.VITE_DROPBOX_APP_KEY },
            isReady: () => Boolean(window.Dropbox?.choose),
        }).catch((error) => {
            dropboxPromise = undefined;
            throw error;
        });
    }
    return dropboxPromise;
}

async function importFromDropbox() {
    await loadDropbox();
    const picked = await new Promise((resolve, reject) => {
        window.Dropbox.choose({
            success: ([file]) => resolve(file),
            cancel: () => reject(new Error('No image was selected.')),
            linkType: 'direct',
            multiselect: false,
            extensions: DROPBOX_IMAGE_EXTENSIONS,
        });
    });
    const response = await fetch(picked.link);
    if (!response.ok) throw new Error('Could not download that image from Dropbox.');

    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    const name = picked.name || `dropbox.${extensionForMimeType(mimeType)}`;
    return normalizeArtwork(new File([blob], name, { type: mimeType }), 'dropbox');
}

export async function importArtworkFromDevice(file) {
    return normalizeArtwork(file, 'device');
}

export async function importArtworkFromUrl(rawUrl) {
    const url = rawUrl.trim();
    if (!url) throw new Error('Paste an image link first.');

    let response;
    try {
        response = await fetch(URL_IMPORT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
    } catch {
        throw new Error('Could not reach that link. Check your connection and try again.');
    }

    if (!response.ok) {
        const messages = {
            400: 'Enter a valid http or https image link.',
            403: 'That image host is not allowed.',
            404: 'No image was found at that link.',
            413: 'Choose an image smaller than 20 MB.',
            415: 'That link does not point to a supported image.',
            502: 'The image host could not be reached.',
        };
        throw new Error(messages[response.status] || 'Could not load that image.');
    }

    const blob = await response.blob();
    const mimeType = (blob.type || response.headers.get('content-type') || '').split(';')[0];
    const responseName = response.headers.get('x-artwork-filename');
    const name = responseName || `linked-image.${extensionForMimeType(mimeType)}`;
    return normalizeArtwork(new File([blob], name, { type: mimeType }), 'url');
}

export async function importArtworkFromCloud(provider) {
    if (!ARTWORK_IMPORT_SOURCES[provider]?.available) throw new Error('That cloud source is not configured.');
    if (provider === 'drive') return importFromGoogleDrive();
    if (provider === 'dropbox') return importFromDropbox();
    throw new Error('That cloud source is not supported.');
}
