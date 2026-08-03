const sharp = require('sharp');
const { logger } = require('firebase-functions');

const DPI = 300;

// Mirrors the cap in src/services/storage.js's getPrintQualityJpegUrl —
// Cloudinary hard-rejects any derived image over ~25 megapixels, so a flat
// 300 DPI print target above that must be served at a lower DPI by Cloudinary
// itself. This module exists to claw that lost DPI back for the handful of
// large-format sizes where it drops too far below a usable floor: Cloudinary
// still does the AI upscale + smart crop (the parts worth reusing), then this
// takes over for the final upscale past Cloudinary's own ceiling.
const CLOUDINARY_MAX_OUTPUT_PIXELS = 24_900_000;

// Below this, a large-format print is soft enough at normal wall-viewing
// distance to be worth the extra processing; above it, Cloudinary's own
// output (already fixed to use its full 300 DPI budget) is good enough on
// its own and escalating would just burn compute for no visible gain.
const HI_RES_DPI_FLOOR = 150;

// Physical print pixel dimensions at 300 DPI, orientation-adjusted — the same
// math getPrintQualityJpegUrl uses client-side.
function computePrintDimensions(selectedSize, orientation) {
    const targetW = Math.round(selectedSize.width * DPI);
    const targetH = Math.round(selectedSize.height * DPI);
    const isLandscape = orientation === 'landscape';
    const finalW = isLandscape ? Math.max(targetW, targetH) : Math.min(targetW, targetH);
    const finalH = isLandscape ? Math.min(targetW, targetH) : Math.max(targetW, targetH);
    return { finalW, finalH };
}

// Scales (finalW, finalH) down to fit Cloudinary's output cap, preserving
// aspect ratio. Returns wasCapped: false untouched when already under it.
function capToCloudinaryLimit(finalW, finalH) {
    const requestedPixels = finalW * finalH;
    if (requestedPixels <= CLOUDINARY_MAX_OUTPUT_PIXELS) {
        return { cappedW: finalW, cappedH: finalH, wasCapped: false };
    }
    const scale = Math.sqrt(CLOUDINARY_MAX_OUTPUT_PIXELS / requestedPixels);
    return {
        cappedW: Math.floor(finalW * scale),
        cappedH: Math.floor(finalH * scale),
        wasCapped: true
    };
}

// True only for the subset of orders where Cloudinary's own 25MP-capped
// output would fall below a usable large-format DPI floor — everything else
// is already well served by the existing Cloudinary-only pipeline.
function needsHiResEscalation(item) {
    if (!item?.selectedSize?.width || !item?.selectedSize?.height) return false;
    const { finalW, finalH } = computePrintDimensions(item.selectedSize, item.orientation);
    const { cappedW, wasCapped } = capToCloudinaryLimit(finalW, finalH);
    if (!wasCapped) return false;
    const effectiveDpi = (cappedW / finalW) * DPI;
    return effectiveDpi < HI_RES_DPI_FLOOR;
}

// Same conditional e_upscale gating as getPrintQualityJpegUrl (src/services/storage.js):
// run it only against the untouched original, only when the source is small
// enough for the effect to accept, and only when it's actually smaller than
// the (capped) target. Requested at the Cloudinary-capped size — Cloudinary
// does all the compositional work (aspect-ratio crop, subject-aware framing,
// AI upscale) here, so the sharp pass below never has to crop, only enlarge.
function buildCappedIntermediateUrl(imageUrl, cappedW, cappedH) {
    const steps = [
        'if_iw_lt_2000_and_ih_lt_2000',
        `if_iw_lt_${cappedW}_or_ih_lt_${cappedH}`,
        'e_upscale',
        'if_end',
        'if_end',
        `w_${cappedW},h_${cappedH},c_fill,g_auto,e_improve`,
        'f_jpg,q_90'
    ];
    const transformString = steps.join('/');
    return imageUrl.replace('/upload/', `/upload/${transformString}/`);
}

// Fetches Cloudinary's best-effort (capped) rendition, then uses sharp to do
// the final proportional upscale to the true, uncapped print target. Source
// and intermediate share the exact same aspect ratio by construction, so this
// is a plain enlarge — no cropping or repositioning needed here.
async function generateHiResBuffer(item) {
    const { finalW, finalH } = computePrintDimensions(item.selectedSize, item.orientation);
    const { cappedW, cappedH } = capToCloudinaryLimit(finalW, finalH);

    const intermediateUrl = buildCappedIntermediateUrl(item.image, cappedW, cappedH);
    const response = await fetch(intermediateUrl);
    if (!response.ok) {
        throw new Error(`Cloudinary intermediate fetch failed (${response.status}): ${intermediateUrl}`);
    }
    const inputBuffer = Buffer.from(await response.arrayBuffer());

    return sharp(inputBuffer)
        .resize(finalW, finalH, { fit: 'fill', kernel: 'lanczos3' })
        .jpeg({ quality: 95, mozjpeg: true })
        .toBuffer();
}

// Uploads a generated buffer to Cloudinary under a dedicated folder, signed
// with real API credentials (this runs server-side, unlike the client's
// unsigned upload) so it can be organized and never collides with
// customer-submitted assets.
async function uploadHiResBuffer({ buffer, orderId, itemIndex, cloudName, apiKey, apiSecret }) {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `hi_res_prints/${orderId}_${itemIndex}`;
    const paramsToSign = `folder=hi_res_prints&public_id=${orderId}_${itemIndex}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'image/jpeg' }));
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder', 'hi_res_prints');
    formData.append('public_id', `${orderId}_${itemIndex}`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    });
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Cloudinary upload failed (${response.status}): ${body}`);
    }
    const data = await response.json();
    return data.secure_url ?? publicId;
}

// Runs the whole escalation for one order: generates + uploads a hi-res file
// for every qualifying item, returning { itemIndex: url } for the ones that
// succeeded. Failures are logged and skipped per-item — one bad source image
// shouldn't block the rest of the order, and the existing Cloudinary-only URL
// remains a perfectly good fallback for any item this doesn't cover.
async function processOrderForHiResPrints(orderId, order, cloudinaryConfig) {
    const items = order.items || [];
    const results = {};

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!needsHiResEscalation(item)) continue;

        try {
            const buffer = await generateHiResBuffer(item);
            const url = await uploadHiResBuffer({
                buffer,
                orderId,
                itemIndex: i,
                ...cloudinaryConfig
            });
            results[i] = url;
        } catch (err) {
            logger.error('Hi-res print file generation failed for order item', {
                orderId, itemIndex: i, error: err.message
            });
        }
    }

    return results;
}

module.exports = {
    DPI,
    CLOUDINARY_MAX_OUTPUT_PIXELS,
    HI_RES_DPI_FLOOR,
    computePrintDimensions,
    capToCloudinaryLimit,
    needsHiResEscalation,
    buildCappedIntermediateUrl,
    generateHiResBuffer,
    uploadHiResBuffer,
    processOrderForHiResPrints
};
