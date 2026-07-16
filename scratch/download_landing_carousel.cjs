const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const slides = [
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80',
    'https://www.bubolaenaibo.com/wp-content/uploads/2016/11/AMB-05.jpg',
    'https://www.bubolaenaibo.com/wp-content/uploads/2020/03/covid.jpg',
    'https://www.bubolaenaibo.com/wp-content/uploads/2017/11/CANVA-028280B0-v2.jpg',
    'https://www.bubolaenaibo.com/wp-content/uploads/2017/10/NEWS1.jpg',
    'https://cdn.sanity.io/images/cctd4ker/production/c41e0fc21fa1980662be92fd729fa6ba86ee87c6-5121x1707.jpg?w=1920&q=75&auto=format',
    'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80',
    'https://globalimageproducts.com/wp-content/uploads/2024/07/Framed-Portrait-30x30-1.jpg',
    'https://globalimageproducts.com/wp-content/uploads/2024/07/Framed-Portrait-24x36-1.jpg',
    'https://i.etsystatic.com/42824319/r/il/25a459/7597064891/il_1588xN.7597064891_f4e3.jpg'
];

const dir = path.join(__dirname, '../public/landing_carousel');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        }, function(response) {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return download(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                fs.unlink(dest, () => {});
                return reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
            }
            
            response.pipe(file);
            file.on('finish', function() {
                file.close(resolve);
            });
        }).on('error', function(err) {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function run() {
    console.log('Downloading landing page carousel images...');
    for (let i = 0; i < slides.length; i++) {
        const dest = path.join(dir, `slide-${i + 1}.jpg`);
        if (!fs.existsSync(dest)) {
            console.log(`Downloading slide ${i + 1}...`);
            try {
                await download(slides[i], dest);
                console.log(`Saved slide-${i + 1}.jpg`);
            } catch (err) {
                console.error(`Error downloading slide ${i + 1}:`, err.message);
                // Fallback to picsum if it fails
                console.log('Falling back to picsum for slide ' + (i+1));
                await download(`https://picsum.photos/1600/1000?random=${i+100}`, dest);
            }
        } else {
            console.log(`Slide ${i + 1} already exists, skipping.`);
        }
    }
    console.log('Done!');
}

run();
