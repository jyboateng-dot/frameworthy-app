const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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
const TARGET_DIR = path.join(__dirname, '../../public/framed-prints');

async function run() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Warm up the cloudflare challenge
    console.log('Warming up Cloudflare...');
    await page.goto('https://www.bubolaenaibo.com/en/framed-prints/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(6000);

    for (const thumbFile of RAW_FILES) {
        const fullResFile = thumbFile.replace(/-\d+x\d+\.jpg$/, '') + '.jpg';
        
        for (const file of [thumbFile, fullResFile]) {
            const dest = path.join(TARGET_DIR, file);
            if (fs.existsSync(dest) && fs.statSync(dest).size > 20000) {
                continue; // Skip valid downloaded files
            }
            const url = BASE_URL + file;
            console.log('Downloading ' + file);
            
            try {
                await page.goto(url, { waitUntil: 'networkidle' });
                await page.waitForTimeout(1000);
                
                // Read the image from the page by fetching its blob and turning it to base64
                const b64 = await page.evaluate(async (srcUrl) => {
                    const r = await fetch(srcUrl);
                    if (!r.ok) return null;
                    const blob = await r.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                }, url);
                
                if (b64) {
                    const buffer = Buffer.from(b64.split(',')[1], 'base64');
                    if (buffer.length > 20000) {
                        fs.writeFileSync(dest, buffer);
                        console.log('Success: ' + file);
                    } else {
                        console.log('Skipped ' + file + ' (size too small: ' + buffer.length + ')');
                    }
                } else {
                    console.log('Failed to fetch ' + file);
                }
            } catch (e) {
                console.log('Error on ' + file + ': ' + e.message);
            }
        }
    }
    
    await browser.close();
    
    // Now update the Modal with the actual valid files
    const validRawFiles = [];
    for (const thumbFile of RAW_FILES) {
        const fullResFile = thumbFile.replace(/-\d+x\d+\.jpg$/, '') + '.jpg';
        const thumbDest = path.join(TARGET_DIR, thumbFile);
        const fullResDest = path.join(TARGET_DIR, fullResFile);
        if (fs.existsSync(thumbDest) && fs.existsSync(fullResDest) && fs.statSync(thumbDest).size > 20000 && fs.statSync(fullResDest).size > 20000) {
            validRawFiles.push(thumbFile);
        }
    }
    console.log('Valid RAW_FILES to write to Modal: ' + validRawFiles.length);
    const modalPath = path.join(__dirname, '../../src/components/InspirationSelectionModal.jsx');
    let text = fs.readFileSync(modalPath, 'utf8');
    const match = text.match(/const RAW_FILES = (\[[\s\S]*?\]);/);
    if (match) {
        let newArrayStr = '[\n    ' + validRawFiles.map(f => "'" + f + "'").join(', ') + '\n]';
        text = text.replace(match[0], 'const RAW_FILES = ' + newArrayStr + ';');
        text = text.replace(/const BASE = '.*?';/, "const BASE = '/framed-prints/';");
        fs.writeFileSync(modalPath, text);
        console.log('Updated InspirationSelectionModal.jsx to use local files!');
    }
}

run().catch(console.error);
