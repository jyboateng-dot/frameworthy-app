/**
 * Emits the FRAME_STYLES array for src/data/constants.jsx from
 * src/data/frameCatalogue.json, and splices it into the file in place.
 *
 * Two sources are merged. Geometry and imagery come from the curated
 * supplier drop (via build-frame-catalogue.mjs) and are authoritative.
 * Merchandising metadata — category, baseColor, priceMod, widthCategory —
 * is hand-curated, exists nowhere in the supplier data, and is carried
 * over from the last known-good committed catalogue by SKU id. That join
 * only works because both use the same frame-<sku> scheme; it is exactly
 * what the random-id generation in the superseded rebuild_catalog.mjs
 * destroyed.
 *
 * Frames with no counterpart in the old catalogue get conservative
 * defaults and are listed at the end of the run so the curation gap is
 * visible rather than silently averaged away.
 */
import fs from 'fs';
import { execSync } from 'child_process';

const CATALOGUE = 'src/data/frameCatalogue.json';
const TARGET = 'src/data/constants.jsx';
// Last commit before the catalogue was rewritten with random ids.
const CURATION_REF = process.env.CURATION_REF || '967fc36';

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));

/* -- carry over merchandising metadata from the last good catalogue -- */
let legacySource = '';
try {
    legacySource = execSync(`git show ${CURATION_REF}:${TARGET}`, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
} catch {
    console.warn(`WARN: could not read ${CURATION_REF}:${TARGET}; every frame will take defaults.`);
}

const LEGACY_ENTRY =
    /\{\s*id:\s*'(frame-[^']+)'[\s\S]*?category:\s*'([^']*)'[\s\S]*?baseColor:\s*'([^']*)'[\s\S]*?widthCategory:\s*'([^']*)'[\s\S]*?priceMod:\s*([\d.]+)/g;

const legacy = new Map();
for (const m of legacySource.matchAll(LEGACY_ENTRY)) {
    legacy.set(m[1], {
        category: m[2],
        baseColor: m[3],
        widthCategory: m[4],
        priceMod: Number(m[5]),
    });
}

/* ------------------------------------------------------------------ */

// Falls back to the catalogue's measured moulding width when the frame is
// new: the same thresholds the legacy widthCategory used, so a new frame
// lands in the same bucket a curated one of that size would.
function widthCategoryFor(frame) {
    const w = frame.mouldingWidthIn;
    if (!Number.isFinite(w)) return 'standard';
    if (w >= 1.5) return 'wide';
    if (w <= 0.75) return 'narrow';
    return 'standard';
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * Gallery Wrapped Canvas is a product option, not a moulding: it has no
 * rail, no rabbet and no supplier folder, so it can never come out of the
 * asset drop. It stays pinned at the head of the list because ~45 call
 * sites branch on `frame-canvas` for pricing, mat and glazing rules, and
 * dropping it silently removes the canvas-print option from the app.
 */
const CANVAS_ENTRY = `    {
        id: 'frame-canvas',
        name: 'Gallery Wrapped Canvas',
        category: 'Canvas',
        baseColor: '#ffffff',
        filename: 'canvas-icon.jpg',
        width: '0px',
        widthCategory: 'narrow',
        priceMod: 1.0,
        isCanvas: true,
        previewImg: '/frames/canvas-icon.jpg',
        mouldingWidthIn: 0,
        rabbetDepthIn: 0,
        textureSource: '',
        textureDerived: false
    }`;

const missingCuration = [];
const rendered = catalogue.frames.map((f) => {
    const meta = legacy.get(f.id);
    if (!meta) missingCuration.push(`${f.id} ${f.name}`);
    const widthCategory = meta?.widthCategory || widthCategoryFor(f);
    const props = [
        ['id', q(f.id)],
        ['name', q(f.name)],
        ['category', q(meta?.category || 'Other')],
        ['baseColor', q(meta?.baseColor || '#c8c2ba')],
        ['filename', q(f.thumbnail ? f.thumbnail.split('/').pop() : '')],
        ['width', q(widthCategory === 'wide' ? '36px' : '24px')],
        ['widthCategory', q(widthCategory)],
        ['priceMod', String(meta?.priceMod ?? 1)],
        ['type', q('Picture Frame')],
        ['desc', q(`${f.name}.`)],
        // Corner cut: the catalogue thumbnail, per the rebuild brief.
        ['previewImg', q(f.thumbnail || '')],
        // Geometry the 2D/3D renderers read. null rather than a guessed
        // number when unmeasured, so the renderer's own fallback applies
        // and nothing downstream mistakes an estimate for a measurement.
        ['mouldingWidthIn', f.mouldingWidthIn ?? 'null'],
        ['rabbetDepthIn', f.rabbetDepthIn ?? 'null'],
        ['textureSource', q(f.textureSource || '')],
        ['textureDerived', String(Boolean(f.textureDerived))],
    ];
    return `    {\n${props.map(([k, v]) => `        ${k}: ${v}`).join(',\n')}\n    }`;
});

const block = `export const FRAME_STYLES = [\n${[CANVAS_ENTRY, ...rendered].join(',\n')}\n];`;

const target = fs.readFileSync(TARGET, 'utf8');
const FRAME_STYLES_BLOCK = /export const FRAME_STYLES = \[[\s\S]*?\n\];/m;
if (!FRAME_STYLES_BLOCK.test(target)) {
    console.error(`ERROR: could not locate the FRAME_STYLES array in ${TARGET}; nothing written.`);
    process.exit(1);
}

fs.writeFileSync(TARGET, target.replace(FRAME_STYLES_BLOCK, block), 'utf8');

console.log(`Spliced ${catalogue.frames.length} frames into ${TARGET}`);
console.log(`  curation carried over : ${catalogue.frames.length - missingCuration.length}`);
console.log(`  taking defaults       : ${missingCuration.length}`);
for (const m of missingCuration.slice(0, 12)) console.log(`    - ${m}`);
if (missingCuration.length > 12) console.log(`    ... ${missingCuration.length - 12} more`);
