// Migrates the "manifest" style catalogs (moviesLocal.js, albumsLocal.js) to
// Cloudinary. Unlike the BASE-constant catalogs, these store a full local
// `image` path per item, at arbitrary nesting depth, so each item is walked
// recursively and its `image` field is rewritten to the uploaded secure_url.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLOUD_NAME = 'uucoqdzr';
const UPLOAD_PRESET = 'frameworthy_uploads';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const CONCURRENCY = 12;

const TARGETS = [
    { manifestPath: './src/data/moviesLocal.js', exportName: 'MOVIES_LOCAL_COLLECTIONS', cloudinaryFolder: 'movies', outFile: 'src/data/moviesLocal.js' },
    { manifestPath: './src/data/albumsLocal.js', exportName: 'ALBUMS_LOCAL_COLLECTIONS', cloudinaryFolder: 'albums', outFile: 'src/data/albumsLocal.js' },
];

function localPathFor(imageUrl) {
    const decoded = decodeURIComponent(imageUrl.replace(/^\//, ''));
    return path.join(__dirname, 'public', decoded);
}

async function uploadOne(item, cloudinaryFolder) {
    const filePath = localPathFor(item.image);
    const buf = fs.readFileSync(filePath);
    const blob = new Blob([buf]);
    const form = new FormData();
    form.append('file', blob, path.basename(filePath));
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', cloudinaryFolder);
    form.append('public_id', item.id);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    if (!res.ok) {
        const text = await res.text().catch(() => '<unreadable>');
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    const json = await res.json();
    return json.secure_url;
}

// Recursively collects every array of {image, ...} items found anywhere in
// the manifest object, so this works for both 1-level (movies) and
// 2-level-nested (albums: genre -> artist -> items) shapes without
// hardcoding either structure.
function collectItemArrays(node, arrays = []) {
    if (Array.isArray(node)) {
        if (node.length && node[0] && typeof node[0] === 'object' && 'image' in node[0]) {
            arrays.push(node);
        }
        return arrays;
    }
    if (node && typeof node === 'object') {
        for (const key of Object.keys(node)) collectItemArrays(node[key], arrays);
    }
    return arrays;
}

async function migrateManifest({ manifestPath, exportName, cloudinaryFolder, outFile }) {
    const mod = await import(manifestPath);
    const data = mod[exportName];
    const itemArrays = collectItemArrays(data);
    const totalCount = itemArrays.reduce((sum, arr) => sum + arr.length, 0);
    console.log(`\n=== ${exportName} (${totalCount} items across ${itemArrays.length} arrays) -> ${cloudinaryFolder} ===`);

    const failures = [];
    let done = 0;

    for (const arr of itemArrays) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += CONCURRENCY) chunks.push(arr.slice(i, i + CONCURRENCY));

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (item) => {
                try {
                    item.image = await uploadOne(item, cloudinaryFolder);
                } catch (err) {
                    failures.push({ id: item.id, error: err.message });
                }
                done++;
            }));
            process.stdout.write(`\r${exportName}: ${done}/${totalCount}   `);
        }
    }
    console.log(`\n${exportName}: done, ${failures.length} failures`);

    fs.writeFileSync(
        path.join(__dirname, outFile),
        `// Auto-generated (Cloudinary-hosted images)\nexport const ${exportName} = ${JSON.stringify(data, null, 4)};\n`
    );

    return failures;
}

async function main() {
    const allFailures = {};
    for (const target of TARGETS) {
        const failures = await migrateManifest(target);
        if (failures.length) allFailures[target.exportName] = failures;
    }
    if (Object.keys(allFailures).length) {
        fs.writeFileSync(path.join(__dirname, 'manifests_migration_failures.json'), JSON.stringify(allFailures, null, 2));
        console.log('\nSome failures occurred, see manifests_migration_failures.json');
    } else {
        console.log('\nAll uploads succeeded.');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
