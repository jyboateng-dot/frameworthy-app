// Part B (catalogue -> ImageKit migration), upload step.
//
// Uploads everything the migration_fetch_*.mjs scripts staged (plus
// met_collection/, which was already local and needed no fetch) to
// ImageKit, then rewrites the seven data files to point at the new URLs.
//
// Auth is server-side Basic (private key), NOT the token/expire/signature
// dance the app's own client upload flow uses (src/services/providers/
// imagekitUpload.js) — that dance exists only because a browser can't be
// trusted with the private key. This script runs on the developer's own
// machine, so it can use the private key directly.
//
// Reads IMAGEKIT_PRIVATE_KEY and VITE_IMAGEKIT_URL_ENDPOINT from the
// environment, falling back to parsing them out of .env.local if not
// already exported — IMAGEKIT_PRIVATE_KEY is deliberately NOT VITE_-
// prefixed (see storage.js's provider dispatcher) so it never ends up in
// the client bundle; add it to .env.local as its own line, or export it in
// your shell, either works.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadLocalEnv(name) {
    if (process.env[name]) return process.env[name];
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) return undefined;
    const line = fs.readFileSync(envPath, 'utf-8').split('\n').find(l => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : undefined;
}

const PRIVATE_KEY = loadLocalEnv('IMAGEKIT_PRIVATE_KEY');
const URL_ENDPOINT = (loadLocalEnv('VITE_IMAGEKIT_URL_ENDPOINT') || '').replace(/\/$/, '');

if (!PRIVATE_KEY || !URL_ENDPOINT) {
    console.error('Missing IMAGEKIT_PRIVATE_KEY and/or VITE_IMAGEKIT_URL_ENDPOINT.');
    console.error('Export them, or add lines for them to .env.local, then re-run.');
    process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(PRIVATE_KEY + ':').toString('base64');
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const CONCURRENCY = 12;
const STAGING = path.join(__dirname, '.migration-staging');
const MET_DIR = path.join(__dirname, 'met_collection');

async function uploadOne(filePath, folder, fileName) {
    const buf = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('file', new Blob([buf]), fileName);
    form.append('fileName', fileName);
    form.append('folder', folder);
    form.append('useUniqueFileName', 'false');

    const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: AUTH_HEADER },
        body: form,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '<unreadable>');
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    return res.json();
}

async function uploadDir(dir, folder, { flatten = true } = {}) {
    if (!fs.existsSync(dir)) {
        console.warn(`WARNING: ${dir} does not exist, skipping.`);
        return { uploaded: 0, failures: [], attempted: [] };
    }
    // Snapshot the file list ONCE and treat it as the sole source of truth
    // for the rest of this call — a fetch script can be adding new files to
    // this same directory concurrently (this bit a real run: the ~9-hour
    // albums fetch was still going in the background while this uploaded),
    // and a caller that re-reads the directory afterward to figure out
    // "what got staged" would pick up files that were never actually
    // attempted here, misreporting them as uploaded.
    const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    console.log(`\n=== ${dir} (${files.length} files) -> ${folder} ===`);

    const failures = [];
    const succeeded = [];
    let done = 0;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (file) => {
            try {
                await uploadOne(path.join(dir, file), folder, file);
                succeeded.push(file);
            } catch (err) {
                failures.push({ file, error: err.message });
            }
            done++;
        }));
        process.stdout.write(`\r${folder}: ${done}/${files.length}   `);
    }
    console.log(`\n${folder}: uploaded=${succeeded.length} failed=${failures.length}`);
    return { uploaded: succeeded.length, failures, attempted: files, succeeded };
}

// ── BASE-constant categories: canvas art, glossy art, original paintings,
//    prestige paintings, framed prints. Uploading preserves the current
//    Cloudinary folder name as the ImageKit folder, so the data-file
//    rewrite is a single-line BASE swap — no per-item edits needed. ──
const BASE_TARGETS = [
    { stagingDir: 'canvas-art', folder: 'inspiration_canvas_art', dataFile: 'src/data/canvas_art.js' },
    { stagingDir: 'glossy-art', folder: 'inspiration_glossy_art', dataFile: 'src/data/glossy_art.js' },
    { stagingDir: 'original-paintings', folder: 'inspiration_original_paintings', dataFile: 'src/data/original_paintings.js' },
    { stagingDir: 'original-paintings-prestige', folder: 'inspiration_prestige_paintings', dataFile: 'src/data/prestige_paintings.js' },
    { stagingDir: 'framed-prints', folder: 'framed_prints', dataFile: 'src/data/framed_prints.js' },
];

async function migrateBaseTargets() {
    const allFailures = {};
    for (const { stagingDir, folder, dataFile } of BASE_TARGETS) {
        const { failures } = await uploadDir(path.join(STAGING, stagingDir), folder);
        if (failures.length) allFailures[stagingDir] = failures;

        const dataFilePath = path.join(__dirname, dataFile);
        let content = fs.readFileSync(dataFilePath, 'utf-8');
        const newBase = `${URL_ENDPOINT}/${folder}/`;
        const rewritten = content.replace(/export const BASE = '[^']*';/, `export const BASE = '${newBase}';`);
        if (rewritten === content) {
            console.warn(`WARNING: BASE constant not found/replaced in ${dataFile}`);
        } else {
            fs.writeFileSync(dataFilePath, rewritten);
            console.log(`Updated BASE in ${dataFile} -> ${newBase}`);
        }
    }
    return allFailures;
}

// ImageKit's folder parameter rejects spaces outright (confirmed via a
// live test: "Ancient West Asian Art" -> 400 "invalid value for folder
// parameter", "Ancient_West_Asian_Art" -> 200) — department names need
// slugifying before use as a folder segment. Kept narrow (only space is
// known to be rejected) rather than stripping broadly, so department names
// stay readable in the ImageKit media library.
const slugifyFolder = (name) => name.replace(/\s+/g, '_');

// ── Met collection: already local (met_collection/<department>/...), no
//    staging needed. IMPORTANT: local filenames do NOT match the ids
//    metLocal.js's URLs already use — the original Cloudinary migration
//    renamed files (real Met object numbers -> `met_<id>`, everything else
//    -> a generated `met_local_<hash>`), so uploading a local file under
//    its own name and doing a blind prefix swap would produce URLs
//    pointing at files that don't exist. Instead, each metLocal.js item is
//    matched back to its local source file — by the object id embedded in
//    `MET_<id>_...jpg` filenames when present, falling back to an exact
//    title match (confirmed: a `met_local_*` item's title equals its local
//    filename, e.g. "Cylinder sea and modern impression three figures.jpg")
//    — and uploaded under the FILENAME METLOCAL.JS ALREADY EXPECTS
//    (`<item.id>.jpg`), so the existing prefix-swap rewrite stays valid. ──
async function migrateMet() {
    const failures = [];
    if (!fs.existsSync(MET_DIR)) {
        console.warn('WARNING: met_collection/ not found, skipping Met.');
        return failures;
    }
    const departments = fs.readdirSync(MET_DIR).filter(d => fs.statSync(path.join(MET_DIR, d)).isDirectory());

    const dataFilePath = path.join(__dirname, 'src/data/metLocal.js');
    const fileUrl = pathToFileURL(dataFilePath).href;
    const { MET_LOCAL_COLLECTIONS } = await import(`${fileUrl}?t=${Date.now()}`);
    let content = fs.readFileSync(dataFilePath, 'utf-8');

    for (const dept of departments) {
        const deptDir = path.join(MET_DIR, dept);
        const localFiles = fs.readdirSync(deptDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));

        const byObjectId = new Map();
        // Local titled files are named "<Title> - <Artist>.jpg" while
        // metLocal.js only stores "<Title>" — exact equality only caught
        // ~87% (confirmed live: item/file counts matched exactly per
        // department, so near-total prefix-match coverage means the
        // remainder were genuinely all name-formatting misses, not absent
        // files). A prefix match against " - " recovers the rest.
        const titleEntries = localFiles.map(f => ({ f, base: f.replace(/\.[^.]+$/, '').trim().toLowerCase() }));
        for (const f of localFiles) {
            const base = f.replace(/\.[^.]+$/, '');
            const idMatch = base.match(/^MET_(\d+)_/i);
            if (idMatch) byObjectId.set(idMatch[1], f);
        }

        const items = MET_LOCAL_COLLECTIONS[dept] || [];
        const slug = slugifyFolder(dept);
        const folder = `met_collection/${slug}`;

        const matched = [];
        let missing = 0;
        for (const item of items) {
            // Skip anything already resolved via the Met Museum's own API
            // (images.metmuseum.org) — those don't need an ImageKit copy at
            // all, and re-uploading would only regress a working direct
            // link back into consuming storage for no benefit. Only items
            // still stuck on the dead Cloudinary URL need this pass.
            if (typeof item.image === 'string' && item.image.includes('images.metmuseum.org')) continue;
            const objectIdMatch = item.id.match(/^met_(\d+)$/);
            let localFile = objectIdMatch && byObjectId.get(objectIdMatch[1]);
            if (!localFile) {
                const t = (item.title || '').trim().toLowerCase();
                const hit = titleEntries.find(e => e.base === t || e.base.startsWith(t + ' - ') || e.base.startsWith(t + ' -'));
                localFile = hit && hit.f;
            }
            if (localFile) matched.push({ item, localFile });
            else missing++;
        }

        const deptFailures = [];
        let uploaded = 0, done = 0;
        for (let i = 0; i < matched.length; i += CONCURRENCY) {
            const batch = matched.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(async ({ item, localFile }) => {
                try {
                    await uploadOne(path.join(deptDir, localFile), folder, `${item.id}.jpg`);
                    uploaded++;
                    // Rewritten per-item, immediately on confirmed success —
                    // NOT a blanket per-department prefix swap. A department
                    // prefix regex would rewrite every item in the
                    // department uniformly regardless of whether that
                    // specific item's upload actually succeeded, which is
                    // exactly the bug that shipped: once ImageKit's storage
                    // cap started rejecting uploads mid-run, every
                    // still-"rewritten" item in the failing departments
                    // pointed at a file that was never uploaded.
                    if (content.includes(item.image)) {
                        content = content.split(item.image).join(`${URL_ENDPOINT}/${folder}/${item.id}.jpg`);
                    }
                } catch (err) {
                    deptFailures.push({ file: localFile, id: item.id, error: err.message });
                }
                done++;
            }));
            process.stdout.write(`\r${folder}: ${done}/${matched.length}   `);
        }
        console.log(`\n${folder}: uploaded=${uploaded} failed=${deptFailures.length} unmatched=${missing} (of ${items.length} catalogue items)`);
        failures.push(...deptFailures.map(f => ({ ...f, department: dept })));
    }

    fs.writeFileSync(dataFilePath, content);
    console.log(`Rewrote metLocal.js image URLs -> ${URL_ENDPOINT}/met_collection/<department>/...`);
    return failures;
}

// ── Movies / Albums: manifest-style data files, one item per URL. Each
//    item's exact current `image` string is unique (Cloudinary version
//    numbers differ per asset), so a straight text find/replace per item
//    is safe — same approach the original migrate_manifests_cloudinary.mjs
//    used, just retargeted. Items whose staged file is missing (a fetch
//    failure) are left untouched and reported, rather than pointed at a
//    URL that doesn't exist. ──
function collectManifestItems(node, out) {
    if (Array.isArray(node)) {
        for (const item of node) if (item && item.id) out.push(item);
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) collectManifestItems(value, out);
    }
}

async function migrateManifest({ stagingDir, folder, dataFile, exportName }) {
    // `succeeded` is uploadDir's own record of exactly which files it
    // confirmed uploaded in THIS call — not a fresh directory read, which
    // could pick up files a concurrently-running fetch script added after
    // upload already finished (see uploadDir's comment).
    const { failures, succeeded } = await uploadDir(path.join(STAGING, stagingDir), folder);
    const uploadedIds = new Set(succeeded.map(f => f.replace(/\.[^.]+$/, '')));

    const dataFilePath = path.join(__dirname, dataFile);
    const fileUrl = pathToFileURL(dataFilePath).href;
    const module = await import(`${fileUrl}?t=${Date.now()}`); // cache-bust in case of prior in-process import
    const items = [];
    collectManifestItems(module[exportName], items);

    let content = fs.readFileSync(dataFilePath, 'utf-8');
    let rewritten = 0, missing = 0;
    for (const item of items) {
        if (!uploadedIds.has(String(item.id))) {
            missing++;
            continue;
        }
        const oldUrl = item.image;
        const newUrl = `${URL_ENDPOINT}/${folder}/${item.id}.jpg`;
        if (typeof oldUrl === 'string' && content.includes(oldUrl)) {
            content = content.split(oldUrl).join(newUrl);
            rewritten++;
        }
    }
    fs.writeFileSync(dataFilePath, content);
    console.log(`${dataFile}: rewrote ${rewritten} item URLs, ${missing} left unchanged (no successful staged upload)`);
    return failures;
}

async function main() {
    console.log(`Uploading to ImageKit endpoint: ${URL_ENDPOINT}`);
    const report = {};

    // Movies and Albums are no longer migrated to ImageKit at all — they
    // now pull directly from OMDb/iTunes' own CDNs (see
    // rewrite_movies_from_omdb.mjs / rewrite_albums_from_itunes.mjs).
    // Calling migrateManifest for either here would be actively harmful:
    // Albums' rewrite script runs for hours and is mid-flight against the
    // same albumsLocal.js file this would also write to — a second writer
    // would race it exactly like the bug this file's uploadDir comment
    // documents. Met is the only category that still needs ImageKit, as a
    // fallback for the items with no Met-API-resolvable object number
    // (see rewrite_met_from_api.mjs) — and now, after the Met API's
    // Incapsula block, as a fallback for everything that hit that block
    // too (migrateMet skips anything already pointing at
    // images.metmuseum.org, so this only touches what's still broken).
    report.baseTargets = await migrateBaseTargets();
    report.met = await migrateMet();

    fs.writeFileSync(path.join(__dirname, 'migrate_catalogue_imagekit_report.json'), JSON.stringify(report, null, 2));
    console.log('\nDone. Full report written to migrate_catalogue_imagekit_report.json');
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
