import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.join(__dirname, 'src/data/metLocal.js');
const origPath = path.join(
    'C:\\Users\\HPELIT~1\\AppData\\Local\\Temp\\claude\\C--Users-HP-ELITEBOOK-Desktop-FrameWorthy-App\\a1c02e36-0696-4098-acf6-041c946943ff\\scratchpad',
    'metLocal.orig.js'
);

async function main() {
    const { MET_LOCAL_COLLECTIONS: current } = await import(pathToFileURL(dataFilePath).href + `?t=${Date.now()}`);
    const { MET_LOCAL_COLLECTIONS: orig } = await import(pathToFileURL(origPath).href + `?t=${Date.now()}`);

    const origById = new Map();
    for (const list of Object.values(orig)) for (const item of list) origById.set(item.id, item.image);

    let content = fs.readFileSync(dataFilePath, 'utf-8');
    let reverted = 0;
    for (const list of Object.values(current)) {
        for (const item of list) {
            if (typeof item.image === 'string' && item.image.includes('ik.imagekit.io')) {
                const origUrl = origById.get(item.id);
                if (origUrl && content.includes(item.image)) {
                    content = content.split(item.image).join(origUrl);
                    reverted++;
                }
            }
        }
    }
    fs.writeFileSync(dataFilePath, content);
    console.log(`Reverted ${reverted} Met items back to their original Cloudinary URL.`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
