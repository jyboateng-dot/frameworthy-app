/**
 * Repoint catalogue frames at the asset files that actually exist on disk.
 *
 * The supplier re-fetch saves images with a position prefix — `pos1_9565-a.jpg`
 * rather than `9565-a.jpg` — so a catalogue written before the re-fetch points
 * `previewImg` at a path that 404s, and the frame shows an empty swatch. The
 * moulding itself still renders, because rails are keyed by frame id, which is
 * why this goes unnoticed until you scroll the picker.
 *
 * The fix is a filename repoint, NOT a catalogue regeneration: regenerating
 * mints fresh ids, and every id that changes silently detaches its frame from
 * frameRails.json / frameRenderProfiles.json and drops it to a flat colour
 * rectangle. Ids are the join key for all the render data — they are the one
 * thing a catalogue rebuild must preserve.
 *
 * Only `filename` and `previewImg` are touched. Everything the renderer keys
 * off — id, category, baseColor, measurements, texture flags — is left alone.
 *
 * Usage: node scripts/repoint_frame_assets.mjs [--write]
 *        (dry run by default; --write edits src/data/constants.jsx in place)
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONSTANTS = path.join(ROOT, 'src/data/constants.jsx');
const WRITE = process.argv.includes('--write');

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

// Ranked preference for which of a folder's images becomes the swatch. `pos1`
// is the supplier's lead shot — the assembled corner — which is what the
// catalogue swatch has always shown; the rest are profile/detail views.
const preferenceRank = (file, supplierNum) => {
    const f = file.toLowerCase();
    const hasNum = supplierNum && f.includes(supplierNum);
    if (/^pos1_/.test(f) && hasNum) return 0;
    if (/^pos1_/.test(f)) return 1;
    if (hasNum && /(corner|_a)/.test(f)) return 2;
    if (hasNum) return 3;
    if (/(corner|_a)/.test(f)) return 4;
    return 5;
};

const src = fs.readFileSync(CONSTANTS, 'utf8');

// Walk the FRAME_STYLES entries in the source text so the rewrite is a
// targeted string replacement — regenerating the file from parsed objects
// would reformat all 5,700 lines and bury the actual change.
const start = src.indexOf('export const FRAME_STYLES = [');
if (start === -1) throw new Error('FRAME_STYLES not found');

const entryRe = /\{\s*\n\s*id: '([^']+)',[\s\S]*?\n    \}/g;
entryRe.lastIndex = start;

let out = src;
const changes = [];
const unresolved = [];
let match;

while ((match = entryRe.exec(src)) !== null) {
    const [entry, id] = match;
    const previewMatch = entry.match(/previewImg: '([^']*)'/);
    if (!previewMatch) continue;
    const previewImg = previewMatch[1];
    if (!previewImg) continue;

    const rel = previewImg.replace(/^\//, '');
    if (fs.existsSync(path.join(PUBLIC_DIR, rel))) continue;   // already fine

    const dirRel = path.posix.dirname(rel);
    const dirAbs = path.join(PUBLIC_DIR, dirRel);
    if (!fs.existsSync(dirAbs)) {
        unresolved.push({ id, previewImg, why: 'asset folder missing' });
        continue;
    }

    const supplierNum = (id.match(/frame-(\d+)/) || [])[1] || null;
    const candidates = fs
        .readdirSync(dirAbs)
        .filter((f) => IMAGE_RE.test(f))
        .sort((a, b) => preferenceRank(a, supplierNum) - preferenceRank(b, supplierNum) || a.localeCompare(b));

    if (candidates.length === 0) {
        unresolved.push({ id, previewImg, why: 'no images in folder' });
        continue;
    }

    const picked = candidates[0];
    const newPreview = `/${dirRel}/${picked}`;
    const updated = entry
        .replace(/previewImg: '[^']*'/, `previewImg: '${newPreview}'`)
        .replace(/filename: '[^']*'/, `filename: '${picked}'`);

    out = out.replace(entry, updated);
    changes.push({ id, from: previewImg, to: newPreview });
}

console.log(`\nrepointed ${changes.length} frames, ${unresolved.length} unresolved\n`);
for (const c of changes.slice(0, 12)) console.log(`  ${c.id}\n    - ${c.from}\n    + ${c.to}`);
if (changes.length > 12) console.log(`  ... and ${changes.length - 12} more`);
if (unresolved.length) {
    console.log('\nunresolved (need the asset fetched, not a repoint):');
    for (const u of unresolved) console.log(`  ${u.id}  ${u.why}  ${u.previewImg}`);
}

if (WRITE) {
    fs.writeFileSync(CONSTANTS, out, 'utf8');
    console.log('\nwrote src/data/constants.jsx');
} else {
    console.log('\ndry run — pass --write to apply');
}
