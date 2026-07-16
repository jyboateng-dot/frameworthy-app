const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Uploads an image file to Cloudinary via its unsigned upload endpoint and
 * returns the resulting secure URL. Unsigned uploads (an upload preset
 * configured as "unsigned" in the Cloudinary console) are the right pattern
 * for a client-only app like this one — no API secret ever needs to live in
 * the browser bundle, mirroring how the Firebase client SDK previously
 * uploaded directly from the browser.
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The uploaded image's secure (https) URL
 */
export const uploadImageToCloud = async (file) => {
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

/**
 * Returns a high-quality JPEG rendition of a Cloudinary-hosted image for
 * physical printing. If size and orientation data are provided, it dynamically
 * calculates the exact pixel dimensions for a 300 DPI print and instructs
 * Cloudinary to AI-upscale (e_upscale), smart crop (c_fill,g_auto), and
 * auto-enhance (e_improve) the image on the fly.
 * @param {string} url - The stored image URL (order item's `image` field)
 * @param {object} item - Optional. The order item containing size and orientation.
 * @returns {string} A print-ready JPEG URL, or the original URL if it isn't a Cloudinary asset
 */
export const getPrintQualityJpegUrl = (url, item = null) => {
    if (!url || typeof url !== 'string' || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    let transformations = ['f_jpg', 'q_100'];

    if (item && item.selectedSize && item.selectedSize.width && item.selectedSize.height) {
        // Calculate exact pixel dimensions at 300 DPI
        const targetW = Math.round(item.selectedSize.width * 300);
        const targetH = Math.round(item.selectedSize.height * 300);
        
        // Adjust for orientation
        const isLandscape = item.orientation === 'landscape';
        const finalW = isLandscape ? Math.max(targetW, targetH) : Math.min(targetW, targetH);
        const finalH = isLandscape ? Math.min(targetW, targetH) : Math.max(targetW, targetH);

        // Prepend dimension and optimization transformations
        transformations = [
            `w_${finalW}`,
            `h_${finalH}`,
            'c_fill',
            'g_auto',
            'e_upscale',
            'e_improve',
            ...transformations
        ];
    }

    const transformString = transformations.join(',');

    // If it's already a Cloudinary upload URL
    if (url.includes('res.cloudinary.com/') && url.includes('/upload/')) {
        return url.replace('/upload/', `/upload/${transformString}/`);
    }

    // For external URLs or local presets, use Cloudinary fetch API
    if (CLOUDINARY_CLOUD_NAME) {
        let fetchUrl = url;
        // Make relative paths absolute using origin
        if (url.startsWith('/')) {
            fetchUrl = window.location.origin + url;
        }
        return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transformString}/${encodeURIComponent(fetchUrl)}`;
    }

    return url;
};
