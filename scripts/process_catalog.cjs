const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'catalog_downloads');
const destDir = path.join(__dirname, 'public', 'frames');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const catalogPath = path.join(__dirname, 'catalog_items.json');
const rawData = fs.readFileSync(catalogPath, 'utf8').replace(/^\uFEFF/, '');
const catalog = JSON.parse(rawData);

// Deduplicate catalog
const uniqueItems = new Map();
for (const item of catalog) {
    if (!uniqueItems.has(item.id)) {
        uniqueItems.set(item.id, item);
    }
}
const items = Array.from(uniqueItems.values());

function determineCategory(name) {
    const n = name.toLowerCase();
    if (/(flat|square|black|white|edge|minimalist|modern|deep\s)/.test(n) && !/(antique|ornate|rustic|wood)/.test(n)) {
        return 'Modern & Minimalist';
    }
    if (/(rustic|distressed|aged|blue|grey|pink|weathered|barnwood)/.test(n)) {
        return 'Rustic & Distressed';
    }
    if (/(wood|walnut|mahogany|burl|bamboo|pecan|brown|cherry|pine|clear)/.test(n)) {
        return 'Natural Woods';
    }
    if (/(scoop|embossed|glossy|textured|reverse|slope|canvas|shadow|beveled)/.test(n)) {
        return 'Textured & Decorative';
    }
    if (/(gold|silver|antique|ornate|traditional|bronze|pewter|brass|metallic)/.test(n)) {
        return 'Classic & Traditional';
    }
    // Fallbacks
    if (/(black|white)/.test(n)) return 'Modern & Minimalist';
    return 'Classic & Traditional';
}

function determineBaseColor(name) {
    const n = name.toLowerCase();
    if (n.includes('black')) return '#222222';
    if (n.includes('white')) return '#f0f0f0';
    if (n.includes('gold')) return '#d4af37';
    if (n.includes('silver')) return '#c0c0c0';
    if (n.includes('pewter') || n.includes('grey')) return '#8c92ac';
    if (n.includes('bronze')) return '#cd7f32';
    if (n.includes('blue')) return '#4682b4';
    if (n.includes('pink')) return '#d291bc';
    if (n.includes('brown') || n.includes('walnut') || n.includes('pecan') || n.includes('wood')) return '#654321';
    if (n.includes('mahogany')) return '#4a0404';
    return '#8b4513'; // default wood brown
}

let constantsContent = `// Auto-generated constants for 341 frames
export const FRAME_SIZES = [
    { id: '8x10', width: 8, height: 10, label: '8" x 10"', price: 29 },
    { id: '11x14', width: 11, height: 14, label: '11" x 14"', price: 39 },
    { id: '16x20', width: 16, height: 20, label: '16" x 20"', price: 59 },
    { id: '18x24', width: 18, height: 24, label: '18" x 24"', price: 69 },
    { id: '24x36', width: 24, height: 36, label: '24" x 36"', price: 89 },
];

export const MAT_COLORS = [
    { id: 'white', name: 'Polar White', hex: '#ffffff', price: 15 },
    { id: 'ivory', name: 'Warm Ivory', hex: '#fffff0', price: 15 },
    { id: 'black', name: 'Soot Black', hex: '#1a1a1a', price: 15 },
    { id: 'navy', name: 'Deep Navy', hex: '#000080', price: 20 },
    { id: 'grey', name: 'Ash Grey', hex: '#808080', price: 20 },
];

export const CATEGORIES = [
    'Modern & Minimalist',
    'Classic & Traditional',
    'Rustic & Distressed',
    'Natural Woods',
    'Textured & Decorative'
];

export const FRAME_STYLES = [
`;

for (const item of items) {
    const srcFile = path.join(srcDir, item.filename);
    const destFile = path.join(destDir, item.filename);
    
    // Move file if it exists in src
    if (fs.existsSync(srcFile)) {
        if (!fs.existsSync(destFile)) {
            fs.copyFileSync(srcFile, destFile);
        }
    }

    const category = determineCategory(item.name);
    const baseColor = determineBaseColor(item.name);
    
    constantsContent += `    {
        id: 'frame-${item.id}',
        name: '${item.name.replace(/'/g, "\\'")}',
        category: '${category}',
        baseColor: '${baseColor}',
        filename: '${item.filename}',
        width: '24px',
        priceMod: 1.2,
        type: 'Picture Frame',
        desc: '${item.name.replace(/'/g, "\\'")}.',
        previewImg: '/frames/${item.filename}'
    },\n`;
}

constantsContent += `];\n`;

const constantsPath = path.join(__dirname, 'src', 'data', 'constants.jsx');
fs.writeFileSync(constantsPath, constantsContent);

console.log(`Processed ${items.length} frames.`);
console.log('Constants generated.');
