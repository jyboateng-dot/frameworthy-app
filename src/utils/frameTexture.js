// Finds a point on a frame's corner photo (constants.jsx's `previewImg`) that
// is reliably ON the moulding material rather than the white studio
// background it's shot against — so the live visualizer and the order
// thumbnail can fill the frame with the actual photographed wood/metal
// texture instead of a synthesized flat-color gradient.
//
// WHY THIS EXISTS, AND WHY IT'S DELIBERATELY SIMPLE
//
// The catalogue's corner photos are 45°-mitre glamour shots (two arms of
// moulding meeting at a point, on white), not the axis-aligned square swatch
// a textbook 9-slice border expects. An earlier version of this attempted the
// "textbook" approach — detect the mitre angle per photo, rotate the arm to
// horizontal, crop a clean tileable strip — and it was rejected after
// concretely testing it against 5 real catalogue photos: rotation math that
// worked for one composition (apex centred, ~45°/-45° arms) missed the arm
// entirely on a differently-composed one (~13°/-61°), and a follow-up fix
// for that broke again on soft drop-shadow pixels that aren't pure white but
// aren't frame material either. Both failures were silent — wrong output,
// not an error — which is the dangerous kind across an unreviewed 400+ image
// catalogue.
//
// This does far less, on purpose: it finds ONE point that's confidently
// real material (verified against actual pixel color, not inferred from
// geometry), and lets the caller use that as a `background-position` /
// canvas source-rect anchor for a zoomed-in crop. No rotation, no tiling, no
// "this row is where the arm should be" assumption — so there's no
// orientation-dependent failure mode left to break. The tradeoff is real:
// grain direction across the four sides isn't physically accurate the way a
// true 9-slice would be. Against the current flat-gradient rendering it
// replaces, real material colour and texture — even at a fixed, honestly
// approximate angle — is still a strict improvement, never a regression,
// for every photo in the catalogue rather than a tuned subset of it.
//
// THE HEURISTIC
//
// Every corner photo puts the mat/opening (white) touching the top edge of
// the frame, with the moulding filling the region below and around it — true
// across every composition seen regardless of the mitre angle, since it's
// simply how "photograph a corner with the opening toward camera-up" works.
// So: scan each column for where white first turns to non-white (the
// opening's lower boundary) and take the column where that happens latest —
// the deepest point of the opening, i.e. where the two arms visually meet.
// A point offset well below that, straight down, lands inside the moulding
// body in every composition tested (verified by sampling the actual pixel
// colour there and confirming it's not white).
//
// A SECOND, LATER PROBLEM AND WHY THERE'S A CROP-VARIANCE CHECK BELOW
//
// The single-pixel check above only proves the anchor isn't on the white
// background. It says nothing about a different real risk: many of these
// mitre photos also show a sliver of the frame's SIDE wall along the outer
// edge — often a plain, differently-coloured surface from the decorated
// FACE (e.g. a wood-grain face with a glossy near-black edge) — and the live
// visualizer is a flat frontal view where only the face is ever real. An
// anchor placed safely in the face can still sit close enough to that
// face/side seam that the zoomed-in crop rendered around it spans both.
//
// Precisely finding that seam per photo was tried and rejected the same way
// the rotation approach above was: a brightness-shift scan false-positived
// on ornate carving detail and decorative pinstripes (both produce sharp
// local contrast within a single real surface), and a stricter version that
// required the shift to persist just relocated the false match to the
// photo's outer silhouette (frame meeting white background) instead.
// Shrinking the crop window instead of finding the seam doesn't fully solve
// it either — swept from 900% to 3000% zoom against the full catalogue,
// several dozen photos still showed a real two-tone split even in a
// ~23px-wide crop, meaning the anchor itself sits too close to a seam for
// any window size to avoid it, and 3000%+ zoom is tight enough to make the
// texture an unrecognizable smear anyway.
//
// So instead of asking "where exactly is the seam", this asks the question
// that actually matters: "does the crop this anchor will actually render
// contain two distinct colours, or one material's natural variation?" —
// checked directly, at the real render zoom, on the real catalogue. An
// anchor whose crop looks two-toned is rejected outright rather than
// rendered at any zoom, falling back to the gradient — the same safe outcome
// as any other rejected anchor. Verified against a confirmed-real defect
// (a wood-grain face vs. glossy-black side, standard deviation 50 across the
// crop) and the same photo's safe render once zoomed in (standard deviation
// 13) — the threshold below sits well clear of both reference points.

// THE MANUAL REVIEW BELOW, AND WHY IT EXISTS
//
// The crop-variance check catches real defects, but it isn't the same thing
// as "is this actually two surfaces" — it's a proxy (colour spread across
// the crop), and a proxy can be wrong in both directions. Concretely: the
// automated pipeline above rejected roughly 100 of the catalogue's 342
// frames as two-toned. 95 of those were opened and looked at directly (not
// re-run through more heuristics) to find out which rejections were real.
// 16 were: a decorated face photographed right up against a plain,
// different-coloured side wall — the same defect shape as the original bug
// (e.g. a gold leaf face against a flat black edge). The other 79 were the
// proxy firing on rich single-material texture it has no way to distinguish
// from a real seam — deep carving shadow, a woven/linen finish, a decorative
// pinstripe or bead line — all real, but all one surface, just with more
// local contrast than the threshold assumes.
//
// The 79 are listed below by filename and bypass the crop-variance check
// entirely, using the same anchor position the automated pipeline already
// computed for them. This is deliberately a manually-curated list, not a
// looser threshold — loosening the threshold enough to admit these 79 was
// checked first and it also admits a meaningful chunk of the 16 genuine
// defects, because both groups can produce similar variance numbers; only
// looking at the photo tells them apart. New catalogue photos aren't in
// this list by default, so they get the conservative (gradient fallback)
// treatment until someone actually looks at them — the same safe-by-default
// posture the rest of this module uses.
//
// The remaining ~12 rejections are a different problem this list can't fix:
// frames whose moulding is itself white, cream, or pale silver. Their real
// material sample lands close enough to WHITE_THRESHOLD that validateAnchor
// rejects it before the crop-variance check even runs, for the same reason
// it rejects an anchor that missed onto the studio background — colour
// alone can't tell "white material" from "white background" apart. Adding
// these filenames to the override list above wouldn't help, since they
// never reach the check the override bypasses. They fall back to the flat
// gradient, which happens to be an honest render for a white frame anyway.
const MANUALLY_VERIFIED_SINGLE_SURFACE = new Set([
    '10065_corner_a_1_2.jpg', '10136-a_2.jpg', '10166_a_1.jpg', '10272_corner_a_1.jpg',
    '10325_corner_a_1.jpg', '10326_a.jpg', '10327_corner_a_1.jpg', '10570_corner_a_1.jpg',
    '10618a.jpg', '10649_corner_a_1.jpg', '10685_corner_a_1.jpg', '10712_corner_a_1.jpg',
    '10713_b.jpg', '10714_b.jpg', '10716_corner_a_1.jpg', '10733_b.jpg', '10739_corner_a_1.jpg',
    '10768_corner_a_1.jpg', '10782_b.jpg', '10783_b.jpg', '10793_b.jpg', '10794_b.jpg',
    '10811_corner_a_1.jpg', '10813_corner_a_1.jpg', '10833_corner_a_1.jpg', '10839_corner_a_1.jpg',
    '10840_corner_a_1.jpg', '11196-a.jpg', '11210_corner_a_1.jpg', '11215_corner_a_1_1.jpg',
    '11219_a_1.jpg', '11221_a_1.jpg', '11234-a.jpg', '11239_corner_a_1.jpg', '11240_corner_a_1.jpg',
    '1831bu_a.jpg', '5031_a.jpg', '5838bl_a.jpg', '6538-a_1.jpg', '7111bl_a_1.jpg',
    '80997a.jpg', '83536-a_1.jpg', '8372_a_2.jpg', '8373_a_2.jpg', '83811_a.jpg',
    '83879_a_2.jpg', '83881_a_3.jpg', '83885_a_1.jpg', '83961_a.jpg', '84008_a_1.jpg',
    '84024_a.jpg', '84026_a.jpg', '84038_a_1.jpg', '84051_a_1.jpg', '84069_a_1.jpg',
    '84070_a_1.jpg', '84129_a_1.jpg', '84131_a_1.jpg', '84132-a_1.jpg', '84134_a_1.jpg',
    '84137_a_1.jpg', '84160_a_2.jpg', '8837_a.jpg', '8838_corner_a_1.jpg', '8971_a.jpg',
    '9135_corner_a_1.jpg', '9202_a.jpg', '9479a.jpg', '9582a.jpg', '9654a.jpg',
    '9666_a.jpg', '9912_a_1.jpg',
    // Found on a follow-up full-catalogue audit pass — same review process,
    // same single-material confirmation, just missed from the first batch.
    '11153_corner_a_1_1.jpg', '11155_corner_a_1_1.jpg', '8579_corner_a_1.jpg',
    '10832_corner_a_1.jpg', '11167_corner_a_1_1.jpg', '11164_corner_a_1_1.jpg', '84039_a_1.jpg',
]);

const MIN_APEX_MARGIN_FRAC = 0.05; // reject an apex too close to either edge — sign the scan latched onto noise, not a real corner
const WHITE_THRESHOLD = 235;
const ANCHOR_DEPTH_FRAC = 0.25; // how far below the apex, as a fraction of remaining image height, to sample
const MIN_ANCHOR_SATURATION_DISTANCE = 12; // reject a "material" sample that's actually just off-white background

// The zoom level the anchor is validated at must match what the renderer
// actually uses — CustomizeFramePage.jsx imports this rather than defining
// its own, so the two can never drift apart.
export const TEXTURE_ZOOM_PCT = 900;
const MAX_CROP_STDDEV = 28; // known-safe crop measured ~13; known-defective crop measured ~50
const MAX_CROP_CLUSTER_GAP = 38; // same reference crops measured ~20 (safe) and ~67 (defective)

const anchorCache = new Map(); // imgSrc -> Promise<{xPct, yPct} | null>

const isWhitePixel = (data, w, x, y) => {
    const i = (y * w + x) * 4;
    return data[i] > WHITE_THRESHOLD && data[i + 1] > WHITE_THRESHOLD && data[i + 2] > WHITE_THRESHOLD;
};

const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
});

/**
 * The actual decision logic, factored out from pixel scanning so it's
 * testable without a real canvas backend: given an already-located apex and
 * an already-sampled colour at the candidate anchor point, decide whether
 * that anchor is trustworthy. Exported for tests; not meant to be called
 * directly outside them — use `getFrameTextureAnchor` for the real pipeline.
 */
export const validateAnchor = ({ apexX, apexY, w, h, sampleColor }) => {
    if (apexX < 0 || apexY < 0 || !w || !h) return null;
    if (apexX < w * MIN_APEX_MARGIN_FRAC || apexX > w * (1 - MIN_APEX_MARGIN_FRAC)) return null;
    if (apexY < h * MIN_APEX_MARGIN_FRAC || apexY > h * (1 - MIN_APEX_MARGIN_FRAC)) return null;

    const sampleX = apexX;
    const sampleY = apexY + (h - apexY) * ANCHOR_DEPTH_FRAC;
    const [r, g, b] = sampleColor;
    // Reject if the sample point still landed on something white/near-white
    // (a photo with an unusually large opening, or an apex miss) — the max
    // channel spread is near zero for anything from white to flat grey, and
    // grows for any actual saturated material colour.
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const isNearWhite = r > WHITE_THRESHOLD - 15 && g > WHITE_THRESHOLD - 15 && b > WHITE_THRESHOLD - 15;
    if (isNearWhite && spread < MIN_ANCHOR_SATURATION_DISTANCE) return null;

    return {
        xPct: (sampleX / w) * 100,
        yPct: (sampleY / h) * 100,
    };
};

const sampleColorAt = (data, w, x, y) => {
    const i = (Math.round(y) * w + Math.round(x)) * 4;
    return [data[i], data[i + 1], data[i + 2]];
};

// imgSrc is a full URL (dev server, CDN, or bundled asset path) — the
// manual review list is keyed by filename only, so strip everything else.
// Exported for tests only; the real pipeline calls this internally.
export const basenameOf = (src) => {
    const clean = src.split(/[?#]/)[0];
    return clean.slice(clean.lastIndexOf('/') + 1);
};

/**
 * Maps a CSS `background-position` percentage to the source-image pixel
 * range actually revealed at a given `background-size` zoom (as a
 * multiplier, e.g. 9 for "900% 900%") — the exact interpolation the CSS
 * background box formula uses, not an approximation. Exported for tests.
 */
export const cssBackgroundWindow = (positionPct, sourceSize, zoomMultiplier) => {
    const sizeFrac = 1 / zoomMultiplier;
    const startFrac = (1 - sizeFrac) * (positionPct / 100);
    return { start: startFrac * sourceSize, size: sizeFrac * sourceSize };
};

/**
 * Given the brightness values of every pixel in a candidate crop, decides
 * whether it looks like one material's natural variation (grain, carving
 * shadow, a decorative inlay line) or two genuinely different surfaces
 * spliced together — see the "SECOND, LATER PROBLEM" note above for why this
 * exists and how the threshold was chosen. Exported for tests.
 */
export const isCropTwoToned = (brightnessValues) => {
    const n = brightnessValues.length;
    if (n === 0) return false;
    const mean = brightnessValues.reduce((a, c) => a + c, 0) / n;
    const variance = brightnessValues.reduce((a, c) => a + (c - mean) * (c - mean), 0) / n;
    const stddev = Math.sqrt(variance);

    const below = brightnessValues.filter((v) => v < mean);
    const above = brightnessValues.filter((v) => v >= mean);
    const meanOf = (arr) => (arr.length ? arr.reduce((a, c) => a + c, 0) / arr.length : mean);
    const clusterGap = meanOf(above) - meanOf(below);

    return stddev > MAX_CROP_STDDEV && clusterGap > MAX_CROP_CLUSTER_GAP;
};

const detectAnchor = (img) => {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    // The opening (white) sits toward the top of every corner photo in the
    // catalogue, with moulding filling in below/around it, regardless of
    // the mitre angle — so the deepest point where white first turns to
    // non-white, scanning down each column, is the corner's apex.
    let apexX = -1, apexY = -1;
    const xStart = Math.floor(w * 0.1), xEnd = Math.floor(w * 0.9);
    for (let x = xStart; x < xEnd; x++) {
        for (let y = 0; y < h; y++) {
            if (!isWhitePixel(data, w, x, y)) {
                if (y > apexY) { apexY = y; apexX = x; }
                break;
            }
        }
    }
    if (apexX < 0) return null; // no opening/corner boundary found — not a corner shot

    const sampleY = apexY + (h - apexY) * ANCHOR_DEPTH_FRAC;
    const sampleColor = sampleColorAt(data, w, apexX, sampleY);
    const anchor = validateAnchor({ apexX, apexY, w, h, sampleColor });
    if (!anchor) return null;

    // The single-pixel check above only rules out "landed on background".
    // Separately check the actual crop this anchor will render at — see the
    // "SECOND, LATER PROBLEM" note above — and reject if it spans two
    // distinct surfaces rather than one material's natural variation.
    const xWindow = cssBackgroundWindow(anchor.xPct, w, TEXTURE_ZOOM_PCT / 100);
    const yWindow = cssBackgroundWindow(anchor.yPct, h, TEXTURE_ZOOM_PCT / 100);
    const x0 = Math.max(0, Math.round(xWindow.start));
    const x1 = Math.min(w, Math.round(xWindow.start + xWindow.size));
    const y0 = Math.max(0, Math.round(yWindow.start));
    const y1 = Math.min(h, Math.round(yWindow.start + yWindow.size));
    if (x1 <= x0 || y1 <= y0) return null;

    const cropData = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const cropBrightness = [];
    for (let i = 0; i < cropData.length; i += 4) {
        cropBrightness.push((cropData[i] + cropData[i + 1] + cropData[i + 2]) / 3);
    }
    const isManuallyVerified = MANUALLY_VERIFIED_SINGLE_SURFACE.has(basenameOf(img.src));
    if (!isManuallyVerified && isCropTwoToned(cropBrightness)) return null;

    return anchor;
};

/**
 * Resolves to a `{xPct, yPct}` point (percentages, for use directly as a CSS
 * `background-position` or scaled into a canvas source-rect) on real
 * moulding material in the given corner photo, or `null` if no confident
 * anchor could be found — callers should fall back to their existing
 * non-photo rendering in that case, not guess.
 *
 * Memoized per image URL: the detection does real pixel work (draws to an
 * offscreen canvas, reads it back), so it's worth never repeating for the
 * same frame style within a session.
 */
export const getFrameTextureAnchor = (imgSrc) => {
    if (!imgSrc) return Promise.resolve(null);
    if (anchorCache.has(imgSrc)) return anchorCache.get(imgSrc);

    const promise = loadImage(imgSrc)
        .then((img) => detectAnchor(img))
        .catch(() => null);
    anchorCache.set(imgSrc, promise);
    return promise;
};
