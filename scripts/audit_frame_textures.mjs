// One-off audit, not part of the app build — scopes the texture-crop
// quality problem found while investigating a bad AR render (Gold Flat
// rendered fine; Flat Black Wide rendered silver instead of black because
// its render-asset was cropped from a generic gray "imagemanipulator_
// default_swap" placeholder mockup rather than a real photo of the frame).
//
// Flags two independent, mechanically-detectable failure modes per frame's
// frontTexture.horizontalPath (the texture actually used for AR rendering):
//
//   flat        near-zero pixel variance — a placeholder/mockup crop
//               rather than a real, grained moulding photo.
//   padding     a large fraction of the strip's rows are uniform near-white
//               background rather than moulding material — a crop box that
//               didn't tightly bound the real content.
//   colorOff    the catalogued `color` field is an unambiguous dark or
//               light name, but the texture's average brightness disagrees
//               outright. Deliberately conservative — only flags a clear
//               contradiction, not a plausible material variation.
//
// Read-only: writes one report file, touches nothing else.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = path.join(import.meta.dirname, 'public');
const renderProfiles = JSON.parse(readFileSync('src/data/frameRenderProfiles.json', 'utf8')).profiles;
const catalogueRaw = JSON.parse(readFileSync('src/data/frameCatalogue.json', 'utf8'));
const catalogueList = Array.isArray(catalogueRaw) ? catalogueRaw : (catalogueRaw.frames || Object.values(catalogueRaw));
const catalogueById = new Map(catalogueList.map((f) => [f.id, f]));

const PADDING_ROW_MEAN_MIN = 235; // near-white
const PADDING_ROW_STDDEV_MAX = 8; // near-flat
const PADDING_FRACTION_FLAG = 0.25;
const FLAT_STDDEV_FLAG = 4;
const DARK_NAME_RE = /\b(black|espresso|ebony|charcoal|dark)\b/i;
const LIGHT_NAME_RE = /\b(white|ivory|cream|alabaster|snow)\b/i;

async function analyze(id, relPath) {
    const absPath = path.join(PUBLIC_DIR, relPath.replace(/^\//, ''));
    // Deliberately no alpha handling — only R/G/B (channels 0-2) are ever
    // read below, so an incidental 4th alpha channel is harmless to ignore.
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
    const paddingFraction = paddingRows / height;

    return { width, height, meanLum, stddevLum, paddingFraction };
}

const ids = Object.keys(renderProfiles);
const flagged = [];
let processed = 0;

for (const id of ids) {
    const profile = renderProfiles[id];
    const relPath = profile.frontTexture?.horizontalPath;
    if (!relPath) continue;

    let stats;
    try {
        stats = await analyze(id, relPath);
    } catch (err) {
        flagged.push({ id, name: profile.sourceProductName, reasons: [`unreadable: ${err.message}`] });
        continue;
    }
    processed++;

    const reasons = [];
    if (stats.stddevLum < FLAT_STDDEV_FLAG) reasons.push(`flat (stddev ${stats.stddevLum.toFixed(1)})`);
    if (stats.paddingFraction > PADDING_FRACTION_FLAG) reasons.push(`padding (${Math.round(stats.paddingFraction * 100)}% of rows near-blank)`);

    const catColor = catalogueById.get(id)?.name || profile.sourceProductName || '';
    if (DARK_NAME_RE.test(catColor) && stats.meanLum > 140) reasons.push(`colorOff (named dark, mean luminance ${stats.meanLum.toFixed(0)}/255)`);
    if (LIGHT_NAME_RE.test(catColor) && stats.meanLum < 90) reasons.push(`colorOff (named light, mean luminance ${stats.meanLum.toFixed(0)}/255)`);

    if (reasons.length) {
        const cat = catalogueById.get(id);
        flagged.push({
            id,
            name: profile.sourceProductName,
            texturePath: relPath,
            reasons,
            hasCornerAlt: (cat?.assets?.corner || []).length > 0,
            hasProfileAlt: (cat?.assets?.profile || []).length > 0,
            assembledIsPlaceholder: /imagemanipulator_default_swap/i.test((cat?.assets?.assembled || [])[0] || ''),
        });
    }
}

const report = {
    generatedAt: new Date().toISOString(),
    totalFrames: ids.length,
    processed,
    flaggedCount: flagged.length,
    flagged,
};
writeFileSync('audit_frame_textures_report.json', JSON.stringify(report, null, 2));
console.log(`Processed ${processed}/${ids.length} frames. Flagged ${flagged.length}.`);

const byReason = { flat: 0, padding: 0, colorOff: 0, unreadable: 0 };
for (const f of flagged) {
    for (const r of f.reasons) {
        if (r.startsWith('flat')) byReason.flat++;
        else if (r.startsWith('padding')) byReason.padding++;
        else if (r.startsWith('colorOff')) byReason.colorOff++;
        else byReason.unreadable++;
    }
}
console.log('By reason:', byReason);
console.log('Of flagged, have a real corner photo to re-crop from:', flagged.filter((f) => f.hasCornerAlt).length);
console.log('Of flagged, assembled source is the generic swap placeholder:', flagged.filter((f) => f.assembledIsPlaceholder).length);
