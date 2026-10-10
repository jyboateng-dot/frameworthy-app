// Replaces public/museum-data/artists_and_masterpieces.json's `image`
// field with bymuseum.com's own hosted image URL (their own WordPress
// uploads directory) instead of a re-hosted copy on Cloudinary. Every
// item's id embeds the original WooCommerce product id
// (`bymuseum_<id>`), and bymuseum.com's own Store API
// (wp-json/wc/store/v1/products/<id>) is confirmed live and returns the
// image directly — no re-hosting needed.
//
// This file is plain JSON (not a JS module like the src/data/*.js
// catalogues), served statically and fetched by MuseumArtPage.jsx at
// runtime, so it's safe to parse/modify/write back as JSON rather than
// needing text-preserving string replacement.
//
// Cautious concurrency (6, not the 20 that tripped Met's Incapsula bot
// protection) with a circuit breaker: 5 consecutive failures pauses the
// run rather than blasting through all 5,097 items and risking the same
// kind of block.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.join(__dirname, 'public/museum-data/artists_and_masterpieces.json');
const CONCURRENCY = 6;
const MAX_CONSECUTIVE_FAILURES = 5;

async function main() {
    const items = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    console.log(`Found ${items.length} items.`);

    const failures = [];
    let rewritten = 0, done = 0, consecutiveFailures = 0;
    let circuitBroken = false;

    const remaining = items.filter(item => !(typeof item.image === 'string' && item.image.includes('bymuseum.com/wp-content')));
    console.log(`${items.length - remaining.length} already done, ${remaining.length} remaining.`);

    for (let i = 0; i < remaining.length && !circuitBroken; i += CONCURRENCY) {
        const batch = remaining.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (item) => {
            const productId = item.id.replace('bymuseum_', '');
            try {
                const res = await fetch(`https://bymuseum.com/wp-json/wc/store/v1/products/${productId}`);
                if (!res.ok) throw new Error(`bymuseum API request failed (${res.status})`);
                const data = await res.json();
                const newUrl = data.images && data.images[0] && data.images[0].src;
                if (!newUrl) throw new Error('No image in bymuseum response');
                return { ok: true, item, newUrl };
            } catch (err) {
                return { ok: false, item, error: err.message };
            }
        }));

        for (const r of results) {
            done++;
            if (r.ok) {
                if (r.item.image !== r.newUrl) {
                    r.item.image = r.newUrl;
                    rewritten++;
                }
                consecutiveFailures = 0;
            } else {
                failures.push({ id: r.item.id, title: r.item.title, error: r.error });
                consecutiveFailures++;
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    console.error(`\n${consecutiveFailures} consecutive failures — stopping early to avoid tripping bot protection (see Met's Incapsula block for why). Re-run to resume; already-rewritten items are skipped automatically.`);
                    circuitBroken = true;
                }
            }
        }
        process.stdout.write(`\rmasterpieces: ${done}/${remaining.length}  rewrote=${rewritten} failed=${failures.length}   `);
        // Flush periodically, not just at the end — a kill or circuit
        // break should lose at most one interval of work, matching the
        // resumability the fetch scripts already have.
        if (done % 200 === 0 || circuitBroken) {
            fs.writeFileSync(dataFilePath, JSON.stringify(items, null, 2));
        }
    }

    fs.writeFileSync(dataFilePath, JSON.stringify(items, null, 2));
    console.log(`\nDone. rewrote=${rewritten} failed=${failures.length} total=${items.length}${circuitBroken ? ' (stopped early)' : ''}`);
    if (failures.length) {
        fs.writeFileSync(path.join(__dirname, 'rewrite_masterpieces_failures.json'), JSON.stringify(failures, null, 2));
        console.log('Failures (left on their prior URL) logged to rewrite_masterpieces_failures.json');
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
