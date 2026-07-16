const fs = require('fs');
const https = require('https');
const path = require('path');

const dataFile = 'C:/Users/HP ELITEBOOK/Desktop/FrameWorthy_App/src/data/unsplashLocal.js';
const targetDir = 'C:/Users/HP ELITEBOOK/Desktop/FrameWorthy_App/public/unsplash_collection';

const content = fs.readFileSync(dataFile, 'utf-8');
const match = content.match(/export const UNSPLASH_IMAGES = (\[[\s\S]*?\]);/);
if (!match) {
    console.error("Could not find array");
    process.exit(1);
}

const images = JSON.parse(match[1]);

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

let downloaded = 0;
let errors = 0;

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // follow redirect
                https.get(response.headers.location, (res2) => {
                    res2.pipe(file);
                    file.on('finish', () => {
                        file.close(resolve);
                    });
                }).on('error', err => {
                    fs.unlink(dest, () => reject(err));
                });
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }
        }).on('error', err => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

const run = async () => {
    console.log(`Checking ${images.length} images...`);
    for (let img of images) {
        const dest = path.join(targetDir, img.filename);
        if (!fs.existsSync(dest)) {
            const picId = img.filename.match(/\d+/)[0];
            const url = `https://picsum.photos/id/${picId}/800/1200`;
            try {
                await downloadFile(url, dest);
                downloaded++;
                if (downloaded % 10 === 0) console.log(`Downloaded ${downloaded} missing images...`);
            } catch (err) {
                console.error(`Error downloading ${img.filename}: ${err.message}`);
                errors++;
            }
        }
    }
    console.log(`Done! Downloaded: ${downloaded}, Errors: ${errors}`);
};

run();
