import { Capacitor } from '@capacitor/core';
import { imageCrop } from '../utils/frameFit';
import { loadImageCached } from '../utils/imageCache';
import { uploadImageToCloud } from './storage';
import { buildPrintQualitySpec, TARGET_PRINT_DPI } from '../utils/printQuality';

const IN_TO_CM = 2.54;
const MOBILE_MAX_CANVAS_PIXELS = 16_000_000;
const DESKTOP_MAX_CANVAS_PIXELS = 60_000_000;
const GEOMETRY_DIMENSIONS = [
    'width', 'height', 'mat', 'rail', 'outerWidth', 'outerHeight',
    'apertureWidth', 'apertureHeight',
];
// The preview is only ever shown as a small thumbnail (cart, checkout, admin),
// so a lossless PNG was several times larger than it needed to be. JPEG has no
// alpha, so the area around the frame is filled with the same off-white the
// Prodigi order preview already uses.
const THUMBNAIL_BACKGROUND = '#faf9f7';
const THUMBNAIL_QUALITY = 0.85;

const toCentimetres = (geometry) => Object.fromEntries(
    GEOMETRY_DIMENSIONS.map((key) => [key, geometry[key] * IN_TO_CM])
);

/**
 * Crops the artwork to the frame opening, uploads the print file and a preview
 * thumbnail, and returns the cart/order fields describing them.
 *
 * The two uploads run in parallel. With `deferThumbnail`, only the print file
 * (which the order genuinely needs) is awaited; the preview keeps uploading and
 * is handed back as `thumbnailUpload`, a promise that resolves to the preview
 * URL, or null if it failed (callers fall back to the artwork image). That
 * property is not part of the cart item and must not be spread into it.
 */
export async function prepareFrameOutput(source, geometry, position, frameColor, matColor, {
    deferThumbnail = false,
    isMobile,
    frame = null,
    minimumDpi,
    contentBounds = null,
} = {}) {
    const image = await loadImageCached(source);
    const crop = imageCrop({ w: image.naturalWidth, h: image.naturalHeight }, geometry, position, minimumDpi, contentBounds);
    if (!crop) throw new Error('The frame opening is too small. Adjust the mount width.');
    const print = document.createElement('canvas');
    const maxFrameEdgeIn = Math.max(
        geometry.apertureWidth || 0,
        geometry.apertureHeight || 0,
        geometry.width || 0,
        geometry.height || 0
    );
    const maxPrintPx = Math.min(16000, Math.max(6000, Math.ceil(maxFrameEdgeIn * TARGET_PRINT_DPI)));
    const isMobilePlatform = typeof isMobile === 'boolean'
        ? isMobile
        : (Capacitor.isNativePlatform()
            || (typeof window !== 'undefined' && (
                window.innerWidth < 1024
                || Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
            )));
    const maxCanvasPixels = isMobilePlatform ? MOBILE_MAX_CANVAS_PIXELS : DESKTOP_MAX_CANVAS_PIXELS;
    const edgeScale = maxPrintPx / Math.max(crop.w, crop.h);
    const areaScale = Math.sqrt(maxCanvasPixels / Math.max(1, crop.w * crop.h));
    const scale = Math.min(1, edgeScale, areaScale);
    print.width = Math.max(1, Math.round(crop.w * scale));
    print.height = Math.max(1, Math.round(crop.h * scale));
    const printQuality = buildPrintQualitySpec({
        sourceSize: { w: image.naturalWidth, h: image.naturalHeight },
        geometry,
        position,
        frame,
        minimumDpi,
        outputSize: { w: print.width, h: print.height },
        assetKind: 'browser-rendered',
    });
    if (!printQuality?.passed) {
        const effective = Math.floor(printQuality?.effectiveDpi || 0);
        throw new Error(`This adjusted crop would produce about ${effective} DPI. Reset the image position or choose a smaller size.`);
    }
    const ctx = print.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, print.width, print.height);
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, print.width, print.height);
    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 1200;
    const t = thumb.getContext('2d');
    t.fillStyle = THUMBNAIL_BACKGROUND;
    t.fillRect(0, 0, 1200, 1200);
    const ratio = 1056 / Math.max(geometry.outerWidth, geometry.outerHeight);
    const x = (1200 - geometry.outerWidth * ratio) / 2;
    const y = (1200 - geometry.outerHeight * ratio) / 2;
    t.fillStyle = frameColor;
    t.fillRect(x, y, geometry.outerWidth * ratio, geometry.outerHeight * ratio);
    t.fillStyle = matColor;
    t.fillRect(x + geometry.rail * ratio, y + geometry.rail * ratio, geometry.width * ratio, geometry.height * ratio);
    t.drawImage(print, x + (geometry.rail + geometry.mat) * ratio, y + (geometry.rail + geometry.mat) * ratio,
        geometry.apertureWidth * ratio, geometry.apertureHeight * ratio);
    const upload = async (canvas, name, type, quality) => {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
        if (!blob) throw new Error('Could not prepare your frame. Please try again.');
        return uploadImageToCloud(new File([blob], name, { type }));
    };
    // Both uploads start now. Print quality is deliberately unchanged.
    const productionUpload = upload(print, 'frame-print.jpg', 'image/jpeg', 0.98);
    const thumbnailUpload = upload(thumb, 'frame-preview.jpg', 'image/jpeg', THUMBNAIL_QUALITY);

    let productionImage;
    let visualizerImage = null;
    let deferredThumbnail;
    if (deferThumbnail) {
        // Attach the handler immediately so a failed preview can never surface
        // as an unhandled rejection, even if the print upload throws first.
        deferredThumbnail = thumbnailUpload.catch((error) => {
            console.warn('Order thumbnail upload failed, falling back to the artwork image:', error);
            return null;
        });
        productionImage = await productionUpload;
    } else {
        [productionImage, visualizerImage] = await Promise.all([productionUpload, thumbnailUpload]);
    }
    const productionGeometry = toCentimetres(geometry);
    return {
        productionImage,
        visualizerImage,
        printQuality: { ...printQuality, assetUrl: productionImage },
        ...(deferThumbnail ? { thumbnailUpload: deferredThumbnail } : {}),
        productionSpec: {
            version: 2,
            units: 'cm',
            ...productionGeometry,
            position,
            crop,
            sourceWidth: image.naturalWidth,
            sourceHeight: image.naturalHeight,
            top: productionGeometry.mat,
            bottom: productionGeometry.mat,
            left: productionGeometry.mat,
            right: productionGeometry.mat,
            printWidthPx: print.width,
            printHeightPx: print.height,
            printIsCropped: true,
        },
    };
}

