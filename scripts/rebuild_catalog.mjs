import fs from 'fs';
import path from 'path';

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// 1. Read existing constants.jsx to extract categories, prices, base colors
const constantsContent = fs.readFileSync('src/data/constants.jsx', 'utf8');

// Use a simple regex to pull out objects from FRAME_STYLES array
const frameRegex = /\{\s*id:\s*'frame-[^']+',\s*name:\s*'([^']+)',\s*category:\s*'([^']+)',\s*baseColor:\s*'([^']+)',.*?widthCategory:\s*'([^']+)',\s*priceMod:\s*([\d.]+)/gs;
let match;
const legacyMetadata = {};

while ((match = frameRegex.exec(constantsContent)) !== null) {
  const [, name, category, baseColor, widthCategory, priceMod] = match;
  legacyMetadata[toSlug(name)] = {
    category,
    baseColor,
    widthCategory,
    priceMod: parseFloat(priceMod)
  };
  
  const baseName = name.replace(/ Picture Frame$/i, '').trim();
  legacyMetadata[toSlug(baseName)] = {
    category,
    baseColor,
    widthCategory,
    priceMod: parseFloat(priceMod)
  };
}

// 2. Iterate through public/frames/assets to generate new array
const assetsDir = 'public/frames/assets';
const folders = fs.readdirSync(assetsDir).filter(f => fs.statSync(path.join(assetsDir, f)).isDirectory());

const newFrames = [];

for (const folder of folders) {
  const detailsPath = path.join(assetsDir, folder, 'details.json');
  if (!fs.existsSync(detailsPath)) continue;
  
  const details = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
  
  // Try to find matching legacy metadata
  const baseName = details.title.replace(/ Picture Frame$/i, '').trim();
  const slug = toSlug(baseName);
  const meta = legacyMetadata[slug] || legacyMetadata[toSlug(details.title)] || {
    category: 'Other',
    baseColor: '#ffffff',
    widthCategory: 'standard',
    priceMod: 1.0
  };

  // Determine images
  const images = details.images || [];
  
  const cornerImg = images.find(i => (i.includes('corner') && i.includes('_a')) || (i.includes('_a.jpg') && !i.includes('profile')) || i.includes('corner_1')) || '';
  const profileImg = images.find(i => i.includes('_b.jpg') || i.includes('profile_1') || (i.includes('_a.jpg') && i.includes('profile'))) || '';
  const fullFrameImg = images.find(i => i.includes('imagemanipulator') || i.includes('framingengine')) || '';
  
  // Extract ID from folder or title (or generate one)
  // E.g. "contemporary-walnut-picture-frame" -> some ID. Or we can just extract the ID from the image names (like 10592_corner.jpg)
  let frameId = 'frame-' + Math.floor(Math.random() * 100000);
  if (images.length > 0) {
    const idMatch = images[0].match(/^(\d+)_/);
    if (idMatch) {
      frameId = `frame-${idMatch[1]}`;
    }
  }

  const borderSrc = fullFrameImg ? `/frames/assets/${folder}/${fullFrameImg}` : '';
  
  if (!borderSrc) {
    continue; // Exclude frames that lack a full 2D border rendering asset
  }

  const cornerSrc = cornerImg ? `/frames/assets/${folder}/${cornerImg}` : '';
  const profileSrc = profileImg ? `/frames/assets/${folder}/${profileImg}` : '';
  
  const frameObj = {
    id: frameId,
    name: baseName,
    category: meta.category,
    baseColor: meta.baseColor,
    filename: cornerImg || profileImg || images[0] || '', // Legacy fallback
    width: meta.widthCategory === 'wide' ? '36px' : '24px',
    widthCategory: meta.widthCategory,
    priceMod: meta.priceMod,
    type: 'Picture Frame',
    desc: `${baseName}.`,
    previewImg: cornerSrc || profileSrc,
    mouldingWidthInches: details.mouldingWidth || "1.0",
    rabbetDepthInches: details.rabbetDepth || "0.5",
    borderImageSource: borderSrc,
    cornerImage: cornerSrc,
    profileImage: profileSrc
  };
  
  newFrames.push(frameObj);
}

// 3. Inject new array back into constants.jsx
let newConstants = constantsContent.replace(/export const FRAME_STYLES = \[[\s\S]*?\];/m, 'export const FRAME_STYLES = [\n' + newFrames.map(f => {
  return `    {
        id: '${f.id}',
        name: '${f.name.replace(/'/g, "\\'")}',
        category: '${f.category}',
        baseColor: '${f.baseColor}',
        filename: '${f.filename}',
        width: '${f.width}',
        widthCategory: '${f.widthCategory}',
        priceMod: ${f.priceMod},
        type: '${f.type}',
        desc: '${f.desc.replace(/'/g, "\\'")}',
        previewImg: '${f.previewImg}',
        mouldingWidthInches: "${f.mouldingWidthInches}",
        rabbetDepthInches: "${f.rabbetDepthInches}",
        borderImageSource: '${f.borderImageSource}',
        cornerImage: '${f.cornerImage}',
        profileImage: '${f.profileImage}'
    }`;
}).join(',\n') + '\n];');

fs.writeFileSync('src/data/constants_new.jsx', newConstants, 'utf8');

console.log(`Rebuilt catalog with ${newFrames.length} frames.`);
