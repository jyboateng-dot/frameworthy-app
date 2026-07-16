const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_DIR = path.join(__dirname, '..', 'public', 'unsplash_collection');
const MANIFEST_PATH = path.join(__dirname, '..', 'src', 'data', 'unsplashLocal.js');
const MAX_DIMENSION = 3200; // High-res suitable for print, keeps size manageable

// Ensure directory exists
if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
}

const fetchJSON = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode !== 200) {
                // Handle redirects
                if (res.statusCode === 302 || res.statusCode === 301) {
                    downloadFile(res.headers.location, dest).then(resolve).catch(reject);
                    return;
                }
                reject(new Error(`Failed to get '${url}' (Status Code: ${res.statusCode})`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {}); // delete incomplete file
            reject(err);
        });
    });
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    try {
        console.log('Fetching image list from Picsum API...');
        const p1 = await fetchJSON('https://picsum.photos/v2/list?page=1&limit=100');
        const p2 = await fetchJSON('https://picsum.photos/v2/list?page=2&limit=100');
        const p3 = await fetchJSON('https://picsum.photos/v2/list?page=3&limit=100');
        
        const allItems = [...p1, ...p2, ...p3];
        console.log(`Found ${allItems.length} images. Downloading 300...`);

        const manifest = [];
        let count = 0;

        for (const item of allItems) {
            if (count >= 300) break;

            const { id, author, width, height } = item;
            
            // Calculate constrained aspect-ratio dimensions
            let w = width;
            let h = height;
            if (width > height) {
                w = MAX_DIMENSION;
                h = Math.round(MAX_DIMENSION * height / width);
            } else {
                h = MAX_DIMENSION;
                w = Math.round(MAX_DIMENSION * width / height);
            }

            const downloadUrl = `https://picsum.photos/id/${id}/${w}/${h}`;
            const filename = `unsplash_${id}.jpg`;
            const destPath = path.join(BASE_DIR, filename);

            console.log(`[${count + 1}/300] Downloading ${filename} (${w}x${h}) by ${author}...`);
            
            try {
                // If file already exists, skip download but keep in manifest
                if (fs.existsSync(destPath)) {
                    console.log(`  - File exists, skipping download.`);
                } else {
                    await downloadFile(downloadUrl, destPath);
                    await wait(200); // Friendly pause between downloads
                }

                manifest.push({
                    id: `local_unsplash_${id}`,
                    filename: filename,
                    title: `Unsplash Collection #${count + 1}`,
                    artist: author
                });
                count++;
            } catch (err) {
                console.error(`  - Failed to download image ${id}: ${err.message}`);
            }
        }

        // Write the manifest javascript file
        const manifestContent = `// Auto-generated manifest by download_unsplash.js\n` +
            `export const UNSPLASH_IMAGES = ${JSON.stringify(manifest, null, 4)};\n`;
        
        fs.writeFileSync(MANIFEST_PATH, manifestContent);
        console.log(`\nSuccess! Downloaded ${count} images.`);
        console.log(`Generated manifest at: ${MANIFEST_PATH}`);

    } catch (e) {
        console.error('An error occurred in main execution:', e);
    }
}

main();
