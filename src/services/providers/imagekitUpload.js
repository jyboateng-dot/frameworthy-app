import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// ImageKit has no unsigned-upload equivalent to Cloudinary's upload preset —
// every client upload needs a token/expire/signature triple, and the
// signature can only be computed with the *private* key, which must never
// reach the browser. getImageKitUploadAuth (functions/index.js) is that
// computation; this just calls it and forwards the result.
const getUploadAuth = httpsCallable(functions, 'getImageKitUploadAuth');

const PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
const URL_ENDPOINT = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;

/**
 * Uploads an image file to ImageKit and returns its URL.
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The uploaded image's URL
 */
export const uploadToImageKit = async (file) => {
    if (!file) throw new Error("No file provided");
    if (!PUBLIC_KEY || !URL_ENDPOINT) {
        throw new Error("ImageKit is not configured — set VITE_IMAGEKIT_PUBLIC_KEY and VITE_IMAGEKIT_URL_ENDPOINT in .env.local");
    }

    const { data: auth } = await getUploadAuth();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name || `upload-${Date.now()}`);
    formData.append('publicKey', PUBLIC_KEY);
    formData.append('signature', auth.signature);
    formData.append('expire', auth.expire);
    formData.append('token', auth.token);
    formData.append('useUniqueFileName', 'true');

    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message || `ImageKit upload failed (${response.status})`);
    }

    const data = await response.json();
    return data.url;
};
