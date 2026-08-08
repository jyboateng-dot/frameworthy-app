#!/usr/bin/env node
/**
 * Turns the catalogue's corner product photos into flat, tileable moulding
 * strips the visualizer can repeat along each side of a frame.
 *
 * WHY THIS EXISTS
 *
 * The visualizer currently fills each side of a frame with ONE zoomed-in
 * patch of its corner photo (see src/utils/frameTexture.js). That's honest
 * for a plain wood or painted moulding, where one patch of material looks
 * like any other patch. It falls apart on the ~50 ornate frames whose whole
 * visual identity is a REPEATING motif — beading, egg-and-dart, carved
 * leaves — because a single stretched patch smears the motif instead of
 * repeating it.
 *
 * The fix is to give those sides a real tileable strip of moulding. Getting
 * one out of these particular photos is the hard part, and is why this is a
 * build-time script with a rejection path rather than something done live.
 *
 * WHY THE PHOTOS RESIST THIS, AND WHAT'S DONE ABOUT IT
 *
 * These are 3D product shots: the moulding is photographed at an angle, so
 * you see its physical profile (face curvature, the outer side wall, real
 * specular highlights). That's exactly what makes them good catalogue
 * imagery and bad tile sources:
 *
 *   1. The arms aren't axis-aligned. Most are 45 mitre "V" compositions;
 *      others are three-quarter views sitting near 0/90. Handled by
 *      detecting the dominant edge direction per photo (projection-profile
 *      search below) rather than assuming any one composition — an earlier
 *      attempt that assumed a fixed ~45 mitre is documented in
 *      frameTexture.js as having silently missed the arm on differently
 *      composed photos.
 *
 *   2. Perspective foreshortening means the motif's period in pixels
 *      CHANGES along the arm, so there is no single correct tile width.
 *      Measured directly on 10715_b.jpg: best autocorrelation period ~89px
 *      at r=0.18 — far too weak to cut a periodic unit from.
 *
 *   3. The specular highlight travels along the arm, so its start and end
 *      differ in brightness. Butt-joining a strip to itself puts light
 *      against dark.
 *
 * (2) and (3) are both solved by emitting a MIRROR-DOUBLED strip —
 * [S | horizontally-flipped S]. Repeating that is seamless by construction:
 * each join is a mirror of itself, so there's no discontinuity to hide, and
 * no need to know the motif's period at all. The cost is that the motif
 * alternates direction, which on a directional carved pattern is visible on
 * close inspection but is far less objectionable than a hard seam every
 * ~89px, and on the majority of frames (plain, grained, beaded) is
 * effectively invisible.
 *
 * SAFE BY DEFAULT
 *
 * Every frame is validated (see REJECTION REASONS) and anything that can't
 * be converted confidently is skipped rather than written. A skipped frame
 * simply keeps the existing single-patch rendering, which is the same
 * fallback frameTexture.js already uses — so a bad conversion can never
 * silently ship, which matters across a 400+ image catalogue nobody is
 * going to review by hand.
 *
 * Usage:  node scripts/generate-frame-strips.mjs [--limit N] [--only file.jpg]
 */
import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FRAMES_DIR = 'public/frames';
const OUT_DIR = 'public/frames/strips';
const MANIFEST_PATH = 'src/data/frameStrips.json';

// A pixel is "background" (studio white / rotation fill) if every channel is
// above this. Same threshold frameTexture.js uses, for the same reason.
const WHITE = 235;

// Angle detection runs on a downscaled copy — the dominant edge direction is
// a global property, so full resolution buys nothing but time.
const ANALYSIS_WIDTH = 240;
const MAX_POINTS = 4000;

// --- Validation thresholds -------------------------------------------------
// A converted strip has to be long enough to be worth tiling, thick enough to
// actually be the moulding face rather than a sliver of edge, and of stable
// thickness along its length (thickness that drifts means the crop is
// wandering off the arm, or the arm is foreshortening too hard to use).
const MIN_STRIP_LENGTH = 100;      // px, at source resolution
const MIN_STRIP_THICKNESS = 15;    // px
const MAX_THICKNESS_DRIFT = 0.10;  // fraction of median thickness
const MIN_ANGLE_CONFIDENCE = 1.02; // best projection score vs. the 45-off baseline

// MANUALLY REVIEWED REJECTS
//
// The generator's own checks (angle confidence, arm stability, thickness
// drift) are necessary but not sufficient — see the module comment above
// and src/utils/frameTexture.js for why no automated proxy tried actually
// separates good conversions from bad ones. Every one of the 369 strips
// the generator accepted was tiled and looked at directly (not re-run
// through more heuristics) before any of this shipped.
//
// These two failed that look: both are pale, near-white/silver mouldings
// where a soft grey smudge repeats at every tile boundary — the same class
// of residual contamination the run-margin trim (see findHorizontalArm)
// fixes for ordinary mouldings, but subtle enough on a near-white surface
// that it's a colour-contrast problem no threshold on this generator's own
// numeric checks can catch: a pale defect on a pale frame doesn't move the
// same statistics a dark defect on a dark frame does. Same posture as
// MANUALLY_VERIFIED_SINGLE_SURFACE in frameTexture.js — a curated list,
// not a generalized rule, because generalizing from two examples here
// would be exactly the kind of unverified guess this whole review process
// exists to avoid. New catalogue photos aren't in this list by default, so
// they get a real look before shipping, not an inherited assumption.
const MANUALLY_REJECTED = new Set([
    '11164_corner_a_1_1.jpg',
    '11168_corner_a_1_1.jpg',
]);

const args = process.argv.slice(2);
const argValue = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
};
const LIMIT = argValue('--limit') ? parseInt(argValue('--limit'), 10) : null;
const ONLY = argValue('--only');

/**
 * Collects the non-background pixels of a downscaled copy as a point cloud,
 * subsampled to keep the angle search cheap.
 */
async function maskPoints(src) {
    const { data, info } = await sharp(src)
        .resize({ width: ANALYSIS_WIDTH, fit: 'inside' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { width: w, height: h, channels: c } = info;
    const pts = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * c;
            if (data[i] > WHITE && data[i + 1] > WHITE && data[i + 2] > WHITE) continue;
            pts.push([x - w / 2, y - h / 2]);
        }
    }
    if (pts.length <= MAX_POINTS) return pts;
    const step = pts.length / MAX_POINTS;
    const out = [];
    for (let i = 0; i < MAX_POINTS; i++) out.push(pts[Math.floor(i * step)]);
    return out;
}

/**
 * Classic projection-profile deskew score: rotating content into alignment
 * with the axes concentrates its mass into fewer rows and columns, which
 * maximises the sum of squared row/column occupancy. Works the same whether
 * the photo is a 45 mitre "V" or a near-axis-aligned three-quarter view,
 * which is the whole point of using it over an assumed mitre angle.
 */
function projectionScore(pts, angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const rows = new Map(), cols = new Map();
    for (let i = 0; i < pts.length; i++) {
        const x = pts[i][0], y = pts[i][1];
        const rx = Math.round(x * cos - y * sin);
        const ry = Math.round(x * sin + y * cos);
        rows.set(ry, (rows.get(ry) || 0) + 1);
        cols.set(rx, (cols.get(rx) || 0) + 1);
    }
    let s = 0;
    for (const v of rows.values()) s += v * v;
    for (const v of cols.values()) s += v * v;
    return s;
}

/**
 * The rotation (clockwise degrees) that best axis-aligns this photo's
 * moulding arms. The score is 90-periodic, so only [0,90) is searched; which
 * of the four resulting orientations we land in is resolved later by
 * locating the elbow.
 */
function detectAngle(pts) {
    let best = 0, bestScore = -Infinity;
    for (let a = 0; a < 90; a += 1) {
        const s = projectionScore(pts, a);
        if (s > bestScore) { bestScore = s; best = a; }
    }
    for (let a = best - 1; a <= best + 1; a += 0.25) {
        const s = projectionScore(pts, a);
        if (s > bestScore) { bestScore = s; best = a; }
    }
    // Confidence: a genuinely aligned angle should beat the maximally
    // misaligned one (45 away) by a clear margin. Flat//textureless photos
    // with no strong straight edges score nearly the same at every angle.
    const baseline = projectionScore(pts, best + 45);
    return { angle: best, confidence: bestScore / Math.max(1, baseline) };
}

/** Reads a rotated full-res image plus a boolean "is moulding" mask. */
async function rotatedMask(src, angle) {
    const { data, info } = await sharp(src)
        .rotate(angle, { background: '#ffffff' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels: c } = info;
    const mask = new Uint8Array(w * h);
    for (let i = 0, p = 0; p < w * h; p++, i += c) {
        mask[p] = (data[i] > WHITE && data[i + 1] > WHITE && data[i + 2] > WHITE) ? 0 : 1;
    }
    return { mask, data, w, h, c };
}

/** Least-squares line fit over sampled (x, y) pairs. */
function fitLine(xs, ys) {
    const n = xs.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return { m: 0, b: sy / n };
    const m = (n * sxy - sx * sy) / denom;
    return { m, b: (sy - m * sx) / n };
}

/**
 * Straightens the moulding face into a true rectangle.
 *
 * A rectangular crop can't work here: because these are 3D shots the face is
 * a trapezoid, so the moulding's own decorative lines (the inner gilt line,
 * a bead run) sit at a different height at each end. Tiled along a frame
 * side, those lines visibly wander instead of running straight.
 *
 * Both edges are physically straight lines on a real moulding, so they're
 * fitted by least squares (which also denoises the per-column edge
 * detection), and every output column is then resampled vertically between
 * the fitted inner and outer edge. That maps the trapezoid onto a constant
 * height, straightening the decoration and normalising thickness in one
 * pass.
 */
function rectifyStrip(data, w, h, c, arm, top, bot) {
    const xs = [], tys = [], bys = [];
    for (let x = arm.x0; x <= arm.x1; x++) {
        if (top[x] < 0 || bot[x] < 0) continue;
        xs.push(x); tys.push(top[x]); bys.push(bot[x]);
    }
    if (xs.length < 20) return null;
    const topFit = fitLine(xs, tys);
    const botFit = fitLine(xs, bys);

    const outW = arm.x1 - arm.x0 + 1;
    const thicknesses = xs.map((x) => (botFit.m * x + botFit.b) - (topFit.m * x + topFit.b));
    const outH = Math.round(thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length);
    if (outH < MIN_STRIP_THICKNESS) return null;

    const out = Buffer.alloc(outW * outH * 3);
    for (let i = 0; i < outW; i++) {
        const x = arm.x0 + i;
        const yTop = topFit.m * x + topFit.b;
        const yBot = botFit.m * x + botFit.b;
        for (let j = 0; j < outH; j++) {
            const sy = yTop + ((yBot - yTop) * j) / (outH - 1);
            const y0 = Math.floor(sy);
            const fy = sy - y0;
            const y1 = Math.min(h - 1, y0 + 1);
            const o = (j * outW + i) * 3;
            for (let ch = 0; ch < 3; ch++) {
                const a = data[(Math.max(0, y0) * w + x) * c + ch];
                const b = data[(y1 * w + x) * c + ch];
                out[o + ch] = Math.round(a + (b - a) * fy);
            }
        }
    }
    return { buf: out, width: outW, height: outH };
}

/**
 * Locates the horizontal arm of the (now axis-aligned) L, and the longest
 * run along it where the moulding's thickness is stable. Thickness growing
 * means we've reached the mitre; thickness shrinking means the cut end of
 * the sample — both are excluded, leaving clean parallel-sided moulding.
 */
function findHorizontalArm(mask, w, h) {
    const rowCount = new Array(h).fill(0);
    for (let y = 0; y < h; y++) {
        let n = 0;
        for (let x = 0; x < w; x++) if (mask[y * w + x]) n++;
        rowCount[y] = n;
    }
    const maxRow = Math.max(...rowCount);
    if (maxRow < w * 0.15) return null;

    // The horizontal band = the contiguous rows carrying most of the mass.
    const thresh = maxRow * 0.5;
    let r0 = -1, r1 = -1, bestLen = 0, curStart = -1;
    for (let y = 0; y < h; y++) {
        if (rowCount[y] >= thresh) {
            if (curStart < 0) curStart = y;
            if (y - curStart + 1 > bestLen) { bestLen = y - curStart + 1; r0 = curStart; r1 = y; }
        } else curStart = -1;
    }
    if (r0 < 0) return null;

    // Per-column top/bottom of the moulding within that band.
    const top = new Int32Array(w).fill(-1);
    const bot = new Int32Array(w).fill(-1);
    for (let x = 0; x < w; x++) {
        for (let y = r0; y <= r1; y++) if (mask[y * w + x]) { if (top[x] < 0) top[x] = y; bot[x] = y; }
    }

    // Columns where the OTHER arm of the L is also present — i.e. the elbow.
    // These have to be excluded or the run walks straight through the mitre
    // joint, and the emitted "strip" is actually a corner: its decoration
    // meets itself at a diagonal in the middle, which tiles as a repeating
    // chevron. Thickness alone doesn't catch this, because at the elbow the
    // perpendicular arm's width is about the same as the arm's own
    // thickness, so the run sails through it inside tolerance.
    // Scaled to the band's own thickness, not a fixed pixel count: these
    // photos carry a soft drop shadow under the moulding that reads as a
    // handful of stray mask pixels outside the band (measured 2-9 on
    // 10715_b.jpg), while a genuine perpendicular arm contributes hundreds
    // (300-450 on the same photo). A fixed small threshold mistakes the
    // shadow for an arm and truncates the run to a fraction of its length.
    const MAX_OTHER_ARM = Math.max(12, Math.round((r1 - r0 + 1) * 0.25));
    const clearColumn = new Uint8Array(w);
    for (let x = 0; x < w; x++) {
        let above = 0, below = 0;
        for (let y = 0; y < r0; y++) if (mask[y * w + x]) above++;
        for (let y = r1 + 1; y < h; y++) if (mask[y * w + x]) below++;
        clearColumn[x] = (above <= MAX_OTHER_ARM && below <= MAX_OTHER_ARM) ? 1 : 0;
    }

    const thickAt = (x) => (top[x] < 0 ? 0 : bot[x] - top[x] + 1);
    const present = [];
    for (let x = 0; x < w; x++) present.push(thickAt(x));
    const nonZero = present.filter((v) => v > 0).sort((a, b) => a - b);
    if (!nonZero.length) return null;
    const median = nonZero[Math.floor(nonZero.length / 2)];
    if (median < MIN_STRIP_THICKNESS) return null;

    const tol = median * MAX_THICKNESS_DRIFT;
    let runStart = -1, bestRun = null;
    for (let x = 0; x <= w; x++) {
        const ok = x < w && clearColumn[x] && Math.abs(present[x] - median) <= tol;
        if (ok) { if (runStart < 0) runStart = x; }
        else if (runStart >= 0) {
            const len = x - runStart;
            if (!bestRun || len > bestRun.len) bestRun = { x0: runStart, x1: x - 1, len };
            runStart = -1;
        }
    }
    if (!bestRun) return null;

    // Trim a margin off both ends of the run before using it for anything.
    // The run's own endpoints are exactly where thickness drifted out of
    // tolerance or the other arm appeared — i.e. the start of the transition
    // toward the mitre, not clean parallel moulding yet. Verified directly on
    // 10512_corner_a_1.jpg: row 0 of the untrimmed output was a genuine
    // near-white band (~250) roughly 16px wide at both run endpoints — real
    // background bleed from the edge fit tracking that transition, not
    // review-artifact or coincidence — while mid-arm the same row reads
    // 40-90 (true moulding). Mirroring then doubles each trimmed-off end
    // into one bright seam at the tile boundary and another at the mirror
    // line, which is the periodic notch seen across nearly every converted
    // strip in review. Trimming here removes it at the source for all of
    // them, rather than patching the symptom per side.
    const runLen = bestRun.x1 - bestRun.x0 + 1;
    const margin = Math.max(6, Math.round(runLen * 0.08));
    bestRun = { x0: bestRun.x0 + margin, x1: bestRun.x1 - margin, len: runLen - margin * 2 };
    if (bestRun.len < MIN_STRIP_LENGTH) return null;

    // Inscribe the crop INSIDE the moulding rather than taking its median
    // outline. These are 3D product shots, so the face is a trapezoid, not a
    // rectangle: the outer silhouette sits at the frame's true geometric
    // angle while the inner edge recedes with perspective (measured on
    // 10715_b.jpg: 21px of taper over 300px of arm). A median rectangle
    // straddles that taper and pulls studio background in at the narrow end,
    // which then tiles as a bright wedge. Taking the lowest inner edge and
    // the highest outer edge over the run guarantees every pixel emitted is
    // real moulding, at the cost of a little face at the wide end.
    let cropTop = -Infinity, cropBot = Infinity;
    for (let x = bestRun.x0; x <= bestRun.x1; x++) {
        if (top[x] > cropTop) cropTop = top[x];
        if (bot[x] < cropBot) cropBot = bot[x];
    }
    if (!(cropBot > cropTop)) return null;
    return {
        x0: bestRun.x0,
        x1: bestRun.x1,
        top: cropTop,
        bot: cropBot,
        bandR0: r0,
        bandR1: r1,
        topEdge: top,
        botEdge: bot,
    };
}

/**
 * Which side of the horizontal arm faces the artwork. Determined from where
 * the OTHER arm goes: the L's concave side is the frame's inside, so a
 * vertical arm rising above the horizontal band means the inner edge is the
 * band's top edge, and vice versa.
 */
function findInnerSide(mask, w, h, arm) {
    let above = 0, below = 0;
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < arm.bandR0; y++) if (mask[y * w + x]) above++;
        for (let y = arm.bandR1 + 1; y < h; y++) if (mask[y * w + x]) below++;
    }
    // No second arm at all -> not a corner shot we can reason about.
    if (above < 200 && below < 200) return null;
    return above > below ? 'top' : 'bottom';
}

async function convert(file) {
    if (MANUALLY_REJECTED.has(file)) return { file, ok: false, reason: 'manually-rejected' };

    const src = path.join(FRAMES_DIR, file);
    const pts = await maskPoints(src);
    if (pts.length < 500) return { file, ok: false, reason: 'too-little-material' };

    const { angle, confidence } = detectAngle(pts);
    if (confidence < MIN_ANGLE_CONFIDENCE) {
        return { file, ok: false, reason: `low-angle-confidence(${confidence.toFixed(3)})` };
    }

    const { mask, data, w, h, c } = await rotatedMask(src, angle);
    const arm = findHorizontalArm(mask, w, h);
    if (!arm) return { file, ok: false, reason: 'no-stable-arm' };

    const length = arm.x1 - arm.x0 + 1;
    if (length < MIN_STRIP_LENGTH) return { file, ok: false, reason: `arm-too-short(${length})` };

    const innerSide = findInnerSide(mask, w, h, arm);
    if (!innerSide) return { file, ok: false, reason: 'no-second-arm' };

    const rect = rectifyStrip(data, w, h, c, arm, arm.topEdge, arm.botEdge);
    if (!rect) return { file, ok: false, reason: 'rectify-failed' };
    const thickness = rect.height;

    const stripBuf = await sharp(rect.buf, {
        raw: { width: rect.width, height: rect.height, channels: 3 },
    }).png().toBuffer();

    // Orient every strip the same way: inner edge at the BOTTOM, so the
    // renderer can use one convention for all four sides.
    const oriented = innerSide === 'top'
        ? await sharp(stripBuf).flip().toBuffer()
        : stripBuf;

    const mirrored = await sharp(oriented).flop().toBuffer();
    const base = file.replace(/\.[^.]+$/, '');
    const horizontal = await sharp({
        create: { width: length * 2, height: thickness, channels: 3, background: '#ffffff' },
    })
        .composite([{ input: oriented, left: 0, top: 0 }, { input: mirrored, left: length, top: 0 }])
        .webp({ quality: 92 })
        .toBuffer();

    await writeFile(path.join(OUT_DIR, `${base}-h.webp`), horizontal);

    // Vertical variant for the left/right sides: rotate 90 CW, which puts the
    // inner edge on the left and keeps the same tiling seam behaviour.
    const vertical = await sharp(horizontal).rotate(90).webp({ quality: 92 }).toBuffer();
    await writeFile(path.join(OUT_DIR, `${base}-v.webp`), vertical);

    return {
        file, ok: true, angle: Number(angle.toFixed(2)), length, thickness, innerSide,
        strip: {
            h: `${base}-h.webp`,
            v: `${base}-v.webp`,
            tileLength: length * 2,
            thickness,
            // Recorded for REVIEW ORDERING ONLY — deliberately not used as a
            // pass/fail gate. It correlates with how crisply axis-aligned a
            // photo's edges are, but was tested as an accept threshold and
            // rejected: 10794_b.jpg scores 1.437 (above every candidate
            // cutoff) and still converts to a mitre-spanning chevron, while
            // 10715_b.jpg converts cleanly at 1.352. Sorting by it puts the
            // likeliest-good conversions first for a human; it cannot stand
            // in for one.
            confidence: Number(confidence.toFixed(3)),
        },
    };
}

async function main() {
    await mkdir(OUT_DIR, { recursive: true });
    let files = (await readdir(FRAMES_DIR)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (ONLY) files = files.filter((f) => f === ONLY);
    if (LIMIT) files = files.slice(0, LIMIT);

    const results = [];
    const CONCURRENCY = 8;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        const settled = await Promise.all(batch.map((f) =>
            convert(f).catch((e) => ({ file: f, ok: false, reason: `error:${e.message}` }))));
        results.push(...settled);
        process.stdout.write(`\r  processed ${Math.min(i + CONCURRENCY, files.length)}/${files.length}`);
    }
    process.stdout.write('\n');

    const ok = results.filter((r) => r.ok);
    const bad = results.filter((r) => !r.ok);

    const manifest = {};
    for (const r of ok) manifest[r.file] = r.strip;
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

    console.log(`\nconverted : ${ok.length}/${results.length}`);
    console.log(`skipped   : ${bad.length}`);
    const byReason = {};
    for (const r of bad) {
        const key = r.reason.replace(/\(.*\)/, '');
        byReason[key] = (byReason[key] || 0) + 1;
    }
    for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(n).padStart(4)}  ${reason}`);
    }
    console.log(`\nmanifest  : ${MANIFEST_PATH}`);
    console.log(`strips    : ${OUT_DIR}/`);
}

main();
