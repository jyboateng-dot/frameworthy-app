import FRAME_RAILS from '../../data/frameRails.json';
import FRAME_RENDER_PROFILES from '../../data/frameRenderProfiles.json';

/**
 * Image sources and texture compositing for the AR model.
 *
 * The catalogue ships three kinds of photograph per frame, and they are
 * not interchangeable:
 *
 *   rail strip     a straightened, tileable length of moulding
 *   corner shot    two rails meeting at a mitre
 *   flat product   the whole assembled frame, head-on
 *
 * Only the first can wrap a swept rail — it is the one asset whose
 * short axis genuinely is the moulding's cross-profile and whose long
 * axis genuinely repeats. A corner or product shot pasted onto a rail
 * tiles its own mitre and its own perspective along the moulding, which
 * reads as obviously wrong the moment the rail is longer than the
 * photograph. So the fallback chain below walks toward "less specific
 * rail photography", never toward "a different kind of photograph", and
 * bottoms out in a flat colour rather than in the wrong image.
 */

const MAX_RAIL_PX = 1024;
const MAX_ART_PX = 1024;

// Server-to-server fetches aren't CORS-restricted the way browser ones are
// — see the function's own comment in functions/index.js for why this
// exists (bymuseum.com, the Artists & Masterpieces source, sends no CORS
// headers at all, which otherwise leaves the AR texture load blocked even
// though the same URL displays fine in a plain <img>).
//
// Routed through Hosting (see firebase.json's rewrites) rather than the
// function's own Cloud Functions URL — this project's org policy blocks
// granting public (allUsers) invoker access directly on the Cloud Run
// service, which left a direct-URL deploy technically live but answering
// every request with a platform-level 403 before it ever reached the
// function's own code. Hosting invokes functions via its own pre-
// authorized service account, which sidesteps that restriction entirely.
const PROXY_BASE = '/api/proxy-artwork';

function loadImageWithCors(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Every one of these ends up drawn into a canvas that then has
        // to be read back as PNG bytes; without this the canvas is
        // tainted and toBlob throws instead of returning a texture.
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`AR texture failed to load: ${src}`));
        img.src = src;
    });
}

async function loadImage(src) {
    try {
        return await loadImageWithCors(src);
    } catch (err) {
        // Only worth a second attempt for http(s) sources the proxy might
        // actually be allowlisted for — retrying a data:/blob: URL (which
        // can't be a CORS problem in the first place) would just repeat
        // the same failure.
        if (!/^https?:\/\//i.test(src)) throw err;
        return loadImageWithCors(`${PROXY_BASE}?url=${encodeURIComponent(src)}`);
    }
}

export function canvasToPngBytes(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas produced no PNG blob'));
                return;
            }
            blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject);
        }, 'image/png');
    });
}

/**
 * Ordered candidates for a frame's rail photography, best first.
 *
 * The generated rail wins because the asset pipeline has already
 * straightened, edge-filled, colour-normalised, and checked it for
 * seamless repetition. The curated front strip remains the fallback
 * for catalogues that have not yet been through that pipeline.
 */
function railCandidates(frame) {
    const id = frame?.id;
    const profile = FRAME_RENDER_PROFILES.profiles?.[id];
    const rail = FRAME_RAILS.rails?.[id];
    const version = encodeURIComponent(FRAME_RAILS.generatedAt || 'current');

    return [
        rail?.h ? `${rail.h}?v=${version}` : null,
        profile?.frontTexture?.horizontalPath,
    ].filter(Boolean);
}

/**
 * Derive a conservative tangent-space normal map from photographed
 * moulding luminance. This is deliberately shallow: it makes grain,
 * grooves, embossing, and bevel lines respond to AR lighting without
 * pretending broad colour changes are real displacement.
 */
export function buildNormalPixels(rgba, width, height, strength = 0.65) {
    const out = new Uint8ClampedArray(rgba.length);
    const luminanceAt = (x, y) => {
        const px = Math.max(0, Math.min(width - 1, x));
        const py = Math.max(0, Math.min(height - 1, y));
        const i = (py * width + px) * 4;
        return (rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722) / 255;
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Central differences suppress single-pixel JPEG noise.
            const dx = (luminanceAt(x + 1, y) - luminanceAt(x - 1, y)) * strength;
            const dy = (luminanceAt(x, y + 1) - luminanceAt(x, y - 1)) * strength;
            const invLength = 1 / Math.hypot(dx, dy, 1);
            const i = (y * width + x) * 4;
            out[i] = Math.round((-dx * invLength * 0.5 + 0.5) * 255);
            out[i + 1] = Math.round((-dy * invLength * 0.5 + 0.5) * 255);
            out[i + 2] = Math.round(invLength * 255);
            out[i + 3] = 255;
        }
    }
    return out;
}

/**
 * The rail texture, plus the one number that makes it tile at true
 * scale.
 *
 * `aspect` is the strip's length divided by its thickness. Because the
 * thickness IS the moulding's face width — a known measurement in
 * inches from the catalogue — that ratio converts directly into how
 * many real inches one tile of this photograph covers. It is the only
 * bridge between a pixel dimension and a physical one anywhere in this
 * pipeline, which is why it is read from the decoded image rather than
 * from a manifest that could drift from the file it describes.
 *
 * Returns null when no rail photography exists, leaving the caller to
 * fall back to the frame's flat catalogue colour.
 */
export async function loadRailTexture(frame, { includeNormal = true } = {}) {
    for (const src of railCandidates(frame)) {
        try {
            const img = await loadImage(src);
            if (!img.naturalWidth || !img.naturalHeight) continue;

            const aspect = img.naturalWidth / img.naturalHeight;
            const scale = Math.min(1, MAX_RAIL_PX / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(2, Math.round(img.naturalWidth * scale));
            const h = Math.max(2, Math.round(img.naturalHeight * scale));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            if (!includeNormal) {
                return { bytes: await canvasToPngBytes(canvas), normalBytes: null, aspect };
            }

            const pixels = ctx.getImageData(0, 0, w, h);
            const normalCanvas = document.createElement('canvas');
            normalCanvas.width = w;
            normalCanvas.height = h;
            const normalCtx = normalCanvas.getContext('2d');
            const normalPixels = normalCtx.createImageData(w, h);
            normalPixels.data.set(buildNormalPixels(pixels.data, w, h));
            normalCtx.putImageData(normalPixels, 0, 0);

            const [bytes, normalBytes] = await Promise.all([
                canvasToPngBytes(canvas),
                canvasToPngBytes(normalCanvas),
            ]);
            return { bytes, normalBytes, aspect };
        } catch {
            // Try the next candidate rather than failing the whole
            // model — a missing rail costs texture fidelity, not AR.
        }
    }
    return null;
}

/**
 * A frame's real photographed mitre corner, pre-cropped to a square tile
 * by scripts/build-corner-textures.mjs. Draped over the small wedge of
 * geometry at each of the 4 corners (see frameMesh.js) so the join shows
 * actual photographed material and lighting instead of the tiled rail
 * strip continuing unbroken through the mitre.
 *
 * Returns null for the 91/341 frames with no corner photography, or if
 * the one candidate fails to load — the caller falls back to the plain
 * full-length rail sweep it already had before this existed.
 */
function cornerCandidates(frame) {
    const id = frame?.id;
    const rail = FRAME_RAILS.rails?.[id];
    const version = encodeURIComponent(FRAME_RAILS.generatedAt || 'current');
    return rail?.corner ? [`${rail.corner}?v=${version}`] : [];
}

export async function loadCornerTexture(frame) {
    for (const src of cornerCandidates(frame)) {
        try {
            const img = await loadImage(src);
            if (!img.naturalWidth || !img.naturalHeight) continue;

            const scale = Math.min(1, MAX_RAIL_PX / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(2, Math.round(img.naturalWidth * scale));
            const h = Math.max(2, Math.round(img.naturalHeight * scale));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            return { bytes: await canvasToPngBytes(canvas) };
        } catch {
            // Try the next candidate rather than failing the whole model.
        }
    }
    return null;
}

/**
 * The artwork panel, composited to the artwork's own aspect ratio.
 *
 * Cover-fits rather than letterboxes, because the panel's geometry is
 * already built to the artwork's true proportions — anything that
 * doesn't fill it would show as a coloured band inside the mat window,
 * which is not a thing a real framed piece can do.
 */
export async function renderArtworkTexture(artworkUrl, widthIn, heightIn) {
    const ratio = Math.max(0.05, widthIn / Math.max(heightIn, 0.01));
    const w = ratio >= 1 ? MAX_ART_PX : Math.round(MAX_ART_PX * ratio);
    const h = ratio >= 1 ? Math.round(MAX_ART_PX / ratio) : MAX_ART_PX;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, w);
    canvas.height = Math.max(2, h);
    const ctx = canvas.getContext('2d');

    // Neutral ground first, so a transparent PNG or a failed load still
    // produces a readable panel instead of a black hole in the frame.
    ctx.fillStyle = '#f2efea';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (artworkUrl) {
        try {
            const img = await loadImage(artworkUrl);
            const srcRatio = img.naturalWidth / img.naturalHeight;
            const dstRatio = canvas.width / canvas.height;
            let sx = 0;
            let sy = 0;
            let sw = img.naturalWidth;
            let sh = img.naturalHeight;

            if (srcRatio > dstRatio) {
                sw = img.naturalHeight * dstRatio;
                sx = (img.naturalWidth - sw) / 2;
            } else {
                sh = img.naturalWidth / dstRatio;
                sy = (img.naturalHeight - sh) / 2;
            }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        } catch {
            // Keeps the neutral ground.
        }
    }

    return canvasToPngBytes(canvas);
}

/**
 * A 2x2 swatch of a single colour.
 *
 * Used for the mat, its bevel core, and the backing board, and as the
 * rail's last resort. Both glTF and USD can express a flat base colour
 * without any image at all, but giving every material the same
 * texture-backed shape keeps the two writers from needing a separate
 * untextured code path for what is otherwise identical geometry.
 */
export async function renderSolidTexture(hex) {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = hex || '#ffffff';
    ctx.fillRect(0, 0, 2, 2);
    return canvasToPngBytes(canvas);
}
