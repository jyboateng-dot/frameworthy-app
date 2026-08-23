// One-off corrective script. Two bugs in migrate_catalogue_imagekit.mjs
// left dangling (never-actually-uploaded) ik.imagekit.io URLs in place:
//
// 1. migrateMet() swapped each department's URL prefix as one blanket
//    regex, unconditionally — so departments where uploads failed (the
//    ImageKit "Upload Limit Exceeded" 403s) got rewritten anyway, pointing
//    at files that don't exist.
// 2. migrateManifest() (movies/albums) re-read the staging directory
//    AFTER uploadDir() finished to build the "successfully staged" id set
//    — but migration_fetch_albums.mjs was still running concurrently in
//    the background the whole time, adding new files to that same
//    directory between the two reads. Any id that landed in that gap
//    looked "staged" without ever having been attempted by uploadDir.
//
// This reverts every incorrectly-rewritten item back to its original
// (git HEAD) Cloudinary URL, using the migration run's own failure report
// plus a fresh re-run of the exact same id/title matching logic to
// determine, per Met item, whether it was genuinely among the confirmed
// successful uploads.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MET_DIR = path.join(__dirname, 'met_collection');
const ORIG_DIR = 'C:\\Users\\HPELIT~1\\AppData\\Local\\Temp\\claude\\C--Users-HP-ELITEBOOK-Desktop-FrameWorthy-App\\a1c02e36-0696-4098-acf6-041c946943ff\\scratchpad';

const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'migrate_catalogue_imagekit_report.json'), 'utf-8'));
const failedMetIds = new Set(report.met.map(f => f.id));

async function loadModule(filePath, exportName) {
    const url = pathToFileURL(filePath).href + `?t=${Date.now()}`;
    const mod = await import(url);
    return mod[exportName];
}

function collectItems(node, out) {
    if (Array.isArray(node)) {
        for (const item of node) if (item && item.id) out.push(item);
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) collectItems(value, out);
    }
}

async function fixMet() {
    const currentPath = path.join(__dirname, 'src/data/metLocal.js');
    const origPath = path.join(ORIG_DIR, 'metLocal.orig.js');

    const currentCollections = await loadModule(currentPath, 'MET_LOCAL_COLLECTIONS');
    const origCollections = await loadModule(origPath, 'MET_LOCAL_COLLECTIONS');

    const currentItems = [];
    collectItems(currentCollections, currentItems);
    const origById = new Map();
    const origItems = [];
    collectItems(origCollections, origItems);
    for (const item of origItems) origById.set(item.id, item.image);

    const departments = fs.readdirSync(MET_DIR).filter(d => fs.statSync(path.join(MET_DIR, d)).isDirectory());

    // Recompute the exact same matching this department would have done,
    // to know which ids were genuinely eligible (matched) — an id that
    // was matched AND not in the failures report was a real success.
    let content = fs.readFileSync(currentPath, 'utf-8');
    let reverted = 0, keptGood = 0;

    for (const dept of departments) {
        const deptDir = path.join(MET_DIR, dept);
        const localFiles = fs.readdirSync(deptDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
        const byObjectId = new Map();
        const titleEntries = localFiles.map(f => ({ f, base: f.replace(/\.[^.]+$/, '').trim().toLowerCase() }));
        for (const f of localFiles) {
            const base = f.replace(/\.[^.]+$/, '');
            const idMatch = base.match(/^MET_(\d+)_/i);
            if (idMatch) byObjectId.set(idMatch[1], f);
        }

        const items = (currentCollections[dept] || []);
        for (const item of items) {
            const objectIdMatch = item.id.match(/^met_(\d+)$/);
            let localFile = objectIdMatch && byObjectId.get(objectIdMatch[1]);
            if (!localFile) {
                const t = (item.title || '').trim().toLowerCase();
                const hit = titleEntries.find(e => e.base === t || e.base.startsWith(t + ' - ') || e.base.startsWith(t + ' -'));
                localFile = hit && hit.f;
            }
            const wasMatched = Boolean(localFile);
            const wasSuccess = wasMatched && !failedMetIds.has(item.id);

            if (!wasSuccess) {
                const origUrl = origById.get(item.id);
                if (origUrl && item.image !== origUrl && content.includes(item.image)) {
                    content = content.split(item.image).join(origUrl);
                    reverted++;
                }
            } else {
                keptGood++;
            }
        }
    }

    fs.writeFileSync(currentPath, content);
    console.log(`metLocal.js: reverted ${reverted} dangling URLs, kept ${keptGood} confirmed-good ones`);
}

async function fixManifest({ dataFile, exportName }) {
    const currentPath = path.join(__dirname, dataFile);
    const origPath = path.join(ORIG_DIR, path.basename(dataFile).replace('.js', '.orig.js'));

    const currentCollections = await loadModule(currentPath, exportName);
    const origCollections = await loadModule(origPath, exportName);

    const currentItems = [];
    collectItems(currentCollections, currentItems);
    const origById = new Map();
    const origItems = [];
    collectItems(origCollections, origItems);
    for (const item of origItems) origById.set(item.id, item.image);

    let content = fs.readFileSync(currentPath, 'utf-8');
    let reverted = 0;
    for (const item of currentItems) {
        if (typeof item.image === 'string' && item.image.includes('ik.imagekit.io')) {
            const origUrl = origById.get(item.id);
            if (origUrl && content.includes(item.image)) {
                content = content.split(item.image).join(origUrl);
                reverted++;
            }
        }
    }
    fs.writeFileSync(currentPath, content);
    console.log(`${dataFile}: reverted ${reverted} dangling URLs (none were legitimately uploaded this run)`);
}

async function main() {
    await fixMet();
    await fixManifest({ dataFile: 'src/data/albumsLocal.js', exportName: 'ALBUMS_LOCAL_COLLECTIONS' });
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
