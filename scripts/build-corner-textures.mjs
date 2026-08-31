/**
 * Crops each frame's real photographed mitre-corner shot down to a tight,
 * roughly-square tile for the AR model — see frameMesh.js for how it gets
 * draped over the wedge of geometry at each of the 4 corners.
 *
 * src/data/frameRenderProfiles.json's cornerTexturePaths already point at
 * local webp files (saved by scripts/extract-frame-render-assets.mjs), but
 * those are the full supplier product shot: a small mitred "V" surrounded
 * by a lot of white studio background. Used as-is, almost the whole tile
 * would render as blank white with the actual wood a small streak through
 * the middle. This crops tightly to the photographed material first.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PROFILES_PATH = 'src/data/frameRenderProfiles.json';
const RAILS_PATH = 'src/data/frameRails.json';
const PUBLIC_DIR = 'public';
const OUT_DIR = 'public/frames/rails';
const TILE_PX = 640;

// Same adaptive background/threshold approach as build-rail-textures.mjs
// (duplicated rather than imported — these are independent one-off build
// scripts, not application code, and each is meant to read standalone).
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
    return Math.min(40, Math.max(6, spread / 3));
}

/**
 * A corner shot's "V" of moulding usually runs leg-to-corner across the
 * whole photo — so a plain row/column bounding box (find the margin rows
 * and columns that are ALL background, trim those) finds almost no
 * margin to trim: every row and column has *some* wood in it somewhere,
 * even though a large triangular chunk (the opening, and the two
 * background wedges outside the legs) is still empty. Squaring that
 * bounding box up leaves roughly half the tile blank white.
 *
 * An earlier version of this located the vertex by finding the column
 * whose moulding reaches furthest down the image (the same technique
 * build-rail-textures.mjs's fromCorner() uses to locate a leg's vertex).
 * That only works when background surrounds the whole "V" on every
 * side. A lot of this catalogue's corner shots are framed tighter than
 * that — the legs' own material fills the entire lower portion of the
 * photo edge to edge, with only the opening's white wedge at the top —
 * so "furthest down" ties at the image's bottom edge for almost every
 * column, and whichever column happens to be scanned first (the far
 * left edge) wins by default: not the vertex at all. Three-quarters of
 * the catalogue's crops came out mostly blank white before this was
 * caught by a follow-up whiteness audit.
 *
 * What's true regardless of how tightly the photo is cropped: scanning
 * a row for material finds two separate runs (one per leg) above the
 * vertex, with the opening's white gap between them, and finds the two
 * runs merged into one continuous run at and below the vertex — because
 * that is what a vertex *is*, the row where the gap between the legs
 * closes to nothing. Walking down the rows and watching that gap close
 * locates the vertex without caring whether background exists on the
 * outside of the legs at all.
 */
async function cropCornerTile(file) {
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const bg = backgroundLevel(data, info);
    const thr = maskThreshold(data, info, bg);
    const isFrame = (x, y) => {
        const i = (y * width + x) * channels;
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        return Math.abs(lum - bg) > thr;
    };

    const stepX = Math.max(1, Math.floor(width / 400));
    const runsAtRow = (y) => {
        const runs = [];
        let start = -1;
        for (let x = 0; x < width; x += stepX) {
            const frame = isFrame(x, y);
            if (frame && start < 0) start = x;
            if (!frame && start >= 0) { runs.push([start, x - stepX]); start = -1; }
        }
        if (start >= 0) runs.push([start, width - 1]);
        return runs;
    };

    // A single transient row with only one run doesn't mean the legs
    // merged there — a fleck of carved detail, or one leg's tip simply
    // not having entered frame yet at the very top of the photo, can
    // produce a one-off "merge" long before the real vertex. Recording
    // every sampled row first, then requiring the merge to hold for a
    // sustained run of rows afterward, is what tells the real vertex
    // apart from that kind of noise.
    const stepY = Math.max(1, Math.floor(height / 600));
    const rows = [];
    for (let y = 0; y < height; y += stepY) rows.push({ y, runs: runsAtRow(y) });

    let vertexX = -1;
    let vertexY = -1;
    let legThickness = 0;
    let lastGapRow = null;
    const HOLD = Math.max(5, Math.round(rows.length * 0.05));
    for (let index = 0; index < rows.length; index += 1) {
        const { y, runs } = rows[index];
        if (runs.length >= 2) {
            lastGapRow = { y, gapStart: runs[0][1], gapEnd: runs[1][0] };
            continue;
        }
        if (runs.length !== 1 || !lastGapRow) continue;

        const holdsAfter = rows.slice(index, index + HOLD).filter((r) => r.runs.length <= 1).length;
        if (holdsAfter < HOLD * 0.8) continue; // a blip, not the real merge

        vertexX = Math.round((lastGapRow.gapStart + lastGapRow.gapEnd) / 2);
        vertexY = y;
        legThickness = (runs[0][1] - runs[0][0]) / 2;
        break;
    }
    if (vertexX < 0 && lastGapRow) {
        // The legs never fully merged (a very open, wide-angle shot) —
        // best available estimate is where the gap was narrowest.
        vertexX = Math.round((lastGapRow.gapStart + lastGapRow.gapEnd) / 2);
        vertexY = lastGapRow.y;
    }
    if (vertexX < 0) return null;
    if (legThickness < 8) legThickness = Math.min(width, height) * 0.12;

    const side = Math.max(40, Math.min(Math.round(legThickness * 3.6), Math.min(width, height)));
    let left = Math.round(vertexX - side / 2);
    // The vertex sits near the bottom of a good crop, not dead centre —
    // both legs run upward/outward from it.
    let top = Math.round(vertexY - side * 0.82);
    left = Math.max(0, Math.min(width - side, left));
    top = Math.max(0, Math.min(height - side, top));

    // A near-white or pale-metallic moulding sits close enough to the
    // studio background's own brightness that isFrame's threshold can't
    // reliably tell them apart — the vertex search above still runs, but
    // against a mask that's mostly noise, so the crop it lands on is
    // frequently near-blank. Rather than trust a location found against
    // an unreliable mask, check the crop's own contrast directly: a
    // real corner (material against background, or one moulding tone
    // against another) has much more of it than a patch that's actually
    // uniform. Every frame confirmed good by eye during this script's
    // development came in at 38+; this leaves real margin below that.
    let sum = 0;
    let sumSq = 0;
    const n = side * side;
    for (let y = 0; y < side; y++) {
        for (let x = 0; x < side; x++) {
            const i = ((top + y) * width + (left + x)) * channels;
            const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
            sum += lum;
            sumSq += lum * lum;
        }
    }
    const mean = sum / n;
    const stddev = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    if (stddev < 32) return null;

    return sharp(file)
        .removeAlpha()
        .extract({ left, top, width: side, height: side })
        .resize({ width: TILE_PX, height: TILE_PX, fit: 'fill' })
        .webp({ quality: 88 });
}

async function main() {
    const onlyIds = process.argv.find((a) => a.startsWith('--only-ids='))?.slice('--only-ids='.length).split(',').filter(Boolean);

    const profilesDoc = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
    const railsDoc = JSON.parse(fs.readFileSync(RAILS_PATH, 'utf8'));
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const ids = Object.keys(profilesDoc.profiles).filter((id) => {
        if (onlyIds && !onlyIds.includes(id)) return false;
        return profilesDoc.profiles[id].cornerTexturePaths?.length;
    });

    console.log(`Cropping corner tiles for ${ids.length} frames.`);
    let done = 0;
    const failures = [];

    for (const id of ids) {
        const sourcePath = profilesDoc.profiles[id].cornerTexturePaths[0];
        const absSource = path.join(PUBLIC_DIR, sourcePath.replace(/^\//, ''));
        if (!fs.existsSync(absSource)) {
            failures.push(id);
            continue;
        }
        try {
            const pipeline = await cropCornerTile(absSource);
            const outPath = path.join(OUT_DIR, `${id}-corner.webp`);
            if (!pipeline) {
                failures.push(id);
                // A stale tile/reference from an earlier, less careful
                // run of this script must not survive a re-run that now
                // rejects it — otherwise a frame this pass correctly
                // decided not to touch quietly keeps shipping the bad
                // crop from before.
                if (railsDoc.rails[id]?.corner) {
                    delete railsDoc.rails[id].corner;
                    fs.rmSync(outPath, { force: true });
                }
                continue;
            }
            // Windows antivirus/indexing can transiently lock a just-
            // written file of this size (the same issue build-rail-
            // textures.mjs's manifest save already retries around).
            let lastWriteError;
            let written = false;
            for (let attempt = 0; attempt < 5 && !written; attempt += 1) {
                try {
                    await pipeline.toFile(outPath);
                    written = true;
                } catch (writeError) {
                    lastWriteError = writeError;
                    await new Promise((resolveWait) => setTimeout(resolveWait, 300 * (attempt + 1)));
                }
            }
            if (!written) throw lastWriteError;
            railsDoc.rails[id] = { ...(railsDoc.rails[id] || {}), corner: `/frames/rails/${id}-corner.webp` };
            done += 1;
        } catch (error) {
            failures.push(id);
            console.warn(`  ${id}: ${error.message}`);
        }
    }

    railsDoc.generatedAt = new Date().toISOString();
    fs.writeFileSync(RAILS_PATH, `${JSON.stringify(railsDoc, null, 2)}\n`, 'utf8');

    console.log(`Wrote ${done} corner tiles to ${OUT_DIR}`);
    console.log(`Failed: ${failures.length}${failures.length ? ' -> ' + failures.join(', ') : ''}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
