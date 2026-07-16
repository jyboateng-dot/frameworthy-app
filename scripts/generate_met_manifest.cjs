const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'met_collection');
const MANIFEST_PATH = path.join(__dirname, '..', 'src', 'data', 'metLocal.js');

// JPEG dimensions parser
function getJpegDimensions(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(4);
        let offset = 2; // Skip SOI (0xFFD8)
        
        while (offset < 100000) {
            fs.readSync(fd, buffer, 0, 4, offset);
            const marker = buffer.readUInt16BE(0);
            const size = buffer.readUInt16BE(2);
            
            if (marker >= 0xFFC0 && marker <= 0xFFC3) {
                const sizeBuf = Buffer.alloc(5);
                fs.readSync(fd, sizeBuf, 0, 5, offset + 4);
                const height = sizeBuf.readUInt16BE(1);
                const width = sizeBuf.readUInt16BE(3);
                fs.closeSync(fd);
                return { width, height };
            }
            offset += size + 2;
        }
        fs.closeSync(fd);
    } catch (e) {
        // Fallback
    }
    return { width: 800, height: 1000 };
}

function main() {
    try {
        if (!fs.existsSync(SOURCE_DIR)) {
            console.error('Error: met_collection folder does not exist at root!');
            return;
        }

        const folders = fs.readdirSync(SOURCE_DIR).filter(f => fs.statSync(path.join(SOURCE_DIR, f)).isDirectory());
        console.log(`Scanning local files across ${folders.length} directories...`);

        const manifest = {};

        for (const folder of folders) {
            const folderPath = path.join(SOURCE_DIR, folder);
            const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jpg'));
            
            console.log(`  - ${folder}: found ${files.length} images.`);
            
            manifest[folder] = [];

            for (const file of files) {
                let artist = 'The Met Collection';
                let title = file.replace(/\.jpg$/, '').replace(/_/g, ' ');
                let metId = null;

                // 1. Try to parse pre-existing file format: "Title - Artist.jpg"
                const dashMatch = file.match(/^(.+) - (.+)\.jpg$/);
                if (dashMatch) {
                    title = dashMatch[1].trim();
                    artist = dashMatch[2].trim();
                } 
                // 2. Try to parse downloaded file format: "MET_ID_Title.jpg"
                else {
                    const metMatch = file.match(/^MET_(\d+)_(.+)\.jpg$/);
                    if (metMatch) {
                        metId = metMatch[1];
                        title = metMatch[2].replace(/_/g, ' ').trim();
                        
                        // Set artist hint if in artist-specific folder
                        if (folder.includes('Gogh')) {
                            artist = 'Vincent van Gogh';
                        } else if (folder.includes('Monet')) {
                            artist = 'Claude Monet';
                        }
                    } else {
                        // Title fallback for other formats
                        if (folder.includes('Gogh')) {
                            artist = 'Vincent van Gogh';
                        } else if (folder.includes('Monet')) {
                            artist = 'Claude Monet';
                        }
                    }
                }

                const filePath = path.join(folderPath, file);
                const { width, height } = getJpegDimensions(filePath);

                manifest[folder].push({
                    id: metId ? `met_${metId}` : `met_local_${Math.random().toString(36).substr(2, 9)}`,
                    title: title,
                    artist: artist,
                    image: `/met_collection/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`,
                    orientation: width >= height ? 'landscape' : 'portrait'
                });
            }
        }

        // Write the manifest javascript file
        const manifestContent = `// Auto-generated Met Art Local Manifest\n` +
            `export const MET_LOCAL_COLLECTIONS = ${JSON.stringify(manifest, null, 4)};\n`;
        
        fs.writeFileSync(MANIFEST_PATH, manifestContent);
        console.log(`\nSuccess! Strictly categorized local artworks by filesystem folder.`);
        console.log(`Generated manifest at: ${MANIFEST_PATH}`);

    } catch (e) {
        console.error('Error generating Met manifest:', e);
    }
}

main();
