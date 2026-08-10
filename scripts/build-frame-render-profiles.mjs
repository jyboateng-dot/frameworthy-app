#!/usr/bin/env node
/**
 * Creates the compact browser payload used by the 2D and AR renderers.
 * The full supplier manifest contains thousands of image variants and remains
 * an ingest/source-of-truth file; the renderer only needs physical geometry
 * and material classification for each selected FrameWorthy SKU.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'src/data/frameworthy-frame-details.json');
const outputPath = resolve(root, 'src/data/frameRenderProfiles.json');

const details = JSON.parse(await readFile(sourcePath, 'utf8'));
const profiles = {};

for (const record of details.records) {
    const measurements = record.customizerMeasurements;
    const label = `${record.productName || ''} ${record.currentName || ''} ${record.details?.Style || ''}`.toLowerCase();
    profiles[record.frameworthyFrameId] = {
        mouldingWidthIn: measurements?.mouldingWidth?.inches ?? null,
        rabbetDepthIn: measurements?.rabbetDepth?.inches ?? null,
        style: record.details?.Style || null,
        color: record.details?.Color || null,
        frameType: record.details?.['Frame Type'] || null,
        sourceProductName: record.productName || null,
        frontTexture: record.renderAssets?.front ? {
            horizontalPath: record.renderAssets.front.localHorizontalPath,
            verticalPath: record.renderAssets.front.localVerticalPath,
        } : null,
        profileTexturePath: record.renderAssets?.profile?.localPath || null,
        profileReferenceUrl: record.renderAssets?.profile?.sourceUrl || null,
        cornerTexturePaths: record.renderAssets?.corners?.map(item => item.localPath).filter(Boolean) || [],
        cornerReferenceUrls: record.renderAssets?.corners?.map(item => item.sourceUrl) || [],
        profile: /floater|float frame/.test(label) ? 'floater'
            : /scoop|reverse/.test(label) ? 'scoop'
                : /deep|shadow/.test(label) ? 'deep'
                    : /bevel|angled|lip/.test(label) ? 'bevel'
                        : /ornate|renaissance|embossed|carved|bamboo/.test(label) ? 'raised'
                            : 'flat',
        finish: /gold|silver|pewter|metallic|chrome|bronze|copper|rose gold/.test(label)
            ? 'metallic'
            : /glossy|lacquer/.test(label)
                ? 'gloss'
                : 'matte',
    };
}

await writeFile(outputPath, `${JSON.stringify({
    generatedAt: details.generatedAt,
    profileCount: Object.keys(profiles).length,
    profiles,
}, null, 2)}\n`);

console.log(`Wrote ${Object.keys(profiles).length} render profiles to ${outputPath}`);
