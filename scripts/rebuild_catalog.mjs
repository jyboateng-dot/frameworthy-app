/**
 * Rebuild FRAME_STYLES from the supplier asset folders in public/frames/assets.
 *
 * READ THIS BEFORE CHANGING THE ID SCHEME.
 *
 * `frame.id` is the join key for every piece of render data the visualizer
 * uses — frameRails.json (the tiling moulding texture), frameRenderProfiles
 * .json (profile, finish, measurements), and any saved cart/wishlist item.
 * None of those lookups throw when they miss; a frame with an unrecognised id
 * simply renders as a flat `baseColor` rectangle with a guessed moulding
 * width. An earlier version of this script minted `frame-${Math.random()}`
 * whenever it couldn't parse a number out of the filename, and because the
 * asset re-fetch had renamed everything to `pos1_*`, that fallback fired for
 * two thirds of the catalogue and silently un-textured it.
 *
 * So: ids come from the supplier moulding number, or the frame is skipped and
 * reported. Never invented.
 *
 * Everything a human curated — category, baseColor, widthCategory, priceMod,
 * measurements, texture source — is carried over from the existing entry by
 * id. This script only refreshes what it can actually observe: which asset
 * files exist and what they're called.
 *
 * Usage: node scripts/rebuild_catalog.mjs            # writes constants_new.jsx
 *        node scripts/rebuild_catalog.mjs --write    # writes constants.jsx
 */

import fs from 'fs';
import path from 'path';

const ASSETS_DIR = 'public/frames/assets';
const LIVE = 'src/data/constants.jsx';
const STAGING = 'src/data/constants_new.jsx';
const WRITE_LIVE = process.argv.includes('--write');

const constantsContent = fs.readFileSync(LIVE, 'utf8');

// ── the existing catalogue, parsed properly ───────────────────────────────
// A regex over 5,700 lines of object literals was how the curated fields got
// dropped last time — it matched some entries and quietly skipped the rest.
function loadFrameStyles(src) {
    const start = src.indexOf('export const FRAME_STYLES = [');
    if (start === -1) throw new Error(`FRAME_STYLES not found in ${LIVE}`);
    const open = src.indexOf('[', start);
    let depth = 0;
    let end = -1;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '[') depth++;
        else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) throw new Error('unterminated FRAME_STYLES array');
    // eslint-disable-next-line no-new-func
    return new Function(`return ${src.slice(open, end + 1)}`)();
}

const existing = loadFrameStyles(constantsContent);
const byId = new Map(existing.map((f) => [f.id, f]));

// frameCatalogue.json is the authority on folder-slug -> id, and it's what the
// rail builder itself reads. Preferring it over the filename matters: two
// distinct products can carry the same supplier number in their asset names
// (charcoal-with-silver-edge and mahogany-...-double-dimple both ship an
// `80868-a` image), and a number-derived id would collapse them into one.
const slugToId = new Map(
    JSON.parse(fs.readFileSync('src/data/frameCatalogue.json', 'utf8')).frames.map((f) => [f.slug, f.id]),
);

/**
 * Fallback for a folder that isn't in frameCatalogue.json yet. The supplier
 * moulding number appears in every asset filename for a frame, optionally
 * behind the re-fetch's position prefix: `83811_a.jpg`, `pos1_84129_a.jpg`,
 * `pos4_10685_corner_a.jpg`.
 */
function supplierNumber(files) {
    for (const file of files) {
        const stripped = String(file).split('/').pop().replace(/^pos\d+_/i, '');
        const m = stripped.match(/^(\d{3,6})/);
        if (m) return m[1];
    }
    return null;
}

const folders = fs
    .readdirSync(ASSETS_DIR)
    .filter((f) => fs.statSync(path.join(ASSETS_DIR, f)).isDirectory());

const newFrames = [];
const skipped = [];

for (const folder of folders) {
    const detailsPath = path.join(ASSETS_DIR, folder, 'details.json');
    if (!fs.existsSync(detailsPath)) { skipped.push({ folder, why: 'no details.json' }); continue; }

    const details = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
    const images = details.images || [];
    if (images.length === 0) { skipped.push({ folder, why: 'no images' }); continue; }

    const number = supplierNumber(images);
    const id = slugToId.get(folder) || (number ? `frame-${number}` : null);
    if (!id) { skipped.push({ folder, why: 'no id: absent from frameCatalogue.json and no supplier number' }); continue; }

    const prior = byId.get(id);
    if (!prior) { skipped.push({ folder, why: `${id} is not in the catalogue — add it deliberately` }); continue; }

    const baseName = details.title.replace(/ Picture Frame$/i, '').trim();

    // Lead shot first: `pos1_` is the supplier's assembled-corner view, which
    // is what the swatch has always shown.
    const pick = (...tests) => {
        for (const test of tests) {
            const hit = images.find(test);
            if (hit) return hit;
        }
        return '';
    };
    const cornerImg = pick(
        (i) => /^pos1_/i.test(i),
        (i) => i.includes('corner') && i.includes('_a'),
        (i) => i.includes('_a.jpg') && !i.includes('profile'),
    ) || images[0];

    newFrames.push({
        ...prior,                 // every curated + render field survives verbatim
        id,
        name: baseName,
        filename: cornerImg,
        desc: `${baseName}.`,
        previewImg: `/frames/assets/${folder}/${cornerImg}`,
    });
}

// Synthetic products have no supplier folder to be rebuilt from — the Gallery
// Wrapped Canvas is a frameless SKU, not a moulding — so they're carried
// through rather than quietly falling out of a folder-driven rebuild.
for (const f of existing) {
    if ((f.isCanvas || f.id === 'frame-canvas') && !newFrames.some((n) => n.id === f.id)) {
        newFrames.unshift(f);
    }
}

// ── guardrail ─────────────────────────────────────────────────────────────
// Refuse to publish a catalogue that would strip frames of their textures.
const rails = JSON.parse(fs.readFileSync('src/data/frameRails.json', 'utf8')).rails || {};
const before = existing.filter((f) => rails[f.id]).length;
const after = newFrames.filter((f) => rails[f.id]).length;
const dropped = existing.filter((f) => !newFrames.some((n) => n.id === f.id));

console.log(`\nrebuilt ${newFrames.length} frames (was ${existing.length})`);
console.log(`textured: ${after} (was ${before})`);
if (skipped.length) {
    console.log(`\nskipped ${skipped.length} folders:`);
    for (const s of skipped.slice(0, 20)) console.log(`  ${s.folder}: ${s.why}`);
    if (skipped.length > 20) console.log(`  ... and ${skipped.length - 20} more`);
}
if (dropped.length) {
    console.log(`\nwould drop ${dropped.length} existing frames:`);
    for (const d of dropped) console.log(`  ${d.id}  ${d.name}`);
}

if (WRITE_LIVE && after < before) {
    console.error(`\nREFUSING to write ${LIVE}: textured frames would fall ${before} -> ${after}.`);
    console.error('That means ids changed and the rails no longer resolve. Fix the id');
    console.error('derivation, or run without --write to inspect the staging output.');
    process.exit(1);
}

const serialise = (f) => `    {\n${Object.entries(f)
    .map(([k, v]) => `        ${k}: ${typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : JSON.stringify(v)}`)
    .join(',\n')}\n    }`;

const out = constantsContent.replace(
    /export const FRAME_STYLES = \[[\s\S]*?\n\];/m,
    `export const FRAME_STYLES = [\n${newFrames.map(serialise).join(',\n')}\n];`,
);

const target = WRITE_LIVE ? LIVE : STAGING;
fs.writeFileSync(target, out, 'utf8');
console.log(`\nwrote ${target}${WRITE_LIVE ? '' : '  (pass --write to update the live catalogue)'}`);
