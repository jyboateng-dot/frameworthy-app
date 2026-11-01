// Migrates the "BASE constant" style catalogs to Cloudinary: these data
// files (framed_prints.js, original_paintings.js, canvas_art.js,
// glossy_art.js, prestige_paintings.js) derive every image URL from a single
// exported `BASE` string + a filename, so migrating them only requires
// uploading the folder's files with matching public_ids and rewriting the
// one BASE line — no per-item manifest rewriting needed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLOUD_NAME = 'uucoqdzr';
const UPLOAD_PRESET = 'frameworthy_uploads';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const CONCURRENCY = 12;

const TARGETS = [
    { publicDir: 'framed-prints', cloudinaryFolder: 'framed_prints', dataFile: 'src/data/framed_prints.js' },
    { publicDir: 'inspiration/original-paintings', cloudinaryFolder: 'inspiration_original_paintings', dataFile: 'src/data/original_paintings.js' },
    { publicDir: 'inspiration/original-paintings-prestige', cloudinaryFolder: 'inspiration_prestige_paintings', dataFile: 'src/data/prestige_paintings.js' },
    { publicDir: 'inspiration/canvas-art', cloudinaryFolder: 'inspiration_canvas_art', dataFile: 'src/data/canvas_art.js' },
    { publicDir: 'inspiration/glossy-art', cloudinaryFolder: 'inspiration_glossy_art', dataFile: 'src/data/glossy_art.js' },
];

async function uploadOne(filePath, cloudinaryFolder, publicId) {
    const buf = fs.readFileSync(filePath);
    const blob = new Blob([buf]);
    const form = new FormData();
    form.append('file', blob, path.basename(filePath));
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', cloudinaryFolder);
    form.append('public_id', publicId);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    if (!res.ok) {
        const text = await res.text().catch(() => '<unreadable>');
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    return res.json();
}

async function migrateFolder({ publicDir, cloudinaryFolder, dataFile }) {
    const dir = path.join(__dirname, 'public', publicDir);
    const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    console.log(`\n=== ${publicDir} (${files.length} files) -> ${cloudinaryFolder} ===`);

    const failures = [];
    let done = 0;
    const chunks = [];
    for (let i = 0; i < files.length; i += CONCURRENCY) chunks.push(files.slice(i, i + CONCURRENCY));

    for (const chunk of chunks) {
        await Promise.all(chunk.map(async (file) => {
            const publicId = file.replace(/\.[^.]+$/, '');
            const filePath = path.join(dir, file);
            try {
                await uploadOne(filePath, cloudinaryFolder, publicId);
            } catch (err) {
                failures.push({ file, error: err.message });
            }
            done++;
        }));
        process.stdout.write(`\r${publicDir}: ${done}/${files.length}   `);
    }
    console.log(`\n${publicDir}: done, ${failures.length} failures`);

    // Rewrite the BASE constant to point at Cloudinary instead of the local path
    const dataFilePath = path.join(__dirname, dataFile);
    let content = fs.readFileSync(dataFilePath, 'utf-8');
    const newBase = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${cloudinaryFolder}/`;
    const rewritten = content.replace(/export const BASE = '[^']*';/, `export const BASE = '${newBase}';`);
    if (rewritten === content) {
        console.warn(`WARNING: BASE constant not found/replaced in ${dataFile}`);
    } else {
        fs.writeFileSync(dataFilePath, rewritten);
        console.log(`Updated BASE in ${dataFile} -> ${newBase}`);
    }

    return failures;
}

async function main() {
    const allFailures = {};
    for (const target of TARGETS) {
        const failures = await migrateFolder(target);
        if (failures.length) allFailures[target.publicDir] = failures;
    }
    if (Object.keys(allFailures).length) {
        fs.writeFileSync(path.join(__dirname, 'base_folders_migration_failures.json'), JSON.stringify(allFailures, null, 2));
        console.log('\nSome failures occurred, see base_folders_migration_failures.json');
    } else {
        console.log('\nAll uploads succeeded.');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
