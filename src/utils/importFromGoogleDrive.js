import { getGoogleDriveAccessToken } from './googleDriveAuth';

/**
 * The free, self-built Google Drive source. Uses Google's own Picker
 * library (a client-side popup UI Google hosts and renders — not something
 * this app builds the visuals for), scoped with the drive.file OAuth token
 * so the app only ever sees the one file the user explicitly picks.
 *
 * https://developers.google.com/workspace/drive/picker/guides/overview
 */

const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
const GAPI_SCRIPT_SRC = 'https://apis.google.com/js/api.js';

let gapiLoadPromise = null;

function loadPicker() {
    if (typeof window !== 'undefined' && window.google?.picker) {
        return Promise.resolve();
    }
    if (gapiLoadPromise) return gapiLoadPromise;

    gapiLoadPromise = new Promise((resolve, reject) => {
        const loadPickerModule = () => {
            window.gapi.load('picker', {
                callback: () => resolve(),
                onerror: () => {
                    gapiLoadPromise = null;
                    reject(new Error('Could not load Google Drive’s file picker.'));
                },
            });
        };

        if (typeof window !== 'undefined' && window.gapi?.load) {
            loadPickerModule();
            return;
        }

        const existing = document.querySelector(`script[src="${GAPI_SCRIPT_SRC}"]`);
        if (existing) {
            existing.addEventListener('load', loadPickerModule);
            existing.addEventListener('error', () => reject(new Error('Could not load Google’s API script.')));
            return;
        }
        const script = document.createElement('script');
        script.src = GAPI_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = loadPickerModule;
        script.onerror = () => {
            gapiLoadPromise = null;
            reject(new Error('Could not load Google’s API script.'));
        };
        document.head.appendChild(script);
    });
    return gapiLoadPromise;
}

function extensionForMimeType(mimeType) {
    const subtype = (mimeType || '').split('/')[1] || 'jpg';
    return subtype === 'jpeg' ? 'jpg' : subtype;
}

function openPickerAndWaitForChoice(token) {
    return new Promise((resolve, reject) => {
        const picker = window.google.picker;
        const view = new picker.DocsView(picker.ViewId.DOCS_IMAGES).setMode(picker.DocsViewMode.GRID);

        new picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(token)
            .setDeveloperKey(API_KEY)
            .setCallback((data) => {
                if (data.action === picker.Action.PICKED) {
                    resolve(data.docs[0]);
                } else if (data.action === picker.Action.CANCEL) {
                    reject(new Error('No file was selected.'));
                }
            })
            .build()
            .setVisible(true);
    });
}

export async function importFromGoogleDrive() {
    if (!API_KEY) {
        throw new Error('Google Drive isn’t set up yet.');
    }

    const token = await getGoogleDriveAccessToken();
    await loadPicker();
    const doc = await openPickerAndWaitForChoice(token);

    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!downloadRes.ok) {
        throw new Error('Couldn’t download the picked file.');
    }
    const blob = await downloadRes.blob();
    const mimeType = doc.mimeType || blob.type || 'image/jpeg';
    const name = doc.name || `google-drive.${extensionForMimeType(mimeType)}`;
    return new File([blob], name, { type: mimeType });
}
