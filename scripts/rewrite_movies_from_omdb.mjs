// Replaces moviesLocal.js's `image` field with OMDb's own poster URL
// (Amazon-hosted, m.media-amazon.com) instead of a re-hosted copy on
// Cloudinary/ImageKit. Every item carries a real IMDb id, so every item is
// resolvable — no fallback/hosting needed for this category at all.
//
// No bytes are downloaded or uploaded anywhere; this only rewrites the URL
// string in place, same as migration_fetch_movies.mjs's upsizing logic,
// minus the download+ImageKit-upload step that category no longer needs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.join(__dirname, 'src/data/moviesLocal.js');
const OMDB_URL = (id) => `https://www.omdbapi.com/?i=${encodeURIComponent(id)}&apikey=trilogy`;
const CONCURRENCY = 8;

function upsizePosterUrl(url) {
    return url.replace(/_S[XY]\d+(?=\.\w+$)/, '_SX1200');
}

function collectItems(node, out) {
    if (Array.isArray(node)) {
        for (const item of node) if (item && item.id) out.push(item);
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) collectItems(value, out);
    }
}

async function main() {
    const fileUrl = pathToFileURL(dataFilePath).href;
    const { MOVIES_LOCAL_COLLECTIONS } = await import(`${fileUrl}?t=${Date.now()}`);
    const allItems = [];
    collectItems(MOVIES_LOCAL_COLLECTIONS, allItems);

    const byId = new Map();
    for (const item of allItems) if (!byId.has(item.id)) byId.set(item.id, item);
    const unique = Array.from(byId.values());
    console.log(`Found ${unique.length} unique movies.`);

    let content = fs.readFileSync(dataFilePath, 'utf-8');
    const failures = [];
    let rewritten = 0, done = 0;

    for (let i = 0; i < unique.length; i += CONCURRENCY) {
        const batch = unique.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (item) => {
            try {
                const res = await fetch(OMDB_URL(item.id));
                if (!res.ok) throw new Error(`OMDb request failed (${res.status})`);
                const data = await res.json();
                if (!data.Poster || data.Poster === 'N/A') throw new Error('No poster in OMDb response');
                const newUrl = upsizePosterUrl(data.Poster);
                if (content.includes(item.image) && item.image !== newUrl) {
                    content = content.split(item.image).join(newUrl);
                    rewritten++;
                }
            } catch (err) {
                failures.push({ id: item.id, title: item.title, error: err.message });
            }
            done++;
        }));
        process.stdout.write(`\rmovies: ${done}/${unique.length}   `);
    }

    fs.writeFileSync(dataFilePath, content);
    console.log(`\nDone. rewrote=${rewritten} failed=${failures.length} total=${unique.length}`);
    if (failures.length) {
        fs.writeFileSync(path.join(__dirname, 'rewrite_movies_failures.json'), JSON.stringify(failures, null, 2));
        console.log('Failures (left pointing at their old URL) logged to rewrite_movies_failures.json');
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
