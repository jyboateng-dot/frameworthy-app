// Part B (catalogue -> ImageKit migration), fetch step for the four
// supplier-sourced Inspiration categories (canvas art, glossy art, original
// paintings, prestige paintings).
//
// These were originally scraped from bubolaenaibo.com via the URL lists
// already in this repo (canvas_urls.txt, glossy_urls.txt,
// original_paintings_urls.txt, prestige_urls.txt) — confirmed still live.
// Generalizes the shape already proven by download_canvas.py /
// download_glossy.py / download_originals.py / download_prestige.py (kept
// as-is, not modified) into one script targeting the migration staging
// folder instead of their original public/ output dirs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://www.bubolaenaibo.com/';
const CONCURRENCY = 8;

const TARGETS = [
    { urlList: 'canvas_urls.txt', outDir: 'canvas-art' },
    { urlList: 'glossy_urls.txt', outDir: 'glossy-art' },
    { urlList: 'original_paintings_urls.txt', outDir: 'original-paintings' },
    { urlList: 'prestige_urls.txt', outDir: 'original-paintings-prestige' },
];

async function fetchOne(urlPath, outDir) {
    const filename = path.basename(urlPath);
    const target = path.join(outDir, filename);
    if (fs.existsSync(target) && fs.statSync(target).size > 10000) {
        return 'skipped';
    }
    const res = await fetch(BASE_URL + urlPath, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) throw new Error(`Suspiciously small (${buf.length} bytes)`);
    fs.writeFileSync(target, buf);
    return 'fetched';
}

async function fetchTarget({ urlList, outDir: outDirName }) {
    const listPath = path.join(__dirname, urlList);
    const paths = fs.readFileSync(listPath, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean);
    const outDir = path.join(__dirname, '.migration-staging', outDirName);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`\n=== ${urlList} (${paths.length} files) -> .migration-staging/${outDirName} ===`);
    const failures = [];
    let fetched = 0, skipped = 0, done = 0;

    for (let i = 0; i < paths.length; i += CONCURRENCY) {
        const batch = paths.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (p) => {
            try {
                return await fetchOne(p, outDir);
            } catch (err) {
                failures.push({ path: p, error: err.message });
                return 'failed';
            }
        }));
        for (const r of results) {
            if (r === 'fetched') fetched++;
            if (r === 'skipped') skipped++;
        }
        done += batch.length;
        process.stdout.write(`\r${outDirName}: ${done}/${paths.length}   `);
    }
    console.log(`\n${outDirName}: fetched=${fetched} skipped=${skipped} failed=${failures.length}`);
    return { outDirName, failures };
}

async function main() {
    const allFailures = {};
    for (const target of TARGETS) {
        const { outDirName, failures } = await fetchTarget(target);
        if (failures.length) allFailures[outDirName] = failures;
    }
    if (Object.keys(allFailures).length) {
        fs.writeFileSync(path.join(__dirname, 'migration_fetch_supplier_failures.json'), JSON.stringify(allFailures, null, 2));
        console.log('\nSome failures occurred, see migration_fetch_supplier_failures.json');
    } else {
        console.log('\nAll supplier-category fetches succeeded.');
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
