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
/**
 * Downsizes a catalogue browsing thumbnail via Cloudinary's on-the-fly
 * transforms — the raw URLs stored in the catalogue data files are full
 * originals, which is wasteful for a grid card. c_limit preserves aspect
 * ratio (no cropping) since catalogue images span very different ratios
 * (square album art, 2:3 movie posters, portrait paintings, etc).
 * @param {string} url
 * @param {number} width - target max width in px
 * @returns {string} a transformed thumbnail URL, or the original if it isn't a Cloudinary asset
 */
export const getThumbnailUrl = (url, width = 400) => {
    if (!url || typeof url !== 'string') return url;
    if (url.includes('res.cloudinary.com/') && url.includes('/upload/')) {
        return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`);
    }
    return url;
};

export const getPrintQualityJpegUrl = (url, item = null) => {
    if (!url || typeof url !== 'string' || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    // Large formats where a flat 300 DPI would exceed Cloudinary's 25MP
    // output cap get a server-generated file once the order is paid (see
    // functions/hiResPrintFile.js) that isn't limited by that cap — prefer it
    // outright once it exists instead of re-deriving the capped version here.
    if (item && item.hiResPrintUrl) {
        return item.hiResPrintUrl;
    }

    // Each entry is a separate Cloudinary transformation step, chained with "/".
    let steps = ['f_jpg,q_100'];

    if (item && item.selectedSize && item.selectedSize.width && item.selectedSize.height) {
        // Calculate exact pixel dimensions at 300 DPI
        const targetW = Math.round(item.selectedSize.width * 300);
        const targetH = Math.round(item.selectedSize.height * 300);

        // Adjust for orientation
        const isLandscape = item.orientation === 'landscape';
        let finalW = isLandscape ? Math.max(targetW, targetH) : Math.min(targetW, targetH);
        let finalH = isLandscape ? Math.min(targetW, targetH) : Math.max(targetW, targetH);

        // Cloudinary hard-caps any derived image at 25 megapixels total, which
        // a flat 300 DPI blows past for large formats (e.g. 24x36in = 77.8MP)
        // and would otherwise make Cloudinary reject the whole transformation.
        // Scale the DPI down uniformly (preserving aspect ratio) so the
        // request stays under that ceiling — still the highest resolution
        // Cloudinary can actually deliver for that physical size.
        const MAX_OUTPUT_PIXELS = 24_900_000;
        const requestedPixels = finalW * finalH;
        let quality = 'q_100';
        if (requestedPixels > MAX_OUTPUT_PIXELS) {
            const scale = Math.sqrt(MAX_OUTPUT_PIXELS / requestedPixels);
            finalW = Math.floor(finalW * scale);
            finalH = Math.floor(finalH * scale);
            // At this pixel count, a q_100 JPEG is big enough in bytes to trip
            // Cloudinary's separate 10MB-per-derived-file cap. q_90 is still
            // effectively lossless for print and stays comfortably under it.
            quality = 'q_90';
        }

        // e_upscale only accepts source images under ~4.2 megapixels, and
        // Cloudinary silently drops it (no error, no effect) when it's
        // chained in the same step as another effect like e_improve — so it
        // has to run alone, as its own step, directly against the untouched
        // original. Nested conditionals gate it twice: the outer check skips
        // sources already too large for the effect to accept, and the inner
        // check skips sources that already meet or exceed the customer's
        // chosen print dimensions — an image that's already high enough
        // resolution for the target size doesn't need (or benefit from) AI
        // upscaling.
        steps = [
            'if_iw_lt_2000_and_ih_lt_2000',
            `if_iw_lt_${finalW}_or_ih_lt_${finalH}`,
            'e_upscale',
            'if_end',
            'if_end',
            `w_${finalW},h_${finalH},c_fill,g_auto,e_improve`,
            `f_jpg,${quality}`
        ];
    }

    const transformString = steps.join('/');

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
