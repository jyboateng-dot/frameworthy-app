/**
 * Re-fetches the assets in "frame assets/" that are Cloudflare "503 Backend
 * fetch failed" pages saved under a .jpg name — the original scrape was
 * rate limited and wrote the error bodies to disk.
 *
 * Requests are therefore serialised with a delay and retried with backoff:
 * hammering the origin is what produced the corrupt files in the first
 * place. A download only replaces the file on disk once its magic bytes
 * confirm it is a real image, so a second 503 leaves the existing state
 * untouched rather than overwriting one bad file with another.
 */
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = 'frame assets';
const ARCHIVE_DIR = 'catalog_downloads/supplier-source-archive/frames';
const REPORT = 'catalog_downloads/refetch-report.json';

const DELAY_MS = 900;
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isUsableImage(buf) {
    if (!buf || buf.length < 4) return false;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return true;
    if (buf.toString('ascii', 0, 4) === 'RIFF') return true;
    return false;
}

const corruptOnDisk = (p) => {
    try {
        const fd = fs.openSync(p, 'r');
        const head = Buffer.alloc(16);
        fs.readSync(fd, head, 0, 16, 0);
        fs.closeSync(fd);
        return !isUsableImage(head);
    } catch {
        return false;
    }
};

/* Build filename -> candidate URLs from the archive's scraped image lists. */
const urlsByBasename = new Map();
if (fs.existsSync(ARCHIVE_DIR)) {
    for (const dir of fs.readdirSync(ARCHIVE_DIR)) {
        const rec = path.join(ARCHIVE_DIR, dir, 'record.json');
        if (!fs.existsSync(rec)) continue;
        try {
            const sr = JSON.parse(fs.readFileSync(rec, 'utf8')).supplierRecord;
            for (const img of sr?.images || []) {
                const base = decodeURIComponent(img.url.split('/').pop() || '');
                if (!base) continue;
                if (!urlsByBasename.has(base)) urlsByBasename.set(base, new Set());
                urlsByBasename.get(base).add(img.url);
            }
        } catch {
            /* skip unreadable record */
        }
    }
}

/* Collect the corrupt files. */
const targets = [];
for (const folder of fs.readdirSync(ASSETS_DIR)) {
    const dir = path.join(ASSETS_DIR, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
        if (file === 'details.json') continue;
        const full = path.join(dir, file);
        if (!corruptOnDisk(full)) continue;
        const candidates = [...(urlsByBasename.get(file) || [])];
        // The archive stores several CDN cache variants of the same asset;
        // try the plain-jpg ones first, they are the least likely to 404.
        candidates.sort((a, b) => (a.endsWith('.jpg') ? -1 : 1) - (b.endsWith('.jpg') ? -1 : 1));
        targets.push({ folder, file, full, candidates });
    }
}

console.log(`corrupt files found : ${targets.length}`);
console.log(`with a known URL    : ${targets.filter((t) => t.candidates.length).length}`);
console.log(`no URL in archive   : ${targets.filter((t) => !t.candidates.length).length}\n`);

const results = { recovered: [], stillCorrupt: [], noUrl: [], failed: [] };

for (const [i, t] of targets.entries()) {
    if (!t.candidates.length) {
        results.noUrl.push(`${t.folder}/${t.file}`);
        continue;
    }

    let saved = false;
    let lastNote = '';
    for (const url of t.candidates) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !saved; attempt++) {
            try {
                const res = await fetch(url, {
                    headers: {
                        // The origin serves error pages to unadorned clients.
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
                        Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*',
                        Referer: 'https://frameworthy.com/',
                    },
                });
                if (!res.ok) {
                    lastNote = `HTTP ${res.status}`;
                    // 5xx is the rate limit that caused this; back off.
                    if (res.status >= 500) await sleep(DELAY_MS * attempt * 3);
                    continue;
                }
                const buf = Buffer.from(await res.arrayBuffer());
                if (!isUsableImage(buf)) {
                    lastNote = 'response was not an image';
                    await sleep(DELAY_MS * attempt * 3);
                    continue;
                }
                fs.writeFileSync(t.full, buf);
                results.recovered.push({ file: `${t.folder}/${t.file}`, bytes: buf.length, url });
                saved = true;
            } catch (err) {
                lastNote = err.message;
                await sleep(DELAY_MS * attempt);
            }
        }
        if (saved) break;
    }

    if (!saved) results.stillCorrupt.push({ file: `${t.folder}/${t.file}`, note: lastNote });

    if ((i + 1) % 10 === 0) console.log(`  ...${i + 1}/${targets.length}  recovered ${results.recovered.length}`);
    await sleep(DELAY_MS);
}

fs.writeFileSync(REPORT, JSON.stringify({ ranAt: new Date().toISOString(), ...results }, null, 2), 'utf8');

console.log(`\nrecovered     : ${results.recovered.length}`);
console.log(`still corrupt : ${results.stillCorrupt.length}`);
console.log(`no known URL  : ${results.noUrl.length}`);
console.log(`report        : ${REPORT}`);
for (const s of results.stillCorrupt.slice(0, 8)) console.log(`  - ${s.file}: ${s.note}`);
