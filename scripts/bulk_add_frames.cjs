const fs = require('fs');
const https = require('https');
const path = require('path');

const urls = [
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/1/0/10684_corner_a_1.webp',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/1/0/10716_corner_a_1.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/1/0/10685_corner_a_1.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/1/0/10065_corner_a_1_2.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/6/5/6526a.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/9/1/9135_corner_a_1.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/9/5/9599_a.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/1/0/10683_b.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/8/8/8837_a.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/1/1/11153_corner_a_1_1.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/9/1/9136_a.jpg',
    'https://frameworthy.com/media/catalog/product/cache/d0c29c6dc3aae5c0777ddc231d6260e8/9/6/9600_a.jpg'
];

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                   .on('error', reject)
                   .once('close', () => resolve(filepath));
            } else {
                res.resume();
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
            }
        });
    });
}

function extractId(url) {
    const filename = url.split('/').pop();
    const match = filename.match(/^(\d+)/);
    if (match) return match[1];
    return filename.split('.')[0];
}

function extractExtension(url) {
    const filename = url.split('/').pop();
    return filename.split('.').pop() || 'jpg';
}

async function run() {
    const constantsPath = path.join(__dirname, 'src', 'data', 'constants.jsx');
    let constantsContent = fs.readFileSync(constantsPath, 'utf8');

    // Extract all existing IDs from constants.jsx to enforce duplicate rule
    const existingIds = new Set();
    const idRegex = /id:\s*'([^']+)'/g;
    let match;
    while ((match = idRegex.exec(constantsContent)) !== null) {
        existingIds.add(match[1]);
        // Also add just the numeric part if it starts with 'frame-' to be safe
        if (match[1].startsWith('frame-')) {
            existingIds.add(match[1].replace('frame-', ''));
        }
    }

    const uniqueFrames = new Map();
    const declined = [];

    for (const url of urls) {
        const baseId = extractId(url);
        const frameId = `frame-${baseId}`;
        
        // CHECK IF ALREADY FEATURED!
        if (existingIds.has(baseId) || existingIds.has(frameId) || uniqueFrames.has(baseId)) {
            declined.push({ url, reason: `Duplicate style ${baseId} already added` });
            continue;
        }
        
        const ext = extractExtension(url);
        uniqueFrames.set(baseId, {
            id: frameId,
            name: `Frame ${baseId}`,
            url,
            filename: `${frameId}.${ext}`
        });
    }

    console.log(`Found ${uniqueFrames.size} unique frames to add.`);
    console.log(`Declined ${declined.length} frames:`);
    console.log(declined);

    if (uniqueFrames.size === 0) {
        console.log('No new frames to add.');
        return;
    }

    let constantsAdditions = '';
    let landingPageAdditions = '';
    let getSideBackgroundAdditions = '';
    let cornerImagesAdditions = '';

    for (const [baseId, frame] of uniqueFrames.entries()) {
        const filepath = path.join(__dirname, 'public', 'frames', frame.filename);
        console.log(`Downloading ${frame.filename}...`);
        await downloadImage(frame.url, filepath);

        // Constants
        constantsAdditions += `    {
        id: '${frame.id}',
        name: '${frame.name}',
        color: '#d2b48c',
        width: '24px',
        priceMod: 1.2,
        type: 'Picture Frame',
        desc: 'Custom frame style ${baseId}.',
        gradient: 'linear-gradient(45deg, #e6d0a7, #fdf8eb, #d2b48c, #f5e9ce, #c19b6c)',
        previewImg: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80'
    },\n`;

        // LandingPage
        landingPageAdditions += `    '${frame.id}': {
        image: '/frames/${frame.filename}',
        accent: '#d2b48c',
    },\n`;

        // CustomizeFramePage
        getSideBackgroundAdditions += `        case '${frame.id}':
            if (side === 'top') return 'linear-gradient(to bottom, #f5e9ce 0%, #d2b48c 40%, #c19b6c 80%, #a87e4a 100%)';
            if (side === 'bottom') return 'linear-gradient(to top, #f5e9ce 0%, #d2b48c 40%, #c19b6c 80%, #a87e4a 100%)';
            if (side === 'left') return 'linear-gradient(to right, #f5e9ce 0%, #d2b48c 40%, #c19b6c 80%, #a87e4a 100%)';
            if (side === 'right') return 'linear-gradient(to left, #f5e9ce 0%, #d2b48c 40%, #c19b6c 80%, #a87e4a 100%)';
            return '#d2b48c';\n\n`;

        cornerImagesAdditions += `                                        '${frame.id}': '/frames/${frame.filename}',\n`;
    }

    // Read and modify constants.jsx
    constantsContent = constantsContent.replace(/];\s*export const FRAME_SIZES/, constantsAdditions + '];\n\nexport const FRAME_SIZES');
    fs.writeFileSync(constantsPath, constantsContent);

    // Read and modify LandingPage.jsx
    const landingPath = path.join(__dirname, 'src', 'pages', 'LandingPage.jsx');
    let landingContent = fs.readFileSync(landingPath, 'utf8');
    landingContent = landingContent.replace(/};\s*const CAROUSEL_SLIDES/, landingPageAdditions + '};\n\nconst CAROUSEL_SLIDES');
    fs.writeFileSync(landingPath, landingContent);

    // Read and modify CustomizeFramePage.jsx
    const customizePath = path.join(__dirname, 'src', 'pages', 'framing', 'CustomizeFramePage.jsx');
    let customizeContent = fs.readFileSync(customizePath, 'utf8');
    customizeContent = customizeContent.replace(/default:\s*return frame.color;/, getSideBackgroundAdditions + '        default:\n            return frame.color;');
    customizeContent = customizeContent.replace(/};\s*return \(\s*<button/, cornerImagesAdditions + '                                    };\n                                    return (\n                                        <button');
    fs.writeFileSync(customizePath, customizeContent);

    console.log('All files updated successfully.');
}

run().catch(console.error);
