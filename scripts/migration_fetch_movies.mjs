// Part B (catalogue -> ImageKit migration), fetch step for Movies.
//
// moviesLocal.js's images are currently Cloudinary-hosted and Cloudinary is
// down account-wide, so there is nothing to pull them FROM there anymore.
// But every item already carries its IMDb id, and OMDb (the same
// apikey=trilogy demo key already used client-side in
// src/utils/moviePoster.js) returns a `Poster` field — a full-resolution,
// Amazon-hosted poster URL, independent of Cloudinary entirely. This
// re-fetches every poster fresh from OMDb into .migration-staging/movies/,
// keyed by IMDb id so the upload step can deterministically rebuild each
// item's new ImageKit URL from the id alone.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOVIES_LOCAL_COLLECTIONS } from './src/data/moviesLocal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '.migration-staging', 'movies');
const OMDB_URL = (id) => `https://www.omdbapi.com/?i=${encodeURIComponent(id)}&apikey=trilogy`;
const CONCURRENCY = 8;

fs.mkdirSync(OUT_DIR, { recursive: true });

// Same collection can list the same movie more than once — dedupe by id so
// each poster is only fetched once.
const items = new Map();
for (const list of Object.values(MOVIES_LOCAL_COLLECTIONS)) {
    for (const item of list) {
        if (!items.has(item.id)) items.set(item.id, item);
    }
}
const unique = Array.from(items.values());
console.log(`Found ${unique.length} unique movies to fetch.`);

// OMDb's default Poster URL is a small size-limited crop
// (..._V1_SX300.jpg); swapping the size token for a much larger one
// returns the same image at full resolution.
function upsizePosterUrl(url) {
    return url.replace(/_S[XY]\d+(?=\.\w+$)/, '_SX1200');
}

async function fetchOne(item) {
    const target = path.join(OUT_DIR, `${item.id}.jpg`);
    if (fs.existsSync(target) && fs.statSync(target).size > 5000) {
        return { id: item.id, status: 'skipped' };
    }

    const detailsRes = await fetch(OMDB_URL(item.id));
    if (!detailsRes.ok) throw new Error(`OMDb request failed (${detailsRes.status})`);
    const details = await detailsRes.json();
    if (!details.Poster || details.Poster === 'N/A') {
        throw new Error('OMDb has no poster for this title');
    }

    const posterRes = await fetch(upsizePosterUrl(details.Poster));
    if (!posterRes.ok) throw new Error(`Poster download failed (${posterRes.status})`);
    const buf = Buffer.from(await posterRes.arrayBuffer());
    if (buf.length < 5000) throw new Error(`Poster suspiciously small (${buf.length} bytes)`);
    fs.writeFileSync(target, buf);
    return { id: item.id, status: 'fetched' };
}

async function main() {
    const failures = [];
    let fetched = 0, skipped = 0, done = 0;

    for (let i = 0; i < unique.length; i += CONCURRENCY) {
        const batch = unique.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (item) => {
            try {
                return await fetchOne(item);
            } catch (err) {
                failures.push({ id: item.id, title: item.title, error: err.message });
                return { id: item.id, status: 'failed' };
            }
        }));
        for (const r of results) {
            if (r.status === 'fetched') fetched++;
            if (r.status === 'skipped') skipped++;
        }
        done += batch.length;
        process.stdout.write(`\rmovies: ${done}/${unique.length}   `);
    }

    console.log(`\nDone. fetched=${fetched} skipped=${skipped} failed=${failures.length} total=${unique.length}`);
    if (failures.length) {
        fs.writeFileSync(path.join(__dirname, 'migration_fetch_movies_failures.json'), JSON.stringify(failures, null, 2));
        console.log('Failures logged to migration_fetch_movies_failures.json');
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
