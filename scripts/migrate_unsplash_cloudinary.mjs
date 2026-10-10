import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLOUD_NAME = 'uucoqdzr';
const UPLOAD_PRESET = 'frameworthy_uploads';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const CONCURRENCY = 12;
const CLOUDINARY_FOLDER = 'unsplash_collection';

async function uploadOne(filePath, publicId) {
    const buf = fs.readFileSync(filePath);
    const blob = new Blob([buf]);
    const form = new FormData();
    form.append('file', blob, path.basename(filePath));
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', CLOUDINARY_FOLDER);
    form.append('public_id', publicId);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    if (!res.ok) {
        const text = await res.text().catch(() => '<unreadable>');
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    return res.json();
}

async function main() {
    const dir = path.join(__dirname, 'public', 'unsplash_collection');
    const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    console.log(`unsplash_collection: ${files.length} files`);

    const failures = [];
    let done = 0;
    const chunks = [];
    for (let i = 0; i < files.length; i += CONCURRENCY) chunks.push(files.slice(i, i + CONCURRENCY));

    for (const chunk of chunks) {
        await Promise.all(chunk.map(async (file) => {
            const publicId = file.replace(/\.[^.]+$/, '');
            try {
                await uploadOne(path.join(dir, file), publicId);
            } catch (err) {
                failures.push({ file, error: err.message });
            }
            done++;
        }));
        process.stdout.write(`\r${done}/${files.length}   `);
    }
    console.log(`\ndone, ${failures.length} failures`);
    if (failures.length) {
        fs.writeFileSync(path.join(__dirname, 'unsplash_migration_failures.json'), JSON.stringify(failures, null, 2));
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
