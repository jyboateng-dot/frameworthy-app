/**
 * Builds src/data/frameCatalogue.json from the curated supplier drop in
 * "frame assets/".
 *
 * Replaces scripts/rebuild_catalog.mjs, which assigned frame ids with
 * Math.random() whenever a filename didn't match /^(\d+)_/ — most of them.
 * That produced ids like frame-16556 that matched nothing in
 * frameRenderProfiles.json (SKU-keyed, frame-83811), so 124 of 231 frames
 * silently fell back to category estimates instead of measured geometry.
 * Ids here are derived deterministically from the SKU the supplier already
 * stamps into every filename in a folder, so re-running is idempotent.
 *
 * Asset roles are assigned by filename convention. Every rule below was
 * verified against the actual pixels before being encoded — the supplier's
 * suffixes are consistent EXCEPT bare `c`, which is a flat rail on some
 * frames (9565c.jpg) and a corner on others (11234-c.jpg); those are left
 * unclassified rather than guessed. See ROLE_RULES.
 */
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = 'frame assets';
const ARCHIVE_DIR = 'catalog_downloads/supplier-source-archive/frames';
const OUT_PATH = 'src/data/frameCatalogue.json';

/* ------------------------------------------------------------------ *
 * Asset role classification
 * ------------------------------------------------------------------ */

// Ordered: first match wins. `explicit` rules name the role in the
// filename and are unambiguous; the suffix rules below them are the
// supplier's shorthand and were each confirmed by eye across several
// frames (a/b = corner, c2 & d = profile, bare sku = short rail strip).
const ROLE_RULES = [
    { role: 'junk', test: (s) => s.startsWith('hqdefault') },
    { role: 'rail', test: (s) => s.includes('framingengine') },
    { role: 'profile', test: (s) => s.includes('profile') },
    { role: 'corner', test: (s) => s.includes('corner') },
    { role: 'assembled', test: (s) => s.includes('swap') },
    // `f<sku>d`, `<sku>-d`, `<sku>_d` — cross-section showing the rabbet.
    { role: 'profile', test: (s) => /(^f\d+d$)|[-_]?d$/.test(s) },
    // `c2` is always a profile; bare `c` is NOT reliable (see module note).
    { role: 'profile', test: (s) => /c2$/.test(s) },
    { role: 'ambiguous', test: (s) => /[-_]?c$/.test(s) },
    { role: 'corner', test: (s) => /[-_]?b$/.test(s) },
    { role: 'corner', test: (s) => /[-_]?a$/.test(s) },
    { role: 'strip', test: (s) => /^\d+$/.test(s) },
];

function classify(filename) {
    const stem = filename
        .toLowerCase()
        .replace(/\.(jpe?g|png|webp)$/, '')
        // `_1`, `_2`, `_1_1` are byte-identical re-uploads of the same shot,
        // not extra views — strip them before matching the role suffix.
        .replace(/(_\d+)+$/, '');
    for (const rule of ROLE_RULES) if (rule.test(stem)) return rule.role;
    return 'unknown';
}

/* ------------------------------------------------------------------ *
 * SKU derivation
 * ------------------------------------------------------------------ */

/**
 * Every image in a folder carries the same supplier SKU, but the
 * separator varies (`83811_a`, `84132-a`, `11004a`, `f9565d`,
 * `imagemanipulator_default_swap_10874`). Taking the most common digit
 * run across the folder is stable against any single odd filename.
 *
 * Most SKUs are 4-6 digits, but the metallic-* frames use 3 (204, 206),
 * so a 3-digit pass runs only when no longer run exists. That order
 * matters: a bare 3-digit search would otherwise match fragments of the
 * longer SKUs. Junk files are excluded first so their incidental digits
 * (hqdefault_1_510) can never win.
 */
function deriveSku(files) {
    const candidates = files.filter((f) => classify(f) !== 'junk');
    const tally = (re) => {
        const counts = new Map();
        for (const f of candidates) {
            for (const m of f.matchAll(re)) counts.set(m[0], (counts.get(m[0]) || 0) + 1);
        }
        return counts;
    };
    let counts = tally(/\d{4,6}/g);
    if (!counts.size) counts = tally(/\d{3}/g);
    if (!counts.size) return null;
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

/* ------------------------------------------------------------------ *
 * Measurements
 * ------------------------------------------------------------------ */

/**
 * Supplier measurements arrive as truncated imperial fractions: "5/8-",
 * "1-1/8-", "13/16-", "2-". The trailing hyphen is the amputated " IN"
 * suffix. Note "1-1/8" is the mixed number 1+1/8, not a subtraction.
 */
function parseImperial(raw) {
    if (raw == null) return null;
    const s = String(raw).trim().replace(/[^0-9/.\-]+$/, '').replace(/-+$/, '');
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d+)-(\d+)\/(\d+)$/))) {
        return Number(m[1]) + Number(m[2]) / Number(m[3]);
    }
    if ((m = s.match(/^(\d+)\/(\d+)$/))) {
        return Number(m[1]) / Number(m[2]);
    }
    if ((m = s.match(/^(\d+(?:\.\d+)?)$/))) {
        return Number(m[1]);
    }
    return null;
}

/**
 * details.json only carries a moulding width for 80 of 335 frames. The
 * supplier archive scraped the same products' customizer text and has it
 * for far more, keyed by the same product URL — joining the two lifts
 * coverage to ~95% without inventing a number. Provenance is recorded so
 * a fallback estimate is never mistaken for a measurement.
 */
function loadArchiveMeasurements() {
    const byUrl = new Map();
    if (!fs.existsSync(ARCHIVE_DIR)) return byUrl;
    for (const dir of fs.readdirSync(ARCHIVE_DIR)) {
        const rec = path.join(ARCHIVE_DIR, dir, 'record.json');
        if (!fs.existsSync(rec)) continue;
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(rec, 'utf8'));
        } catch {
            continue;
        }
        const sr = parsed.supplierRecord;
        const cm = sr?.customizerMeasurements;
        if (!sr?.sourceUrl || !cm) continue;
        byUrl.set(sr.sourceUrl, {
            mouldingWidthIn: cm.mouldingWidth?.inches ?? null,
            rabbetDepthIn: cm.rabbetDepth?.inches ?? null,
        });
    }
    return byUrl;
}

// Titles come straight out of scraped product-page HTML, so a handful
// arrive entity-encoded ("Barnwood White &amp; Grey Scoop"). Decoding the
// small fixed set the supplier actually emits is enough here and avoids
// pulling in a parser for five characters.
const ENTITIES = {
    '&amp;': '&',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
};

function decodeEntities(text) {
    return text.replace(/&(?:amp|quot|#039|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

function resolveMeasurement(ownRaw, archiveVal) {
    const own = parseImperial(ownRaw);
    if (Number.isFinite(own)) return { value: own, source: 'details.json' };
    if (Number.isFinite(archiveVal)) return { value: archiveVal, source: 'supplier-archive' };
    return { value: null, source: null };
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

const archive = loadArchiveMeasurements();
const folders = fs
    .readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

const frames = [];
const warnings = [];
const seenSku = new Map();

for (const folder of folders) {
    const dir = path.join(ASSETS_DIR, folder);
    const files = fs.readdirSync(dir).filter((f) => f !== 'details.json');

    let details;
    try {
        details = JSON.parse(fs.readFileSync(path.join(dir, 'details.json'), 'utf8'));
    } catch {
        warnings.push({ folder, issue: 'unreadable details.json' });
        continue;
    }

    const sku = deriveSku(files);
    const id = sku ? `frame-${sku}` : `frame-${folder}`;
    if (!sku) warnings.push({ folder, issue: 'no SKU in any filename; id falls back to folder slug' });
    if (seenSku.has(id)) {
        warnings.push({ folder, issue: `duplicate id ${id}, also used by ${seenSku.get(id)}` });
    }
    seenSku.set(id, folder);

    // Group assets by role, dropping the `_1`/`_2` byte-duplicates so a
    // caller picking assets[0] gets a distinct shot rather than a re-upload.
    const assets = {};
    const seenStem = new Set();
    for (const f of files.sort()) {
        const role = classify(f);
        if (role === 'junk') continue;
        const stem = f.toLowerCase().replace(/\.(jpe?g|png|webp)$/, '').replace(/(_\d+)+$/, '');
        if (seenStem.has(stem)) continue;
        seenStem.add(stem);
        (assets[role] ||= []).push(`/frames/assets/${folder}/${f}`);
    }

    const arch = archive.get(details.url) || {};
    const mw = resolveMeasurement(details.mouldingWidth, arch.mouldingWidthIn);
    const rd = resolveMeasurement(details.rabbetDepth, arch.rabbetDepthIn);

    if (!assets.corner?.length) warnings.push({ folder, issue: 'no corner image (thumbnail source)' });
    if (mw.value == null) warnings.push({ folder, issue: 'no moulding width from any source' });

    // Preference order for the 2D rail texture. `rail` is a flat straight-on
    // scan and always wins; `strip` and `assembled` are straight-on too and
    // only need cropping. `corner` is last because recovering a rail from it
    // means perspective-correcting a mitred photo — full coverage, lower
    // fidelity, and flagged as such so the quality is auditable downstream.
    const textureSource =
        (assets.rail?.length && 'rail') ||
        (assets.strip?.length && 'strip') ||
        (assets.assembled?.length && 'assembled') ||
        (assets.corner?.length && 'corner') ||
        null;

    frames.push({
        id,
        sku,
        slug: folder,
        name: decodeEntities(details.title || folder).replace(/\s*Picture Frame$/i, '').trim(),
        sourceUrl: details.url || null,
        mouldingWidthIn: mw.value,
        mouldingWidthSource: mw.source,
        rabbetDepthIn: rd.value,
        rabbetDepthSource: rd.source,
        thumbnail: assets.corner?.[0] || null,
        textureSource,
        textureDerived: textureSource === 'corner',
        assets,
    });
}

const summary = {
    generatedAt: new Date().toISOString(),
    frameCount: frames.length,
    withThumbnail: frames.filter((f) => f.thumbnail).length,
    withMouldingWidth: frames.filter((f) => f.mouldingWidthIn != null).length,
    withRabbetDepth: frames.filter((f) => f.rabbetDepthIn != null).length,
    textureSourceBreakdown: frames.reduce((acc, f) => {
        acc[f.textureSource ?? 'none'] = (acc[f.textureSource ?? 'none'] || 0) + 1;
        return acc;
    }, {}),
    ambiguousAssets: frames.flatMap((f) => (f.assets.ambiguous || []).map((p) => p)),
    warnings,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify({ ...summary, frames }, null, 2), 'utf8');

console.log(`Wrote ${OUT_PATH}`);
console.log(`  frames              ${summary.frameCount}`);
console.log(`  with thumbnail      ${summary.withThumbnail}`);
console.log(`  with moulding width ${summary.withMouldingWidth}`);
console.log(`  with rabbet depth   ${summary.withRabbetDepth}`);
console.log('  texture source     ', summary.textureSourceBreakdown);
console.log(`  ambiguous assets    ${summary.ambiguousAssets.length}`);
console.log(`  warnings            ${warnings.length}`);
for (const w of warnings.slice(0, 15)) console.log(`    - ${w.folder}: ${w.issue}`);
if (warnings.length > 15) console.log(`    ... ${warnings.length - 15} more (see ${OUT_PATH})`);
