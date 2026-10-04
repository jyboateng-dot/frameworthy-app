import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { MET_LOCAL_COLLECTIONS } from '../src/data/metLocal.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(projectRoot, 'met_collection');
const outputPath = path.join(projectRoot, 'src/data/metArtworkPixelDimensions.json');
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function describeFile(filename) {
    let stem = filename.slice(0, -path.extname(filename).length);
    const metObjectId = stem.match(/^MET_(\d+)_/i)?.[1] || null;
    if (metObjectId) stem = stem.replace(/^MET_\d+_/i, '');

    const separator = stem.lastIndexOf(' - ');
    const artist = separator < 0 ? '' : stem.slice(separator + 3);
    const title = separator < 0 ? stem : stem.slice(0, separator);

    return { filename, metObjectId, normalizedTitle: normalize(title), normalizedArtist: normalize(artist) };
}

function findSourceImage(artwork, files) {
    const metId = artwork.id.match(/^met_(\d+)$/)?.[1]
        || artwork.title.match(/^MET\s*(\d+)/i)?.[1];
    if (metId) {
        const byId = files.find(file => file.metObjectId === metId);
        if (byId) return byId;
    }

    const title = normalize(artwork.title);
    let candidates = files.filter(file => file.normalizedTitle === title);
    if (!candidates.length) {
        candidates = files.filter(file => file.normalizedTitle.includes(title) || title.includes(file.normalizedTitle));
    }

    const artist = normalize(artwork.artist);
    if (artist && artist !== 'themetcollection') {
        const artistMatches = candidates.filter(file => file.normalizedArtist === artist);
        if (artistMatches.length) candidates = artistMatches;
    }

    // Local manifest entries use generated IDs, while the matching source
    // file may also have a Met-object-ID-prefixed duplicate. Prefer the
    // non-prefixed file when the manifest has no stable Met ID of its own.
    candidates.sort((a, b) => Number(Boolean(a.metObjectId)) - Number(Boolean(b.metObjectId))
        || a.filename.length - b.filename.length
        || a.filename.localeCompare(b.filename));
    return candidates[0] || null;
}

async function main() {
    if (!fs.existsSync(sourceRoot)) {
        throw new Error(`Missing source image directory: ${sourceRoot}`);
    }

    const dimensionsById = {};
    const missing = [];
    let artworkCount = 0;

    for (const [collection, artworks] of Object.entries(MET_LOCAL_COLLECTIONS)) {
        const collectionPath = path.join(sourceRoot, collection);
        const files = fs.readdirSync(collectionPath)
            .filter(filename => filename.toLowerCase().endsWith('.jpg'))
            .map(describeFile);

        for (const artwork of artworks) {
            artworkCount += 1;
            const sourceImage = findSourceImage(artwork, files);
            if (!sourceImage) {
                missing.push(`${collection}: ${artwork.id} — ${artwork.title}`);
                continue;
            }

            const metadata = await sharp(path.join(collectionPath, sourceImage.filename)).metadata();
            if (!metadata.width || !metadata.height) {
                missing.push(`${collection}: no pixel dimensions for ${sourceImage.filename}`);
                continue;
            }

            const dimensions = { width: metadata.width, height: metadata.height };
            const existing = dimensionsById[artwork.id];
            if (existing && (existing.width !== dimensions.width || existing.height !== dimensions.height)) {
                missing.push(`${collection}: conflicting dimensions for repeated ID ${artwork.id}`);
                continue;
            }
            dimensionsById[artwork.id] = dimensions;
        }
    }

    if (missing.length) {
        throw new Error(`Could not resolve ${missing.length}/${artworkCount} Met images:\n${missing.join('\n')}`);
    }

    const sorted = Object.fromEntries(Object.entries(dimensionsById).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`Wrote dimensions for ${Object.keys(sorted).length} Met catalogue entries to ${outputPath}`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
