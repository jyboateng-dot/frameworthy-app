// Re-runs the same pixel checks from audit_frame_textures.mjs, but against
// public/frames/rails/<id>-rail-h.webp (the OTHER, more sophisticated
// extraction pipeline — build-rail-textures.mjs, with real corner-flattening)
// instead of render-assets. Scoped to just the 54 frames already flagged
// against their render-assets texture, to see how many are ALREADY fixed
// over there vs. genuinely need new work.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = path.join(import.meta.dirname, 'public');
const report = JSON.parse(readFileSync('audit_frame_textures_report.json', 'utf8'));
const rails = JSON.parse(readFileSync('src/data/frameRails.json', 'utf8')).rails;
const catalogueRaw = JSON.parse(readFileSync('src/data/frameCatalogue.json', 'utf8'));
const catalogueList = Array.isArray(catalogueRaw) ? catalogueRaw : (catalogueRaw.frames || Object.values(catalogueRaw));
const catalogueById = new Map(catalogueList.map((f) => [f.id, f]));

const PADDING_ROW_MEAN_MIN = 235;
const PADDING_ROW_STDDEV_MAX = 8;
const PADDING_FRACTION_FLAG = 0.25;
const FLAT_STDDEV_FLAG = 4;
const DARK_NAME_RE = /\b(black|espresso|ebony|charcoal|dark)\b/i;
const LIGHT_NAME_RE = /\b(white|ivory|cream|alabaster|snow)\b/i;

async function analyze(absPath) {
    const { data, info } = await sharp(absPath).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const rowStats = [];
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let y = 0; y < height; y++) {
        let rowSum = 0;
        let rowSumSq = 0;
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * channels;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            rowSum += lum;
            rowSumSq += lum * lum;
            sum += lum;
            sumSq += lum * lum;
            n++;
        }
        const rowMean = rowSum / width;
        const rowVar = rowSumSq / width - rowMean * rowMean;
        rowStats.push({ mean: rowMean, stddev: Math.sqrt(Math.max(0, rowVar)) });
    }
    const meanLum = sum / n;
    const variance = sumSq / n - meanLum * meanLum;
    const stddevLum = Math.sqrt(Math.max(0, variance));
    const paddingRows = rowStats.filter((r) => r.mean > PADDING_ROW_MEAN_MIN && r.stddev < PADDING_ROW_STDDEV_MAX).length;
    return { meanLum, stddevLum, paddingFraction: paddingRows / height };
}

const results = [];
for (const flaggedFrame of report.flagged) {
    const { id } = flaggedFrame;
    const railPath = rails[id]?.h;
    if (!railPath) {
        results.push({ id, name: flaggedFrame.name, status: 'no-rails-entry' });
        continue;
    }
    const absPath = path.join(PUBLIC_DIR, railPath.replace(/^\//, ''));
    let stats;
    try {
        stats = await analyze(absPath);
    } catch (err) {
        results.push({ id, name: flaggedFrame.name, status: `unreadable: ${err.message}` });
        continue;
    }
    const reasons = [];
    if (stats.stddevLum < FLAT_STDDEV_FLAG) reasons.push('flat');
    if (stats.paddingFraction > PADDING_FRACTION_FLAG) reasons.push('padding');
    const catColor = catalogueById.get(id)?.name || flaggedFrame.name || '';
    if (DARK_NAME_RE.test(catColor) && stats.meanLum > 140) reasons.push(`colorOff(${stats.meanLum.toFixed(0)})`);
    if (LIGHT_NAME_RE.test(catColor) && stats.meanLum < 90) reasons.push(`colorOff(${stats.meanLum.toFixed(0)})`);

    results.push({
        id,
        name: flaggedFrame.name,
        railQuality: rails[id].quality,
        status: reasons.length ? 'still-flagged' : 'clean',
        reasons,
        meanLum: Math.round(stats.meanLum),
        stddevLum: Number(stats.stddevLum.toFixed(1)),
        paddingFraction: Number(stats.paddingFraction.toFixed(2)),
    });
}

writeFileSync('audit_rails_for_flagged_report.json', JSON.stringify(results, null, 2));
const clean = results.filter((r) => r.status === 'clean').length;
const stillBad = results.filter((r) => r.status === 'still-flagged');
const missing = results.filter((r) => r.status !== 'clean' && r.status !== 'still-flagged');
console.log(`${results.length} flagged frames checked against rails/`);
console.log(`  already clean in rails/: ${clean}`);
console.log(`  still bad in rails/ too: ${stillBad.length}`, stillBad.map((r) => `${r.id}(${r.reasons.join(',')})`));
console.log(`  missing/unreadable: ${missing.length}`, missing.map((r) => r.id));
