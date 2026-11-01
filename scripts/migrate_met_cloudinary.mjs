// One-off migration: upload public/met_collection images to Cloudinary and
// rewrite src/data/metLocal.js to point at the returned secure_url instead
// of local /met_collection/... paths. Run once, then delete
// public/met_collection locally since it's no longer needed for deploy.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLOUD_NAME = 'uucoqdzr';
const UPLOAD_PRESET = 'frameworthy_uploads';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const CONCURRENCY = 12;

const { MET_LOCAL_COLLECTIONS } = await import('./src/data/metLocal.js');

function localPathFor(imageUrl) {
    // "/met_collection/African%20Art.../Ancestor%20figure....jpg" -> filesystem path
    const decoded = decodeURIComponent(imageUrl.replace(/^\//, ''));
    return path.join(__dirname, 'public', decoded);
}

async function uploadOne(item, category) {
    const filePath = localPathFor(item.image);
    const buf = fs.readFileSync(filePath);
    const blob = new Blob([buf]);

    const form = new FormData();
    form.append('file', blob, path.basename(filePath));
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', `met_collection/${category}`);
    form.append('public_id', item.id);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    if (!res.ok) {
        const text = await res.text().catch(() => '<unreadable>');
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    const json = await res.json();
    return json.secure_url;
}

async function runBatch(items, category, results, failures) {
    for (const item of items) {
        try {
            const url = await uploadOne(item, category);
            results.push({ ...item, image: url });
        } catch (err) {
            failures.push({ category, id: item.id, error: err.message });
            results.push(item); // keep local path as fallback so nothing is lost
        }
    }
}

async function main() {
    const categories = Object.keys(MET_LOCAL_COLLECTIONS);
    const output = {};
    const allFailures = [];
    let totalDone = 0;
    const totalCount = categories.reduce((sum, c) => sum + MET_LOCAL_COLLECTIONS[c].length, 0);

    for (const category of categories) {
        const items = MET_LOCAL_COLLECTIONS[category];
        const results = [];
        const failures = [];

        // Split into CONCURRENCY-sized chunks, run each chunk's items in parallel
        const chunks = [];
        for (let i = 0; i < items.length; i += CONCURRENCY) {
            chunks.push(items.slice(i, i + CONCURRENCY));
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (item) => {
                try {
                    const url = await uploadOne(item, category);
                    results.push({ ...item, image: url });
                } catch (err) {
                    failures.push({ category, id: item.id, error: err.message });
                    results.push(item);
                }
                totalDone++;
            }));
            process.stdout.write(`\r${category}: ${results.length}/${items.length}  (overall ${totalDone}/${totalCount})   `);
        }

        output[category] = results;
        allFailures.push(...failures);
        console.log(`\n${category}: done, ${failures.length} failures`);
    }

    fs.writeFileSync(
        path.join(__dirname, 'src', 'data', 'metLocal.js'),
        `// Auto-generated Met Art Local Manifest (Cloudinary-hosted images)\nexport const MET_LOCAL_COLLECTIONS = ${JSON.stringify(output, null, 2)};\n`
    );

    console.log(`\nDone. ${totalCount - allFailures.length}/${totalCount} uploaded successfully.`);
    if (allFailures.length) {
        console.log(`${allFailures.length} failures:`);
        console.log(JSON.stringify(allFailures, null, 2));
        fs.writeFileSync(path.join(__dirname, 'met_migration_failures.json'), JSON.stringify(allFailures, null, 2));
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
