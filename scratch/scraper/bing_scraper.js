const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BING_URL = 'https://www.bing.com/inspire?FORM=IRPFED';
const TARGET_COUNT = 200;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'public', 'inspiration', 'web-images');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                   .on('error', reject)
                   .once('close', () => resolve(filepath));
            } else {
                res.resume();
                resolve(null);
            }
        }).on('error', reject);
    });
}

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log("Navigating to Bing Inspire...");
    await page.goto(BING_URL, { waitUntil: 'networkidle2' });

    const imageUrls = new Set();
    let scrollAttempts = 0;
    let previousHeight = 0;

    console.log(`Starting scroll loop. Target: ${TARGET_COUNT} images...`);
    while (imageUrls.size < TARGET_COUNT && scrollAttempts < 100) {
        const newImages = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs.map(img => img.src).filter(src => src && (src.includes('/th/id/OIG') || src.includes('bing.net/th/id/OIG')));
        });

        newImages.forEach(src => {
            // Clean URL to get the high res image
            let cleanUrl = src.split('?')[0];
            imageUrls.add(cleanUrl);
        });

        console.log(`Found ${imageUrls.size} unique image URLs so far...`);

        if (imageUrls.size >= TARGET_COUNT) break;

        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise(r => setTimeout(r, 1000));
        
        let newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === previousHeight) {
            scrollAttempts++;
        } else {
            scrollAttempts = 0;
            previousHeight = newHeight;
        }
    }

    console.log(`Finished scrolling. Found ${imageUrls.size} images. Saving list...`);
    const urlsArray = Array.from(imageUrls).slice(0, Math.max(TARGET_COUNT, imageUrls.size));
    
    fs.writeFileSync('urls.json', JSON.stringify(urlsArray, null, 2));

    console.log("Downloading images...");
    let downloadedCount = 0;
    const metadata = [];

    for (let i = 0; i < urlsArray.length; i++) {
        const url = urlsArray[i];
        const filename = `web_image_${i + 1}.jpg`;
        const filepath = path.join(OUTPUT_DIR, filename);
        
        try {
            await downloadImage(url, filepath);
            metadata.push({
                id: `web_${i + 1}`,
                title: `AI Inspire #${i + 1}`,
                artist: 'Bing Image Creator',
                image: `/inspiration/web-images/${filename}`,
                description: 'Generated inspirational artwork.'
            });
            downloadedCount++;
            if (downloadedCount % 10 === 0) console.log(`Downloaded ${downloadedCount}/${urlsArray.length}...`);
        } catch (e) {
            console.error(`Failed to download ${url}: ${e.message}`);
        }
    }

    console.log(`Finished downloading ${downloadedCount} images.`);

    // Write metadata file to public dir for easy frontend loading
    fs.writeFileSync(path.join(OUTPUT_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));
    
    await browser.close();
    console.log("Done.");
})();
