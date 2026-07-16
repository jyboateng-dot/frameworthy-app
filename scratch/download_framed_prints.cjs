const fs = require('fs');
const path = require('path');
const https = require('https');

const RAW_FILES = [
    '6340SC010140X-768x768.jpg','6340SC010240X-768x768.jpg','6340SC010411-768x586.jpg','6340S-NA0311-586x768.jpg',
    '6375S-010508-768x538.jpg','6375S-010608-768x538.jpg','6375S-010708-768x538.jpg','6375S-010808-768x538.jpg',
    '6375SC040140X-768x768.jpg','6375SC040240X-768x768.jpg','6375SC060311-768x590.jpg','6375SC060411-768x590.jpg',
    '6390SCOO0118-542x768.jpg','6390SCOO0240X-768x768.jpg','6390SCOO0311-608x768.jpg','6390SCOO0420X-768x768.jpg',
    '6440S-010140X-768x768.jpg','6440S-010311-585x768.jpg','6440S-020240X-768x768.jpg','6440S-020411-585x768.jpg',
    '6440S-050508-528x768.jpg','6440S-050608-528x768.jpg','6440S-050708-528x768.jpg','6440S-050808-528x768.jpg',
    '6470S-070508-768x542.jpg','6470S-070608-768x542.jpg','6470S-070708-768x542.jpg','6470S-070808-768x542.jpg',
    '6470SC020311-768x593.jpg','6470SC020411-768x593.jpg','6470SC040140X-768x768.jpg','6470SC040240X-768x768.jpg',
    '6540SC010311-768x590.jpg','6540SC010411-768x590.jpg','6540SC020140X-768x768.jpg','6540SC020240X-768x768.jpg',
    '6540SC030140X-768x768.jpg','6540SC030240X-768x768.jpg','6540SC040311-768x590.jpg','6540SC040411-768x590.jpg',
    '6570S-NA0111-586x768.jpg','6570S-NA0211-586x768.jpg','6570S-NA0311-586x768.jpg','6570S-NA0411-586x768.jpg',
    '6570SC010140X-768x768.jpg','6570SC010240X-768x768.jpg','6570SC020311-768x590.jpg','6570SC020411-768x590.jpg',
    '6585S-050508-768x538.jpg','6585S-050608-768x538.jpg','6585S-050708-768x538.jpg','6585S-050808-768x538.jpg',
    '6585S-NA0111-586x768.jpg','6585S-NA0211-586x768.jpg','6585SC010311-768x585.jpg','6585SC010411-768x585.jpg',
    '6635SC010140X-768x768.jpg','6635SC010240X-768x768.jpg','6635SC010411-768x586.jpg','6635S-NA0311-586x768.jpg',
    '6650S-070508-768x542.jpg','6650S-070608-768x542.jpg','6650S-070708-768x542.jpg','6650S-070808-768x542.jpg',
    '6650SC020311-768x593.jpg','6650SC020411-768x593.jpg','6650SC040140X-768x768.jpg','6650SC040240X-768x768.jpg',
];

const BASE_URL = 'https://www.bubolaenaibo.com/wp-content/uploads/2021/01/';
const TARGET_DIR = path.join(__dirname, '../public/framed-prints');

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            // Check size, if empty delete it
            const stats = fs.statSync(dest);
            if (stats.size > 0) {
                return resolve(true); // Already exists and is valid
            }
            fs.unlinkSync(dest);
        }
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(true);
                });
            } else if (response.statusCode === 404) {
                file.close();
                fs.unlinkSync(dest);
                resolve(false);
            } else {
                file.close();
                fs.unlinkSync(dest);
                reject('Server responded with: ' + response.statusCode);
            }
        }).on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err.message);
        });
    });
}

async function run() {
    let successCount = 0;
    let failCount = 0;
    for (const thumbFile of RAW_FILES) {
        const fullResFile = thumbFile.replace(/-\d+x\d+\.jpg$/, '') + '.jpg';
        
        const thumbUrl = BASE_URL + thumbFile;
        const fullResUrl = BASE_URL + fullResFile;
        
        const thumbDest = path.join(TARGET_DIR, thumbFile);
        const fullResDest = path.join(TARGET_DIR, fullResFile);
        
        try {
            await downloadFile(thumbUrl, thumbDest);
            await downloadFile(fullResUrl, fullResDest);
            successCount++;
        } catch (e) {
            console.error('Failed on ' + thumbFile + ':', e);
            failCount++;
        }
    }
    
    // Output valid RAW_FILES for InspirationSelectionModal
    const validRawFiles = [];
    for (const thumbFile of RAW_FILES) {
        const fullResFile = thumbFile.replace(/-\d+x\d+\.jpg$/, '') + '.jpg';
        const thumbDest = path.join(TARGET_DIR, thumbFile);
        const fullResDest = path.join(TARGET_DIR, fullResFile);
        if (fs.existsSync(thumbDest) && fs.existsSync(fullResDest)) {
            validRawFiles.push(thumbFile);
        }
    }
    
    console.log('Finished downloading. Success: ' + successCount + ', Fail: ' + failCount);
    console.log('Valid RAW_FILES to write to Modal: ' + validRawFiles.length);
    
    // Read InspirationSelectionModal.jsx and update RAW_FILES
    const modalPath = path.join(__dirname, '../src/components/InspirationSelectionModal.jsx');
    let text = fs.readFileSync(modalPath, 'utf8');
    
    // Also update the BASE url!
    const match = text.match(/const RAW_FILES = (\[[\s\S]*?\]);/);
    if (match) {
        let newArrayStr = '[\n    ' + validRawFiles.map(f => "'" + f + "'").join(', ') + '\n]';
        text = text.replace(match[0], 'const RAW_FILES = ' + newArrayStr + ';');
        text = text.replace(/const BASE = '.*?';/, "const BASE = '/framed-prints/';");
        fs.writeFileSync(modalPath, text);
        console.log('Updated InspirationSelectionModal.jsx to use local files!');
    }
}

run();
