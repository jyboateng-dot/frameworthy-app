const fs = require('fs');
const path = require('path');
const imageSize = require('image-size');
const sizeOf = imageSize.default || imageSize.imageSize || imageSize;

const directories = [
    'canvas-art',
    'original-paintings',
    'prestige-paintings',
    'glossy-art'
];

const FRAME_SIZES = [
    { id: '5x7', width: 5, height: 7, label: '13 x 18 cm', price: 19 },
    { id: '8x10', width: 8, height: 10, label: '20 x 25 cm', price: 29 },
    { id: 'a4', width: 8.27, height: 11.69, label: '21 x 30 cm (A4)', price: 34 },
    { id: '11x14', width: 11, height: 14, label: '28 x 35 cm', price: 39 },
    { id: '12x12', width: 12, height: 12, label: '30 x 30 cm', price: 39 },
    { id: '12x18', width: 12, height: 18, label: '30 x 45 cm', price: 45 },
    { id: 'a3', width: 11.69, height: 16.53, label: '30 x 42 cm (A3)', price: 49 },
    { id: '16x20', width: 16, height: 20, label: '40 x 50 cm', price: 59 },
    { id: 'a2', width: 16.53, height: 23.39, label: '42 x 60 cm (A2)', price: 65 },
    { id: '18x24', width: 18, height: 24, label: '45 x 60 cm', price: 69 },
    { id: '20x30', width: 20, height: 30, label: '50 x 75 cm', price: 79 },
    { id: '24x36', width: 24, height: 36, label: '60 x 90 cm', price: 89 },
];

function getBestDimensionString(w, h) {
    if (!w || !h) return '40 x 50 cm';

    if (w === h) {
        const sqSize = FRAME_SIZES.find(s => s.width === s.height);
        return sqSize ? sqSize.label : '30 x 30 cm';
    }

    const isLandscape = w > h;
    const targetRatio = Math.max(w, h) / Math.min(w, h);
    
    const rectSizes = FRAME_SIZES.filter(s => s.width !== s.height);
    let closestSize = rectSizes[0];
    let minDiff = Infinity;
    
    for (const size of rectSizes) {
        const sRatio = Math.max(size.width, size.height) / Math.min(size.width, size.height);
        const diff = Math.abs(sRatio - targetRatio);
        
        if (diff < minDiff - 0.005) {
            minDiff = diff;
            closestSize = size;
        } else if (Math.abs(diff - minDiff) <= 0.005) {
            const currentArea = closestSize.width * closestSize.height;
            const newArea = size.width * size.height;
            const targetArea = 320; 
            if (Math.abs(newArea - targetArea) < Math.abs(currentArea - targetArea)) {
                closestSize = size;
            }
        }
    }

    if (!closestSize) return isLandscape ? '50 x 40 cm' : '40 x 50 cm';

    const labelMatch = closestSize.label.match(/(\d+)\s*x\s*(\d+)/);
    if (labelMatch) {
        const [full, l1, l2] = labelMatch;
        const sShort = Math.min(parseInt(l1, 10), parseInt(l2, 10));
        const sLong = Math.max(parseInt(l1, 10), parseInt(l2, 10));
        const dimStr = isLandscape ? `${sLong} x ${sShort}` : `${sShort} x ${sLong}`;
        return closestSize.label.replace(full, dimStr);
    }
    return closestSize.label;
}

const map = {};

for (const dir of directories) {
    const fullPath = path.join(__dirname, './public/inspiration', dir);
    if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp'));
        for (const file of files) {
            try {
                const dims = sizeOf(path.join(fullPath, file));
                const bestString = getBestDimensionString(dims.width, dims.height);
                map[file] = bestString;
            } catch (e) {
                map[file] = '40 x 50 cm'; // fallback
            }
        }
    }
}

const outputPath = path.join(__dirname, './src/data/inspiration_dims.json');
fs.writeFileSync(outputPath, JSON.stringify(map, null, 2));
console.log(`Wrote ${Object.keys(map).length} dimensions to src/data/inspiration_dims.json`);
