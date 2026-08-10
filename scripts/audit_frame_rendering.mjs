/**
 * Audit every catalogue frame against the four things the visualizer needs to
 * render it the *same way* as its neighbours.
 *
 * The 2D preview, the AR model and the swatch all key off `frame.id`:
 *
 *   frameRails.json        rails[frame.id]     -> the tiling moulding texture
 *   frameRenderProfiles.js profiles[frame.id]  -> profile/finish + measurements
 *   previewImg                                 -> the catalogue swatch
 *
 * So a frame whose id doesn't appear in those maps still renders — it just
 * silently drops to a flat `baseColor` rectangle with a guessed moulding
 * width, which looks like a styling bug rather than missing data. This script
 * makes that failure countable instead of something you notice frame by frame.
 *
 * Usage: node scripts/audit_frame_rendering.mjs [--json] [--list <bucket>]
 *                                               [--constants <path>]
 *
 * `--constants` points the audit at a different catalogue file, which is how
 * you compare a candidate regeneration against the live one before adopting
 * it — the check this repo was missing when the catalogue got regenerated
 * with a fresh set of ids and every rail lookup started missing.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');

// ── load FRAME_STYLES out of constants.jsx ────────────────────────────────
// Read rather than import: the file is .jsx and lives in Vite's module graph,
// so plain node can't resolve it. The array is generated data with no
// expressions in it, which makes a brace-matched slice safe to evaluate.
const constantsIdx = process.argv.indexOf('--constants');
const CONSTANTS_PATH = constantsIdx === -1 ? 'src/data/constants.jsx' : process.argv[constantsIdx + 1];

function loadFrameStyles() {
    const src = fs.readFileSync(path.resolve(ROOT, CONSTANTS_PATH), 'utf8');
    const start = src.indexOf('export const FRAME_STYLES = [');
    if (start === -1) throw new Error('FRAME_STYLES not found in src/data/constants.jsx');
    const open = src.indexOf('[', start);
    let depth = 0;
    let end = -1;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '[') depth++;
        else if (src[i] === ']') {
            depth--;
            if (depth === 0) { end = i; break; }
        }
    }
    if (end === -1) throw new Error(`unterminated FRAME_STYLES array in ${CONSTANTS_PATH}`);
    // eslint-disable-next-line no-new-func
    return new Function(`return ${src.slice(open, end + 1)}`)();
}

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// Public-root-absolute URL ("/frames/x.webp") -> does the file exist?
const assetExists = (url) => {
    if (!url || typeof url !== 'string' || !url.startsWith('/')) return false;
    return fs.existsSync(path.join(PUBLIC_DIR, decodeURIComponent(url).replace(/^\//, '')));
};

const frames = loadFrameStyles();
const rails = readJson('src/data/frameRails.json').rails || {};
const profiles = readJson('src/data/frameRenderProfiles.json').profiles || {};

const report = frames.map((f) => {
    const rail = rails[f.id] || null;
    const profile = profiles[f.id] || null;
    return {
        id: f.id,
        name: f.name,
        filename: f.filename || '',
        // The renderer's own branch: a rail with both strips present on disk is
        // the "textured moulding" path; anything else is the flat fallback.
        hasRail: Boolean(rail),
        railFilesOk: Boolean(rail && assetExists(rail.h) && assetExists(rail.v)),
        railQuality: rail?.quality || null,
        hasProfile: Boolean(profile),
        // getFrameRenderProfile treats a numeric mouldingWidthIn as "measured";
        // anything else falls back to a widthCategory guess.
        measured: Number.isFinite(profile?.mouldingWidthIn) || Number.isFinite(f.mouldingWidthIn),
        previewOk: assetExists(f.previewImg),
        isCanvas: Boolean(f.isCanvas) || f.id === 'frame-canvas',
    };
});

const buckets = {
    // The frame renders with a real tiling moulding texture — the intended path.
    textured: report.filter((r) => r.railFilesOk && !r.isCanvas),
    // Has a rail entry, but the .webp strips aren't on disk: renders flat.
    railMissingFiles: report.filter((r) => r.hasRail && !r.railFilesOk && !r.isCanvas),
    // No rail entry at all: renders flat.
    noRail: report.filter((r) => !r.hasRail && !r.isCanvas),
    noProfile: report.filter((r) => !r.hasProfile && !r.isCanvas),
    unmeasured: report.filter((r) => !r.measured && !r.isCanvas),
    previewBroken: report.filter((r) => !r.previewOk && !r.isCanvas),
    canvas: report.filter((r) => r.isCanvas),
};

if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ total: frames.length, report }, null, 2));
    process.exit(0);
}

const listIdx = process.argv.indexOf('--list');
if (listIdx !== -1) {
    const name = process.argv[listIdx + 1];
    const rows = buckets[name];
    if (!rows) {
        console.error(`unknown bucket "${name}". one of: ${Object.keys(buckets).join(', ')}`);
        process.exit(1);
    }
    for (const r of rows) console.log(`${r.id}\t${r.filename}\t${r.name}`);
    process.exit(0);
}

const pct = (n) => `${((n / frames.length) * 100).toFixed(1)}%`;
const line = (label, rows) => console.log(`  ${label.padEnd(26)} ${String(rows.length).padStart(4)}  ${pct(rows.length)}`);

console.log(`\nFRAME RENDERING AUDIT — ${frames.length} frames in ${CONSTANTS_PATH}\n`);
console.log('  RENDER PATH');
line('textured moulding', buckets.textured);
line('flat — no rail entry', buckets.noRail);
line('flat — rail files missing', buckets.railMissingFiles);
line('canvas (frameless)', buckets.canvas);
console.log('\n  SUPPORTING DATA');
line('no render profile', buckets.noProfile);
line('unmeasured moulding', buckets.unmeasured);
line('broken preview image', buckets.previewBroken);

// Rail strips on disk that nothing references. These are leftovers from a
// superseded build: harmless to ship but misleading to read, because a frame
// listed in `failures` can still have plausible-looking .webp files sitting
// next to the real ones.
const railDir = path.join(PUBLIC_DIR, 'frames/rails');
const referenced = new Set(
    Object.values(rails).flatMap((r) => [r.h, r.v]).filter(Boolean).map((u) => path.basename(u)),
);
const orphanRails = fs.existsSync(railDir)
    ? fs.readdirSync(railDir).filter((f) => /-rail-[hv]\.webp$/.test(f) && !referenced.has(f))
    : [];

console.log('\n  ON DISK');
line('orphan rail strips', orphanRails);
if (orphanRails.length) console.log(`      ${orphanRails.join(', ')}`);

const failures = readJson('src/data/frameRails.json').failures || [];
if (failures.length) console.log(`\n  rail build failures (tracked): ${failures.join(', ')}`);

console.log(`\n  rail map covers ${Object.keys(rails).length} ids, profile map ${Object.keys(profiles).length}`);
const matched = report.filter((r) => r.hasRail).length;
if (matched === 0 && Object.keys(rails).length > 0) {
    console.log('\n  !! zero id overlap between FRAME_STYLES and frameRails.json.');
    console.log('     The catalogue ids were regenerated without remapping the render data,');
    console.log('     so every frame falls back to flat colour. See --list noRail.');
}
console.log('');
