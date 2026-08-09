// Renders the front face of the customer's current frame selection — outer
// moulding band, mat band, artwork — onto a single canvas, for use as the
// texture on the AR preview model. Same underlying facts the on-screen
// visualizer uses (frame width category, mat width in inches, artwork image),
// recomputed independently as flat concentric rectangles rather than the
// visualizer's mitred-trapezoid CSS shapes — a flat AR texture doesn't need
// the mitre illusion, it just needs the same real proportions.

import { getFrameTextureAnchor, basenameOf, TEXTURE_ZOOM_PCT, cssBackgroundWindow } from './frameTexture';
import FRAME_STRIP_MANIFEST from '../data/frameStrips.json';

const TEXTURE_PX = 1024; // Square texture; UV-mapped onto the model's actual w:h aspect, so this only controls sharpness, not shape.
const MOULDING_TILE_MAX_PX = 512; // Real strip/crop photos can be 1000px+; a repeating swatch never needs to be sharper than this.

// Mirrors CustomizeFramePage's own widthCategory -> visual thickness mapping
// (the moulding-thickness *fact* about a SKU, not a rendering technique) so
// the AR preview's proportions match what the customer already sees.
function mouldingThicknessPct(frame) {
    if (!frame?.widthCategory) return 5;
    if (frame.widthCategory === 'wide') return 10;
    if (frame.widthCategory === 'narrow') return 2;
    return 5;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function downscaleToCanvas(img, maxPx) {
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
}

// Real photographed sample of this frame's moulding material, for use as a
// repeating pattern on the AR model — the same two-tier source
// CustomizeFramePage's on-screen renderer draws from (see frameTexture.js /
// frameStrips.json), so the AR preview shows actual captured wood grain /
// carving instead of a flat colour swatch:
//   1. A reviewed tileable strip, when this frame has one — genuinely
//      seamless, built for exactly this purpose.
//   2. Otherwise, the same anchor-crop patch the 2D fallback renderer uses:
//      not verified seamless, but still real material rather than a guess.
// Returns an HTMLCanvasElement, or null if neither source is available
// (no catalogue photo at all for this frame).
export async function loadMouldingTile(frame) {
    if (!frame?.previewImg) return null;
    const stripEntry = FRAME_STRIP_MANIFEST[basenameOf(frame.previewImg)];

    if (stripEntry?.h) {
        const img = await loadImage(`/frames/strips/${stripEntry.h}`);
        return downscaleToCanvas(img, MOULDING_TILE_MAX_PX);
    }

    const anchor = await getFrameTextureAnchor(frame.previewImg);
    if (!anchor) return null;
    const img = await loadImage(frame.previewImg);
    const zoom = TEXTURE_ZOOM_PCT / 100;
    const xWindow = cssBackgroundWindow(anchor.xPct, img.naturalWidth, zoom);
    const yWindow = cssBackgroundWindow(anchor.yPct, img.naturalHeight, zoom);
    const cropW = Math.max(1, Math.round(xWindow.size));
    const cropH = Math.max(1, Math.round(yWindow.size));
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    canvas.getContext('2d').drawImage(
        img,
        xWindow.start, yWindow.start, xWindow.size, yWindow.size,
        0, 0, cropW, cropH
    );
    return canvas;
}

/**
 * @param {object} options
 * @param {{baseColor?: string, widthCategory?: string}} options.frame
 * @param {number} options.widthIn - artwork opening width, inches
 * @param {number} options.heightIn - artwork opening height, inches
 * @param {number} options.matInches - mat width, inches (0 for no mat)
 * @param {string} options.matColorHex
 * @param {string} options.artworkUrl
 * @param {HTMLCanvasElement} [options.mouldingTile] - real material sample from loadMouldingTile(), tiled across the border band; flat baseColor swatch if omitted
 * @returns {Promise<{canvas: HTMLCanvasElement, aspect: number}>}
 */
export async function renderArFrontFaceTexture({ frame, widthIn, heightIn, matInches, matColorHex, artworkUrl, mouldingTile }) {
    const aspect = widthIn / heightIn;
    const canvasW = aspect >= 1 ? TEXTURE_PX : Math.round(TEXTURE_PX * aspect);
    const canvasH = aspect >= 1 ? Math.round(TEXTURE_PX / aspect) : TEXTURE_PX;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    const minSide = Math.min(widthIn, heightIn);
    const mouldingPct = mouldingThicknessPct(frame);
    // Same normalization CustomizeFramePage uses: thickness is a fraction of
    // the SHORT side, then expressed as a fraction of each individual side
    // so a narrow piece doesn't get a disproportionately thick band on its
    // long edge.
    const mouldingFracW = (minSide / widthIn) * (mouldingPct / 100);
    const mouldingFracH = (minSide / heightIn) * (mouldingPct / 100);
    const mouldingXPx = mouldingFracW * canvasW;
    const mouldingYPx = mouldingFracH * canvasH;

    // 1. Moulding band fills the whole canvas; mat+artwork drawn on top inset.
    // A real material sample is tiled at roughly the border's own thickness
    // (matching how the 2D renderer's strip fills the band), rather than
    // stretched or flattened to a single swatch colour.
    if (mouldingTile && mouldingTile.width > 0 && mouldingTile.height > 0) {
        const pattern = ctx.createPattern(mouldingTile, 'repeat');
        const scale = mouldingYPx > 0 ? mouldingYPx / mouldingTile.height : 1;
        if (pattern.setTransform) pattern.setTransform(new DOMMatrix().scale(scale));
        ctx.fillStyle = pattern;
    } else {
        ctx.fillStyle = frame?.baseColor || '#8b4513';
    }
    ctx.fillRect(0, 0, canvasW, canvasH);

    const innerX = mouldingXPx;
    const innerY = mouldingYPx;
    const innerW = canvasW - mouldingXPx * 2;
    const innerH = canvasH - mouldingYPx * 2;

    // 2. Mat band (if any), same real-inch width converted to this face's px scale.
    const matFracW = matInches > 0 ? matInches / widthIn : 0;
    const matFracH = matInches > 0 ? matInches / heightIn : 0;
    const matXPx = matFracW * canvasW;
    const matYPx = matFracH * canvasH;

    ctx.fillStyle = matColorHex || '#ffffff';
    ctx.fillRect(innerX, innerY, innerW, innerH);

    // 3. Artwork, cover-fit into the opening inside the mat.
    const artX = innerX + matXPx;
    const artY = innerY + matYPx;
    const artW = innerW - matXPx * 2;
    const artH = innerH - matYPx * 2;

    if (artworkUrl && artW > 0 && artH > 0) {
        const img = await loadImage(artworkUrl);
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const boxAspect = artW / artH;
        let sx, sy, sw, sh;
        if (imgAspect > boxAspect) {
            sh = img.naturalHeight;
            sw = sh * boxAspect;
            sx = (img.naturalWidth - sw) / 2;
            sy = 0;
        } else {
            sw = img.naturalWidth;
            sh = sw / boxAspect;
            sx = 0;
            sy = (img.naturalHeight - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, artX, artY, artW, artH);
    }

    return { canvas, aspect };
}

export function canvasToPngBytes(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('canvas.toBlob failed')); return; }
            resolve(new Uint8Array(await blob.arrayBuffer()));
        }, 'image/png');
    });
}
