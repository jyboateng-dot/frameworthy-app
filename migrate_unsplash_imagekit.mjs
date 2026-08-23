// Uploads the 270 Unsplash "inspiration" images (recovered from
// frameworthy_codebase.zip, since their local source folder was deleted
// after the original Cloudinary migration) to ImageKit. WebImagesPage.jsx
// constructs each item's URL inline from a hardcoded Cloudinary base +
// filename rather than storing a full `image` field anywhere, so there's
// no data file to rewrite here — just the upload, folder kept as
// `unsplash_collection` to match the flat `unsplash_<n>.jpg` naming
// WebImagesPage.jsx already expects. The base URL swap in
// WebImagesPage.jsx itself is a separate, manual edit.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const AUTH_HEADER = 'Basic ' + Buffer.from(PRIVATE_KEY + ':').toString('base64');
const DIR = path.join(__dirname, '.migration-staging', 'unsplash-collection');
const FOLDER = 'unsplash_collection';
const CONCURRENCY = 12;

async function uploadOne(filePath, fileName) {
    const buf = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('file', new Blob([buf]), fileName);
    form.append('fileName', fileName);
    form.append('folder', FOLDER);
    form.append('useUniqueFileName', 'false');
    const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        headers: { Authorization: AUTH_HEADER },
        body: form,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text().catch(() => '<unreadable>')}`);
}

async function main() {
    const files = fs.readdirSync(DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    console.log(`Uploading ${files.length} files to ${FOLDER}/`);
    const failures = [];
    let uploaded = 0, done = 0;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (file) => {
            try {
                await uploadOne(path.join(DIR, file), file);
                uploaded++;
            } catch (err) {
                failures.push({ file, error: err.message });
            }
            done++;
        }));
        process.stdout.write(`\r${done}/${files.length}   `);
    }
    console.log(`\nDone. uploaded=${uploaded} failed=${failures.length}`);
    console.log(`New base URL: ${URL_ENDPOINT}/${FOLDER}/`);
    if (failures.length) fs.writeFileSync(path.join(__dirname, 'migrate_unsplash_failures.json'), JSON.stringify(failures, null, 2));
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
