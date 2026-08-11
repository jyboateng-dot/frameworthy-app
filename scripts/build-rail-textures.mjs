/**
 * Generates the tileable moulding-rail textures the 2D visualizer paints
 * onto each side of a frame.
 *
 * For every frame in src/data/frameCatalogue.json this emits a pair under
 * public/frames/rails/:
 *
 *   frame-<sku>-rail-h.webp   tiles left-to-right, for the top/bottom rails
 *   frame-<sku>-rail-v.webp   the same strip rotated, for the left/right rails
 *
 * The vertical strip is rotated here rather than with a CSS transform so
 * the browser tiles a genuinely vertical image; rotating at render time
 * needs overscan hacks to hide the transformed bounding box and still
 * tiles along the wrong axis.
 *
 * In every strip the SHORT axis is the moulding's cross-profile, running
 * outer edge -> inner edge, and the long axis is the direction the rail
 * repeats. Keeping that invariant is what lets the renderer light the
 * bevel correctly without knowing which source the texture came from.
 *
 * Four extraction paths, in descending fidelity. Which one a frame uses is
 * recorded in the manifest as `quality` so a derived strip is never
 * mistaken for a scanned one.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const CATALOGUE = 'src/data/frameCatalogue.json';
const ASSET_ROOT = 'frame assets';
const OUT_DIR = 'public/frames/rails';
const MANIFEST = 'src/data/frameRails.json';

// Long enough to keep detail when tiled across a large frame, small enough
// that 335 pairs stay a reasonable payload.
const STRIP_LENGTH = 1024;
const MAX_THICKNESS = 256;
// Corner-derived rails can retain a sliver of the photographed sweep or
// mitre at either terminal. Those slivers repeat as bright cross-seams in
// the visualizer, so remove them before the rail is normalized for tiling.
const DERIVED_END_TRIM_RATIO = 0.06;

const toDisk = (p) => p.replace('/frames/assets', ASSET_ROOT);

/* ------------------------------------------------------------------ *
 * Background / mask helpers
 * ------------------------------------------------------------------ */

// Product shots sit on a near-white sweep. Anything materially darker or
// more saturated than the corners is treated as moulding.
function backgroundLevel(data, info) {
    const corners = [];
    const probe = (x, y) => {
        const i = (y * info.width + x) * info.channels;
        corners.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    };
    const m = 4;
    probe(m, m);
    probe(info.width - 1 - m, m);
    probe(m, info.height - 1 - m);
    probe(info.width - 1 - m, info.height - 1 - m);
    corners.sort((a, b) => a - b);
    return (corners[1] + corners[2]) / 2;
}

function luminanceAt(data, info, x, y) {
    const i = (y * info.width + x) * info.channels;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
}

/**
 * A fixed contrast threshold cannot separate moulding from sweep across
 * this catalogue: a near-white frame on a near-white background differs by
 * only a few levels, so a constant cutoff either misses the frame entirely
 * or swallows the background. Deriving the cutoff from how far the darkest
 * few percent of the image actually sit below the background adapts to
 * both ends — pale frames get a tight threshold, dark ones a generous one.
 */
function maskThreshold(data, info, bg) {
    const step = Math.max(1, Math.floor((info.width * info.height) / 20000));
    const samples = [];
    for (let p = 0; p < info.width * info.height; p += step) {
        const i = p * info.channels;
        samples.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }
    samples.sort((a, b) => a - b);
    const p02 = samples[Math.floor(samples.length * 0.02)];
    const spread = Math.max(0, bg - p02);
    // A third of the way down from the sweep, clamped so a very flat image
    // still demands a real difference and a very contrasty one stays loose.
    return Math.min(40, Math.max(6, spread / 3));
}

/* ------------------------------------------------------------------ *
 * Extractors
 * ------------------------------------------------------------------ */

/**
 * `framingengine` scans and the short bare-SKU strips are already flat,
 * straight-on and full-bleed: the moulding spans the whole frame of the
 * image with the profile running top-to-bottom. Only the incidental
 * background rows at the very edge need trimming.
 */
async function fromFlatScan(file) {
    const img = sharp(file).removeAlpha();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const bg = backgroundLevel(data, info);
    const isBg = (lum) => Math.abs(lum - bg) < 12 && bg > 200;

    const midX = Math.floor(info.width / 2);
    let top = 0;
    let bottom = info.height - 1;
    while (top < bottom && isBg(luminanceAt(data, info, midX, top))) top++;
    while (bottom > top && isBg(luminanceAt(data, info, midX, bottom))) bottom--;

    const height = bottom - top + 1;
    if (height < 8) return null;

    // A scan is of a physical length of moulding, so both ends show the
    // sawn cut — a pale end-grain band that tiles into a hard seam every
    // repeat. Dropping a little from each end costs nothing: the strip is
    // resampled to a fixed length anyway.
    // Supplier rail photos can place a deep, angled mitre/end-cap well inside
    // one side of the image (not merely at the outer few pixels). Keep only
    // the central, parallel section: it is the part that can be repeated
    // continuously around a rendered frame without creating cross-seams.
    const trim = Math.floor(info.width * 0.18);
    const left = trim;
    const width = info.width - trim * 2;
    if (width < 64) return sharp(file).removeAlpha().extract({ left: 0, top, width: info.width, height });
    return sharp(file).removeAlpha().extract({ left, top, width, height });
}

/**
 * The `swap` renders show a complete frame around a flat placeholder
 * interior. The top rail is the band between the outer edge and the
 * opening; sampling it only across the opening's width keeps both mitred
 * corners out of the crop, which would otherwise repeat as a diagonal
 * seam every tile.
 */
async function fromAssembled(file) {
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const bg = backgroundLevel(data, info);
    const midX = Math.floor(info.width / 2);
    const midY = Math.floor(info.height / 2);

    // The interior is the long uniform run through the middle of the image.
    const interior = luminanceAt(data, info, midX, midY);
    const sameAsInterior = (lum) => Math.abs(lum - interior) < 10;

    let openTop = midY;
    while (openTop > 0 && sameAsInterior(luminanceAt(data, info, midX, openTop - 1))) openTop--;
    let openLeft = midX;
    while (openLeft > 0 && sameAsInterior(luminanceAt(data, info, openLeft - 1, midY))) openLeft--;
    let openRight = midX;
    while (openRight < info.width - 1 && sameAsInterior(luminanceAt(data, info, openRight + 1, midY))) openRight++;

    // Outer edge of the frame, above the opening.
    let outerTop = 0;
    while (
        outerTop < openTop &&
        Math.abs(luminanceAt(data, info, midX, outerTop) - bg) < 12 &&
        bg > 200
    ) {
        outerTop++;
    }

    const height = openTop - outerTop;
    const width = openRight - openLeft;
    if (height < 8 || width < 32) return null;
    return sharp(file)
        .removeAlpha()
        .extract({ left: openLeft, top: outerTop, width, height });
}

/**
 * Corner shots are three-quarter product photos of a mitred joint, so a
 * leg runs at a slight angle rather than square to the image. Taking one
 * leg and resampling column by column between its detected outer and
 * inner edges removes that tilt — a per-column shear correction. It
 * cannot recover true perspective foreshortening, so the result is
 * flagged `derived` and only used where nothing flatter exists.
 */
/** Per-column vertical extent of the moulding, or null where absent. */
function columnSpans(data, info, isFrame, minRun) {
    const spans = [];
    for (let x = 0; x < info.width; x++) {
        let top = -1;
        let bot = -1;
        for (let y = 0; y < info.height; y++) {
            if (isFrame(x, y)) {
                if (top < 0) top = y;
                bot = y;
            }
        }
        spans.push(top >= 0 && bot - top >= minRun ? { top, bot } : null);
    }
    return spans;
}

/** Least-squares gradient of y against x. */
function fitSlope(points) {
    const n = points.length;
    if (n < 8) return null;
    let sx = 0;
    let sy = 0;
    let sxy = 0;
    let sxx = 0;
    for (const [x, y] of points) {
        sx += x;
        sy += y;
        sxy += x * y;
        sxx += x * x;
    }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-6) return null;
    return (n * sxy - sx * sy) / denom;
}

/**
 * Corner shots photograph a mitred joint head-on, so the moulding forms a
 * chevron: two legs meeting at roughly 45 degrees at a vertex. Sampling
 * columns straight down the image therefore cuts across BOTH legs and
 * smears them together — the first attempt at this produced exactly that.
 *
 * Instead: find the vertex, keep only the leg to one side of it, measure
 * that leg's angle from its outer edge, rotate the image until the leg is
 * level, and only then sample the band. Rotation is what makes the sample
 * a real rail rather than a diagonal slice through one.
 *
 * This still cannot undo perspective foreshortening — the far end of a leg
 * is genuinely smaller than the near end — so the result is marked
 * `derived-from-corner` and only used when no flat scan exists.
 */
async function fromCorner(file) {
    const base = sharp(file).removeAlpha();
    const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
    const bg = backgroundLevel(data, info);
    const thr = maskThreshold(data, info, bg);
    const isFrame = (x, y) => Math.abs(luminanceAt(data, info, x, y) - bg) > thr;

    const spans = columnSpans(data, info, isFrame, 6);
    const present = spans.map((s, x) => (s ? x : -1)).filter((x) => x >= 0);
    if (present.length < 80) return null;

    // Vertex = column whose moulding reaches furthest down the image.
    let vertexX = present[0];
    let vertexY = -1;
    for (const x of present) {
        if (spans[x].bot > vertexY) {
            vertexY = spans[x].bot;
            vertexX = x;
        }
    }

    // Choose the longer leg either side of the vertex.
    const leftLen = vertexX - present[0];
    const rightLen = present[present.length - 1] - vertexX;
    const useLeft = leftLen >= rightLen;
    const legStart = useLeft ? present[0] : vertexX;
    const legEnd = useLeft ? vertexX : present[present.length - 1];
    if (legEnd - legStart < 60) return null;

    // Measure the leg's tilt from its outer (upper) edge, ignoring the
    // stretch nearest the vertex where the two legs overlap.
    const inset = Math.round((legEnd - legStart) * 0.15);
    const a = legStart + (useLeft ? 0 : inset);
    const b = legEnd - (useLeft ? inset : 0);
    const edge = [];
    for (let x = a; x < b; x++) if (spans[x]) edge.push([x, spans[x].top]);
    const slope = fitSlope(edge);
    if (slope === null) return null;
    const angleDeg = (Math.atan(slope) * 180) / Math.PI;

    // Rotate the leg level, then re-detect against the rotation fill.
    const FILL = { r: 255, g: 0, b: 255 };
    const rotated = await sharp(file)
        .removeAlpha()
        .rotate(-angleDeg, { background: FILL })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const rd = rotated.data;
    const ri = rotated.info;
    const isFill = (x, y) => {
        const i = (y * ri.width + x) * ri.channels;
        return rd[i] > 220 && rd[i + 1] < 60 && rd[i + 2] > 220;
    };
    const rLum = (x, y) => {
        const i = (y * ri.width + x) * ri.channels;
        return (rd[i] + rd[i + 1] + rd[i + 2]) / 3;
    };
    // The rotation fill is anti-aliased against the sweep, so a pixel can
    // be neither pure magenta nor real content; require a clear margin
    // from any fill pixel rather than trusting the exact colour.
    const nearFill = (x, y) => {
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= ri.width || ny >= ri.height) return true;
                if (isFill(nx, ny)) return true;
            }
        }
        return false;
    };
    const isFrameR = (x, y) => !nearFill(x, y) && Math.abs(rLum(x, y) - bg) > thr;

    const rSpans = columnSpans(rd, ri, isFrameR, 6);

    // The levelled leg is now the longest run of columns with a stable
    // thickness; a jump in thickness means the other leg has re-entered.
    const widths = rSpans.map((s) => (s ? s.bot - s.top : 0));
    const nonZero = widths.filter(Boolean).sort((p, q) => p - q);
    if (!nonZero.length) return null;
    const median = nonZero[Math.floor(nonZero.length / 2)];
    const stable = (w) => w > 0 && Math.abs(w - median) <= Math.max(4, median * 0.18);

    let best = { start: 0, len: 0 };
    let runStart = -1;
    for (let x = 0; x <= widths.length; x++) {
        if (x < widths.length && stable(widths[x])) {
            if (runStart < 0) runStart = x;
        } else {
            if (runStart >= 0 && x - runStart > best.len) best = { start: runStart, len: x - runStart };
            runStart = -1;
        }
    }
    if (best.len < 64) return null;

    const pad = Math.floor(best.len * 0.06);
    const x0 = best.start + pad;
    const cols = best.len - pad * 2;
    if (cols < 48) return null;
    const thickness = Math.min(MAX_THICKNESS, median);
    if (thickness < 8) return null;

    // Straighten any residual drift by resampling each column between its
    // own detected edges.
    const out = Buffer.alloc(cols * thickness * 3);
    for (let i = 0; i < cols; i++) {
        const s = rSpans[x0 + i];
        if (!s) return null;
        const span = s.bot - s.top;
        for (let j = 0; j < thickness; j++) {
            const sy = Math.min(ri.height - 1, s.top + Math.round((j / (thickness - 1)) * span));
            const si = (sy * ri.width + (x0 + i)) * ri.channels;
            const di = (j * cols + i) * 3;
            out[di] = rd[si];
            out[di + 1] = rd[si + 1];
            out[di + 2] = rd[si + 2];
        }
    }
    return sharp(out, { raw: { width: cols, height: thickness, channels: 3 } });
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

const EXTRACTORS = {
    rail: fromFlatScan,
    strip: fromFlatScan,
    assembled: fromAssembled,
    corner: fromCorner,
};

const QUALITY = {
    rail: 'scanned',
    strip: 'scanned',
    assembled: 'cropped-from-frame',
    corner: 'derived-from-corner',
};

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
fs.mkdirSync(OUT_DIR, { recursive: true });

const rails = {};
const failures = [];
let done = 0;

for (const frame of catalogue.frames) {
    // Try the frame's preferred source, then fall back through the
    // remaining ones — a scan can still fail detection (an unusually dark
    // moulding against a dark sweep), and a lower-fidelity strip beats no
    // texture at all.
    const order = [frame.textureSource, 'rail', 'strip', 'assembled', 'corner'].filter(
        (r, i, a) => r && a.indexOf(r) === i && frame.assets[r]?.length
    );

    let built = null;
    let usedRole = null;
    for (const role of order) {
        for (const asset of frame.assets[role]) {
            try {
                const pipeline = await EXTRACTORS[role](toDisk(asset));
                if (!pipeline) continue;
                built = pipeline;
                usedRole = role;
                break;
            } catch {
                /* try the next asset */
            }
        }
        if (built) break;
    }

    if (!built) {
        failures.push(frame.id);
        continue;
    }

    const meta = await built.metadata();
    const thickness = Math.min(MAX_THICKNESS, meta.height);
    const derivedEndTrim = usedRole === 'corner'
        ? Math.floor(meta.width * DERIVED_END_TRIM_RATIO)
        : 0;
    const seamlessRail = derivedEndTrim > 0 && meta.width - (derivedEndTrim * 2) >= 64
        ? built.extract({
            left: derivedEndTrim,
            top: 0,
            width: meta.width - (derivedEndTrim * 2),
            height: meta.height,
        })
        : built;
    const horizontal = await seamlessRail
        .resize({ width: STRIP_LENGTH, height: thickness, fit: 'fill' })
        .webp({ quality: 88 })
        .toBuffer();

    fs.writeFileSync(path.join(OUT_DIR, `${frame.id}-rail-h.webp`), horizontal);
    // rotate(90) turns the outer->inner axis from top->bottom into
    // left->right, which is what the left/right rails need.
    const vertical = await sharp(horizontal).rotate(90).webp({ quality: 88 }).toBuffer();
    fs.writeFileSync(path.join(OUT_DIR, `${frame.id}-rail-v.webp`), vertical);

    rails[frame.id] = {
        h: `/frames/rails/${frame.id}-rail-h.webp`,
        v: `/frames/rails/${frame.id}-rail-v.webp`,
        thickness,
        sourceRole: usedRole,
        quality: QUALITY[usedRole],
    };
    done += 1;
    if (done % 50 === 0) console.log(`  ...${done}`);
}

const byQuality = Object.values(rails).reduce((acc, r) => {
    acc[r.quality] = (acc[r.quality] || 0) + 1;
    return acc;
}, {});

fs.writeFileSync(
    MANIFEST,
    JSON.stringify({ generatedAt: new Date().toISOString(), stripLength: STRIP_LENGTH, byQuality, failures, rails }, null, 2),
    'utf8'
);

console.log(`\nWrote ${done} rail pairs to ${OUT_DIR}`);
console.log('  by quality:', byQuality);
console.log(`  failed    : ${failures.length}${failures.length ? ' -> ' + failures.join(', ') : ''}`);
console.log(`  manifest  : ${MANIFEST}`);
