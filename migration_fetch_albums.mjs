// Part B (catalogue -> ImageKit migration), fetch step for Albums.
//
// albumsLocal.js's images are currently Cloudinary-hosted and Cloudinary is
// down account-wide. Every item already carries its iTunes collection id,
// and a plain iTunes Lookup (no entity=song — that pulls a full tracklist,
// wasteful for just artwork) returns `artworkUrl100`, whose size token can
// be swapped for a much larger one to get full-resolution cover art,
// independent of Cloudinary entirely.
//
// Apple's documented Search/Lookup API rate limit is ~20 requests/minute —
// this throttles to a bit under that (18/min) rather than racing it, since
// at ~10,000+ albums this is a multi-hour run regardless and getting
// rate-limited/banned partway through would cost far more time than it
// saves. Fully resumable: re-running skips any id already fetched, so an
// interrupted run just picks back up.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALBUMS_LOCAL_COLLECTIONS } from './src/data/albumsLocal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '.migration-staging', 'albums');
const FAILURES_PATH = path.join(__dirname, 'migration_fetch_albums_failures.json');
const REQUESTS_PER_MINUTE = 18;
const INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);

fs.mkdirSync(OUT_DIR, { recursive: true });

// Collections are nested genre -> artist -> track list; walk recursively
// and dedupe by id (a handful of ids do repeat across genre groupings).
function collectItems(node, out) {
    if (Array.isArray(node)) {
        for (const item of node) {
            if (item && item.id && !out.has(item.id)) out.set(item.id, item);
        }
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) collectItems(value, out);
    }
}

const items = new Map();
collectItems(ALBUMS_LOCAL_COLLECTIONS, items);
const unique = Array.from(items.values());

function upsizeArtworkUrl(url) {
    return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/1200x1200bb.$1');
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOne(item) {
    const target = path.join(OUT_DIR, `${item.id}.jpg`);
    if (fs.existsSync(target) && fs.statSync(target).size > 3000) {
        return 'skipped';
    }

    const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(item.id)}&country=US`);
    if (!lookupRes.ok) throw new Error(`iTunes lookup failed (${lookupRes.status})`);
    const data = await lookupRes.json();
    const result = data.results && data.results[0];
    if (!result || !result.artworkUrl100) throw new Error('No artwork returned');

    const artworkRes = await fetch(upsizeArtworkUrl(result.artworkUrl100));
    if (!artworkRes.ok) throw new Error(`Artwork download failed (${artworkRes.status})`);
    const buf = Buffer.from(await artworkRes.arrayBuffer());
    if (buf.length < 3000) throw new Error(`Artwork suspiciously small (${buf.length} bytes)`);
    fs.writeFileSync(target, buf);
    return 'fetched';
}

async function main() {
    console.log(`Found ${unique.length} unique albums. Throttled to ~${REQUESTS_PER_MINUTE}/min — this will take a while.`);

    const failures = [];
    let fetched = 0, skipped = 0;
    const startedAt = Date.now();

    for (let i = 0; i < unique.length; i++) {
        const item = unique[i];
        const target = path.join(OUT_DIR, `${item.id}.jpg`);
        const alreadyDone = fs.existsSync(target) && fs.statSync(target).size > 3000;

        try {
            const result = await fetchOne(item);
            if (result === 'fetched') fetched++;
            if (result === 'skipped') skipped++;
        } catch (err) {
            failures.push({ id: item.id, title: item.title, artist: item.artist, error: err.message });
        }

        // Only the network-hitting path needs throttling — a skip is a
        // local file check with no request made, so it shouldn't eat into
        // the rate budget or slow down a mostly-already-done resume.
        if (!alreadyDone) await sleep(INTERVAL_MS);

        if ((i + 1) % 25 === 0 || i === unique.length - 1) {
            const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
            const etaMin = unique.length > i + 1
                ? (((unique.length - i - 1) * INTERVAL_MS) / 60000).toFixed(0)
                : 0;
            process.stdout.write(`\ralbums: ${i + 1}/${unique.length}  fetched=${fetched} skipped=${skipped} failed=${failures.length}  elapsed=${elapsedMin}m  eta~${etaMin}m   `);
            // Checkpoint failures periodically so a killed process doesn't lose the log.
            if (failures.length) fs.writeFileSync(FAILURES_PATH, JSON.stringify(failures, null, 2));
        }
    }

    console.log(`\nDone. fetched=${fetched} skipped=${skipped} failed=${failures.length} total=${unique.length}`);
    if (failures.length) {
        fs.writeFileSync(FAILURES_PATH, JSON.stringify(failures, null, 2));
        console.log(`Failures logged to ${path.basename(FAILURES_PATH)}`);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
