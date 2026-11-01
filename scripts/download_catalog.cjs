const fs = require('fs');
const https = require('https');
const path = require('path');

const catalogItemsPath = path.join(__dirname, 'catalog_items.json');
let catalogItems = [];
try {
    const rawData = fs.readFileSync(catalogItemsPath, 'utf8').replace(/^\uFEFF/, '');
    catalogItems = JSON.parse(rawData);
} catch (e) {
    console.error("Failed to parse catalog_items.json:", e);
    process.exit(1);
}

// Remove exact duplicate URLs from the list
const uniqueItems = new Map();
for (const item of catalogItems) {
    if (!uniqueItems.has(item.id)) {
        uniqueItems.set(item.id, item);
    }
}
const itemsToDownload = Array.from(uniqueItems.values());
console.log(`Found ${itemsToDownload.length} unique frames to download.`);

const downloadDir = path.join(__dirname, 'catalog_downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// We'll download concurrently but limit to 10 at a time
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                   .on('error', reject)
                   .once('close', () => resolve(filepath));
            } else {
                res.resume();
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
            }
        }).on('error', reject);
    });
}

async function run() {
    let successCount = 0;
    let failCount = 0;
    const batchSize = 10;
    
    for (let i = 0; i < itemsToDownload.length; i += batchSize) {
        const batch = itemsToDownload.slice(i, i + batchSize);
        const promises = batch.map(async (item) => {
            const filepath = path.join(downloadDir, item.filename);
            try {
                if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) {
                    successCount++;
                    return;
                }
                await downloadImage(item.url, filepath);
                successCount++;
            } catch (e) {
                console.error(`Failed to download ${item.filename}: ${e.message}`);
                failCount++;
            }
        });
        await Promise.all(promises);
        console.log(`Progress: ${Math.min(i + batchSize, itemsToDownload.length)} / ${itemsToDownload.length}`);
    }
    console.log(`\nDownload complete! Success: ${successCount}, Failed: ${failCount}`);
}

run().catch(console.error);
