import { uploadToCloudinary } from './providers/cloudinaryUpload';
import { uploadToImageKit } from './providers/imagekitUpload';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

// Which provider handles NEW uploads. Read/transform (getThumbnailUrl,
// getPrintQualityJpegUrl below) needs no such switch — it already infers
// the provider from each URL's own shape, so old Cloudinary-hosted assets
// and new ImageKit-hosted ones are both handled correctly regardless of
// this setting. Flipping this back to 'cloudinary' (e.g. once Cloudinary's
// credits reset, or if ImageKit has an outage of its own) is the entire
// migration back — no code changes.
const UPLOAD_PROVIDER = import.meta.env.VITE_IMAGE_UPLOAD_PROVIDER || 'imagekit';

/**
 * Uploads an image file to the active cloud image provider and returns the
 * resulting URL. See UPLOAD_PROVIDER above for how the provider is chosen.
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The uploaded image's URL
 */
export const uploadImageToCloud = (file) =>
    UPLOAD_PROVIDER === 'cloudinary' ? uploadToCloudinary(file) : uploadToImageKit(file);

/**
 * Downsizes a catalogue browsing thumbnail via the hosting provider's
 * on-the-fly transforms — the raw URLs stored in the catalogue data files
 * are full originals, which is wasteful for a grid card. The "fit within,
 * don't crop" transform is used (Cloudinary's c_limit / ImageKit's
 * c-at_max) since catalogue images span very different aspect ratios
 * (square album art, 2:3 movie posters, portrait paintings, etc).
 * @param {string} url
 * @param {number} width - target max width in px
 * @returns {string} a transformed thumbnail URL, or the original if its host isn't recognized
 */
export const getThumbnailUrl = (url, width = 400) => {
    if (!url || typeof url !== 'string') return url;
    // Rijksmuseum and NGA IIIF records can point at the uncapped or 843px
    // image. Request a grid-sized derivative instead of downloading large
    // artwork files for thumbnails.
    if (/\/full\/(?:max|!?\d+,\d+|\d+,)\//.test(url)) {
        return url.replace(/\/full\/(?:max|!?\d+,\d+|\d+,)\//, `/full/${width},/`);
    }
    if (url.includes('res.cloudinary.com/') && url.includes('/upload/')) {
        return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`);
    }
    if (url.includes('ik.imagekit.io/')) {
        return insertImageKitTransform(url, `w-${width},c-at_max,q-80`);
    }
    return url;
};

/**
 * Returns a high-quality JPEG rendition of a stored image for physical
 * printing. If size and orientation data are provided, it dynamically
 * calculates the exact pixel dimensions for a 300 DPI print and instructs
 * the hosting provider to smart-crop the image to those dimensions on the
 * fly. Deliberately no AI upscaling and, on the ImageKit path, no AI
 * auto-enhance either — the print house runs its own Topaz Labs/Adobe
 * Super Resolution upscaling downstream, so doing it again client-side
 * would just double-process the image for no quality gain (upscaling), and
 * ImageKit's AI enhance is a separately metered feature unlike Cloudinary's
 * free e_improve, not worth the per-image cost for a transform the print
 * house's own pipeline already covers in effect. Print quality is instead
 * enforced upstream, at the catalogue level, via a DPI floor on what gets
 * listed at all.
 * @param {string} url - The stored image URL (order item's `image` field)
 * @param {object} item - Optional. The order item containing size and orientation.
 * @returns {string} A print-ready JPEG URL, or the original URL if its host isn't recognized
 */
export const getPrintQualityJpegUrl = (url, item = null) => {
    if (item?.productionSpec?.printIsCropped) return url;
    if (!url || typeof url !== 'string' || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    let sizeDims = null;
    if (item && item.selectedSize && item.selectedSize.width && item.selectedSize.height) {
        // Calculate exact pixel dimensions at 300 DPI
        const targetW = Math.round(item.selectedSize.width * 300);
        const targetH = Math.round(item.selectedSize.height * 300);

        // Adjust for orientation
        const isLandscape = item.orientation === 'landscape';
        sizeDims = {
            finalW: isLandscape ? Math.max(targetW, targetH) : Math.min(targetW, targetH),
            finalH: isLandscape ? Math.min(targetW, targetH) : Math.max(targetW, targetH),
        };
    }

    if (url.includes('ik.imagekit.io/')) {
        const transform = sizeDims
            ? `w-${sizeDims.finalW},h-${sizeDims.finalH},fo-auto,f-jpg,q-100`
            : 'f-jpg,q-100';
        return insertImageKitTransform(url, transform);
    }

    // Cloudinary transform string. No e_upscale — see the doc comment
    // above: the print house handles upscaling.
    let transformations = sizeDims
        ? [`w_${sizeDims.finalW}`, `h_${sizeDims.finalH}`, 'c_fill', 'g_auto', 'e_improve', 'f_jpg', 'q_100']
        : ['f_jpg', 'q_100'];
    const transformString = transformations.join(',');

    // If it's already a Cloudinary upload URL
    if (url.includes('res.cloudinary.com/') && url.includes('/upload/')) {
        return url.replace('/upload/', `/upload/${transformString}/`);
    }

    // For external URLs or local presets, use Cloudinary's fetch API — kept
    // as the catch-all regardless of the active upload provider, since
    // VITE_CLOUDINARY_CLOUD_NAME stays configured either way.
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

// Inserts an ImageKit path-based transform (e.g. "w-400,c-at_max") right
// after the URL endpoint segment: https://ik.imagekit.io/<endpoint>/tr:<transform>/<path>.
// Falls back to the untransformed URL if it doesn't match ImageKit's known
// shape, rather than producing a broken URL.
//
// Strips any existing tr:...  segment first rather than just prepending —
// several catalogue pages call getThumbnailUrl twice on the same image
// (once building the product list, once again in the card component).
// That was harmless on Cloudinary, whose URLs tolerate a redundant
// transform segment, but stacking two tr: segments on an ImageKit URL
// produces an unparseable path the CDN 400s on, so this has to be
// idempotent rather than assume it only ever runs once per URL.
const insertImageKitTransform = (url, transform) => {
    const match = url.match(/^(https:\/\/ik\.imagekit\.io\/[^/]+\/)(?:tr:[^/]+\/)?(.*)$/);
    if (!match) return url;
    const [, prefix, rest] = match;
    return `${prefix}tr:${transform}/${rest}`;
};
