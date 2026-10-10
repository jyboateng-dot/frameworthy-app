// Replaces metLocal.js's `image` field with the Met Museum's own public
// Collection API image URL (images.metmuseum.org) for every item that has
// a real Met object number embedded in its id (`met_<digits>`). Items with
// a generated id (`met_local_<hash>`) never had a discoverable object
// number in the original scrape — there's no API path for those, so
// they're left untouched (they should already be pointing at their
// ImageKit-hosted copy from migrate_catalogue_imagekit.mjs).
//
// Met's API has no key requirement and a generous published rate limit
// (keep under ~80 req/s), so this runs at real concurrency, not throttled
// like the iTunes-backed scripts.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.join(__dirname, 'src/data/metLocal.js');
const CONCURRENCY = 20;

function collectItems(node, out) {
    if (Array.isArray(node)) {
        for (const item of node) if (item && item.id) out.push(item);
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) collectItems(value, out);
    }
}

async function main() {
    const fileUrl = pathToFileURL(dataFilePath).href;
    const { MET_LOCAL_COLLECTIONS } = await import(`${fileUrl}?t=${Date.now()}`);
    const allItems = [];
    collectItems(MET_LOCAL_COLLECTIONS, allItems);

    const eligible = allItems.filter(item => /^met_\d+$/.test(item.id));
    const skipped = allItems.length - eligible.length;
    console.log(`Found ${allItems.length} Met items — ${eligible.length} have a real object number (API-eligible), ${skipped} are generated ids (left as-is, stay on ImageKit).`);

    let content = fs.readFileSync(dataFilePath, 'utf-8');
    const failures = [];
    let rewritten = 0, done = 0;

    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
        const batch = eligible.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (item) => {
            const objectId = item.id.replace('met_', '');
            try {
                const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`);
                if (!res.ok) throw new Error(`Met API request failed (${res.status})`);
                const data = await res.json();
                const newUrl = data.primaryImage || data.primaryImageSmall;
                if (!newUrl) throw new Error('Met API returned no image for this object');
                if (content.includes(item.image) && item.image !== newUrl) {
                    content = content.split(item.image).join(newUrl);
                    rewritten++;
                }
            } catch (err) {
                failures.push({ id: item.id, title: item.title, error: err.message });
            }
            done++;
        }));
        process.stdout.write(`\rmet: ${done}/${eligible.length}   `);
    }

    fs.writeFileSync(dataFilePath, content);
    console.log(`\nDone. rewrote=${rewritten} failed=${failures.length} eligible=${eligible.length} skipped(generated-id)=${skipped}`);
    if (failures.length) {
        fs.writeFileSync(path.join(__dirname, 'rewrite_met_failures.json'), JSON.stringify(failures, null, 2));
        console.log('Failures (left on their prior URL) logged to rewrite_met_failures.json');
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
