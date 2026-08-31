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
 * What's reliably solid material in every corner shot is the small
 * region right around the mitre vertex itself, where both legs
 * converge — so instead this locates the vertex (the same technique
 * build-rail-textures.mjs's fromCorner() uses: the column whose moulding
 * reaches furthest into the image) and crops a square centred just above
 * it, sized off the leg's own measured thickness at that point.
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

    // Per-column vertical extent of the moulding, sampled at reduced
    // resolution — the column reaching furthest down locates the vertex.
    // (Its own vertical extent is a leg's length near the vertex, not a
    // cross-profile thickness, since the leg runs near-diagonally there
    // — not useful for sizing the crop, only for locating it.)
    const stepX = Math.max(1, Math.floor(width / 500));
    let vertexX = -1;
    let vertexY = -1;
    for (let x = 0; x < width; x += stepX) {
        for (let y = height - 1; y >= 0; y--) {
            if (!isFrame(x, y)) continue;
            if (y > vertexY) {
                vertexY = y;
                vertexX = x;
            }
            break;
        }
    }
    if (vertexX < 0) return null;

    // A fixed fraction of the photo's own shorter side reliably holds
    // both converging legs across this catalogue's product photography,
    // which frames the mitre fairly consistently shot to shot.
    const side = Math.round(Math.min(width, height) * 0.42);
    let left = Math.round(vertexX - side / 2);
    // The vertex sits near the bottom of a good crop, not dead centre —
    // both legs run upward/outward from it.
    let top = Math.round(vertexY - side * 0.82);
    left = Math.max(0, Math.min(width - side, left));
    top = Math.max(0, Math.min(height - side, top));

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
            if (!pipeline) {
                failures.push(id);
                continue;
            }
            const outPath = path.join(OUT_DIR, `${id}-corner.webp`);
            await pipeline.toFile(outPath);
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
