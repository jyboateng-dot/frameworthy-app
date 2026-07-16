import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOVIESLOCAL_PATH = path.join(__dirname, 'moviesLocal.js');
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const MOVIES_IMG_DIR = path.join(PROJECT_ROOT, 'public', 'movies');

// Amazon/IMDb CDN URLs often carry a size/crop modifier (e.g. `_SX300`,
// `_UX380_CR0,0,380,562_`) appended right after `._V1_` — stripping it back
// to a bare `._V1_.jpg` requests the original, full-resolution poster.
function normalizeToOriginal(url) {
    return url.replace(/\._V1_[^./]*\.jpg(\?.*)?$/i, '._V1_.jpg');
}

function downloadImage(url, destPath, retries = 3) {
    return new Promise((resolve, reject) => {
        const attempt = (currentUrl, remaining) => {
            const file = fs.createWriteStream(destPath);
            const cleanup = () => { file.close(); fs.unlink(destPath, () => {}); };

            https.get(currentUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (FrameWorthyApp movie poster downloader)' } }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    cleanup();
                    attempt(res.headers.location, remaining);
                    return;
                }
                if (res.statusCode !== 200) {
                    cleanup();
                    if (remaining > 0) {
                        setTimeout(() => attempt(currentUrl, remaining - 1), 500);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                    return;
                }
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', (err) => { cleanup(); reject(err); });
            }).on('error', (err) => {
                cleanup();
                if (remaining > 0) {
                    setTimeout(() => attempt(currentUrl, remaining - 1), 500);
                } else {
                    reject(err);
                }
            });
        };
        attempt(url, retries);
    });
}

async function downloadMoviePosters() {
    if (!fs.existsSync(MOVIES_IMG_DIR)) {
        fs.mkdirSync(MOVIES_IMG_DIR, { recursive: true });
    }

    const text = fs.readFileSync(MOVIESLOCAL_PATH, 'utf-8');
    const match = text.match(/export const MOVIES_LOCAL_COLLECTIONS = (\{[\s\S]*\});/);
    if (!match) {
        console.error("Could not parse MOVIES_LOCAL_COLLECTIONS");
        return;
    }
    const data = eval('(' + match[1] + ')');

    // Dedupe by id — the same movie appears in "IMDB Top 200" AND its
    // matching genre bucket(s), but only needs to be downloaded once.
    const uniqueMovies = new Map();
    for (const tab in data) {
        for (const movie of data[tab]) {
            if (!uniqueMovies.has(movie.id)) {
                uniqueMovies.set(movie.id, movie);
            }
        }
    }

    console.log(`Downloading ${uniqueMovies.size} unique movie posters (original resolution)...`);
    let downloaded = 0, failed = 0, skipped = 0;
    const localPathById = new Map();

    let i = 0;
    for (const [id, movie] of uniqueMovies) {
        i++;
        const destFile = `${id}.jpg`;
        const destPath = path.join(MOVIES_IMG_DIR, destFile);
        const localWebPath = `/movies/${destFile}`;

        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
            skipped++;
            localPathById.set(id, localWebPath);
            continue;
        }

        const originalUrl = normalizeToOriginal(movie.image);
        try {
            await downloadImage(originalUrl, destPath);
            downloaded++;
            localPathById.set(id, localWebPath);
            console.log(`  [${i}/${uniqueMovies.size}] Downloaded: ${movie.title}`);
        } catch (err) {
            failed++;
            console.error(`  [${i}/${uniqueMovies.size}] Failed: ${movie.title} (${id}) — ${err.message}. Keeping remote URL as fallback.`);
            // Don't break the app over a single failed download — fall back
            // to the original (normalized) remote URL for this one entry.
            localPathById.set(id, originalUrl);
        }

        await new Promise(r => setTimeout(r, 150)); // gentle rate limiting
    }

    // Rewrite moviesLocal.js with local paths, preserving all metadata
    // (id, title, year) exactly as-is — only `image` changes.
    for (const tab in data) {
        for (const movie of data[tab]) {
            const localPath = localPathById.get(movie.id);
            if (localPath) movie.image = localPath;
        }
    }

    const output = `export const MOVIES_LOCAL_COLLECTIONS = ${JSON.stringify(data, null, 4)};\n`;
    fs.writeFileSync(MOVIESLOCAL_PATH, output, 'utf-8');

    console.log(`\nDone. Downloaded: ${downloaded}, already present: ${skipped}, failed (kept remote URL): ${failed}, total unique: ${uniqueMovies.size}`);
}

downloadMoviePosters();
