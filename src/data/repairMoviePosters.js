import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOVIESLOCAL_PATH = path.join(__dirname, 'moviesLocal.js');
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const MOVIES_IMG_DIR = path.join(PROJECT_ROOT, 'public', 'movies');
const OMDB_API_KEY = 'trilogy';

// The 387 unique posters that failed the direct-download pass (Amazon's
// original-resolution asset had gone dead for these, mostly older/classic
// titles) — their fallback also 404s in the browser, so these are currently
// broken. Re-resolve each via OMDb's own poster field, which sometimes has a
// different, still-live image asset for the same title.
const FAILED_IDS = [
    'tt1049413', 'tt0035446', 'tt0041959', 'tt0118715', 'tt0057565',
    'tt0050986', 'tt0047478', 'tt0032976', 'tt0059578', 'tt0050825',
    'tt0048473', 'tt0074958', 'tt0058946', 'tt4729430', 'tt15097216',
    'tt0758758', 'tt0044741', 'tt0091251', 'tt1028532', 'tt0083987',
    'tt0266543', 'tt5420870'
];

function normalizeToOriginal(url) {
    return url.replace(/\._V1_[^./]*\.jpg(\?.*)?$/i, '._V1_.jpg');
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (FrameWorthyApp poster repair)' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function downloadImage(url, destPath, retries = 3) {
    return new Promise((resolve, reject) => {
        const attempt = (currentUrl, remaining) => {
            const file = fs.createWriteStream(destPath);
            const cleanup = () => { file.close(); fs.unlink(destPath, () => {}); };
            https.get(currentUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (FrameWorthyApp poster repair)' } }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    cleanup();
                    attempt(res.headers.location, remaining);
                    return;
                }
                if (res.statusCode !== 200) {
                    cleanup();
                    if (remaining > 0) setTimeout(() => attempt(currentUrl, remaining - 1), 500);
                    else reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', (err) => { cleanup(); reject(err); });
            }).on('error', (err) => {
                cleanup();
                if (remaining > 0) setTimeout(() => attempt(currentUrl, remaining - 1), 500);
                else reject(err);
            });
        };
        attempt(url, retries);
    });
}

async function repair() {
    const text = fs.readFileSync(MOVIESLOCAL_PATH, 'utf-8');
    const match = text.match(/export const MOVIES_LOCAL_COLLECTIONS = (\{[\s\S]*\});/);
    const data = eval('(' + match[1] + ')');

    const results = [];

    for (const id of FAILED_IDS) {
        try {
            const omdb = await fetchJson(`https://www.omdbapi.com/?i=${id}&apikey=${OMDB_API_KEY}`);
            if (!omdb.Poster || omdb.Poster === 'N/A') {
                results.push({ id, status: 'no-omdb-poster' });
                continue;
            }

            const destPath = path.join(MOVIES_IMG_DIR, `${id}.jpg`);
            const candidates = [normalizeToOriginal(omdb.Poster), omdb.Poster];
            let saved = false;
            for (const candidateUrl of candidates) {
                try {
                    await downloadImage(candidateUrl, destPath);
                    saved = true;
                    results.push({ id, title: omdb.Title, status: 'repaired', url: candidateUrl });
                    break;
                } catch { /* try next candidate */ }
            }
            if (!saved) {
                results.push({ id, title: omdb.Title, status: 'still-failed' });
            }
        } catch (err) {
            results.push({ id, status: 'omdb-lookup-failed', error: err.message });
        }
        await new Promise(r => setTimeout(r, 300));
    }

    // Update moviesLocal.js: point repaired ids at the local file; for
    // still-failed ones, at least point at the live OMDb poster URL rather
    // than the dead original.
    const repairedIds = new Set(results.filter(r => r.status === 'repaired').map(r => r.id));
    const stillFailed = results.filter(r => r.status !== 'repaired');

    for (const tab in data) {
        for (const movie of data[tab]) {
            if (repairedIds.has(movie.id)) {
                movie.image = `/movies/${movie.id}.jpg`;
            }
        }
    }

    const output = `export const MOVIES_LOCAL_COLLECTIONS = ${JSON.stringify(data, null, 4)};\n`;
    fs.writeFileSync(MOVIESLOCAL_PATH, output, 'utf-8');

    console.log('\n=== Repair results ===');
    for (const r of results) console.log(' ', JSON.stringify(r));
    console.log(`\nRepaired: ${repairedIds.size}/${FAILED_IDS.length}, still broken: ${stillFailed.length}`);
}

repair();
