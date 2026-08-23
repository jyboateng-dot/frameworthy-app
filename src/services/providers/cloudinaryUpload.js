const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Uploads an image file to Cloudinary via its unsigned upload endpoint and
 * returns the resulting secure URL. Unsigned uploads (an upload preset
 * configured as "unsigned" in the Cloudinary console) are the right pattern
 * for a client-only app like this one — no API secret ever needs to live in
 * the browser bundle.
 *
 * Kept as a live, working fallback even while ImageKit is the active
 * provider (see storage.js) — flipping VITE_IMAGE_UPLOAD_PROVIDER back to
 * 'cloudinary' is the entire migration back, no code changes needed.
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The uploaded image's secure (https) URL
 */
export const uploadToCloudinary = async (file) => {
    if (!file) throw new Error("No file provided");
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error("Cloudinary is not configured — set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env.local");
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error?.message || `Cloudinary upload failed (${response.status})`);
    }

    const data = await response.json();
    return data.secure_url;
};
