// Replaces albumsLocal.js's `image` field with iTunes' own cover art URL
// (mzstatic.com) instead of a re-hosted copy on Cloudinary/ImageKit. Every
// item carries a real iTunes collection id, so every item is resolvable —
// no fallback/hosting needed for this category at all.
//
// Throttled to ~60 req/min. Requests are sequential-with-delay, not
// concurrent bursts — the pattern that tripped the Met Museum API's
// Incapsula bot-protection was 20 requests fired at once, not a sustained
// rate; one request every second reads very differently to bot-detection
// than a burst does, even at a higher nominal rate than Apple's commonly
// cited ~20/min figure. Resumable: an item already pointing at an
// mzstatic.com URL is skipped, so an interrupted run just picks back up —
// if this rate turns out to trip something, drop REQUESTS_PER_MINUTE back
// down and re-run; nothing already-rewritten is redone.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.join(__dirname, 'src/data/albumsLocal.js');
const FAILURES_PATH = path.join(__dirname, 'rewrite_albums_failures.json');
const REQUESTS_PER_MINUTE = 60;
const INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);

function upsizeArtworkUrl(url) {
    return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/1200x1200bb.$1');
}

function collectItems(node, out) {
    if (Array.isArray(node)) {
        for (const item of node) if (item && item.id) out.push(item);
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) collectItems(value, out);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Periodic saves of this file kept dying with a transient Windows I/O
// error (errno -4094, UNKNOWN, on writeFileSync) — most likely OneDrive or
// antivirus briefly locking the file mid-sync right as a save lands (this
// repo's path is under Desktop, commonly OneDrive-redirected). A single
// failed write shouldn't kill hours of fetched progress, so this retries
// with backoff before giving up.
async function writeFileWithRetry(filePath, data, attempts = 5) {
    for (let i = 1; i <= attempts; i++) {
        try {
            fs.writeFileSync(filePath, data);
            return;
        } catch (err) {
            if (i === attempts) throw err;
            await sleep(200 * i);
        }
    }
}

async function main() {
    const fileUrl = pathToFileURL(dataFilePath).href;
    const { ALBUMS_LOCAL_COLLECTIONS } = await import(`${fileUrl}?t=${Date.now()}`);
    const allItems = [];
    collectItems(ALBUMS_LOCAL_COLLECTIONS, allItems);

    const byId = new Map();
    for (const item of allItems) if (!byId.has(item.id)) byId.set(item.id, item);
    const unique = Array.from(byId.values());
    console.log(`Found ${unique.length} unique albums. Throttled to ~${REQUESTS_PER_MINUTE}/min — this will take a while.`);

    let content = fs.readFileSync(dataFilePath, 'utf-8');
    const failures = [];
    let rewritten = 0, skipped = 0;
    const startedAt = Date.now();

    for (let i = 0; i < unique.length; i++) {
        const item = unique[i];
        if (typeof item.image === 'string' && item.image.includes('mzstatic.com')) {
            skipped++;
        } else {
            try {
                const res = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(item.id)}&country=US`);
                if (!res.ok) throw new Error(`iTunes lookup failed (${res.status})`);
                const data = await res.json();
                const result = data.results && data.results[0];
                if (!result || !result.artworkUrl100) throw new Error('No artwork returned');
                const newUrl = upsizeArtworkUrl(result.artworkUrl100);
                if (content.includes(item.image) && item.image !== newUrl) {
                    content = content.split(item.image).join(newUrl);
                    rewritten++;
                }
            } catch (err) {
                failures.push({ id: item.id, title: item.title, artist: item.artist, error: err.message });
            }
            await sleep(INTERVAL_MS);
        }

        if ((i + 1) % 25 === 0 || i === unique.length - 1) {
            const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
            const etaMin = unique.length > i + 1 ? (((unique.length - i - 1) * INTERVAL_MS) / 60000).toFixed(0) : 0;
            process.stdout.write(`\ralbums: ${i + 1}/${unique.length}  rewrote=${rewritten} skipped=${skipped} failed=${failures.length}  elapsed=${elapsedMin}m  eta~${etaMin}m   `);
            await writeFileWithRetry(dataFilePath, content);
            if (failures.length) await writeFileWithRetry(FAILURES_PATH, JSON.stringify(failures, null, 2));
        }
    }

    await writeFileWithRetry(dataFilePath, content);
    console.log(`\nDone. rewrote=${rewritten} skipped(already done)=${skipped} failed=${failures.length} total=${unique.length}`);
    if (failures.length) {
        await writeFileWithRetry(FAILURES_PATH, JSON.stringify(failures, null, 2));
        console.log(`Failures (left on their prior URL) logged to ${path.basename(FAILURES_PATH)}`);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
