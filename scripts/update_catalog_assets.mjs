import fs from 'fs';
import path from 'path';

const assetsDir = path.join(process.cwd(), 'public', 'frames', 'assets');
const constantsPath = path.join(process.cwd(), 'src', 'data', 'constants.jsx');

const detailsMap = {}; 
const folders = fs.readdirSync(assetsDir);

for (const folder of folders) {
  const detailsPath = path.join(assetsDir, folder, 'details.json');
  if (fs.existsSync(detailsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
      const slug = data.url.split('/').pop().replace('.html', '');
      detailsMap[slug] = { ...data, slug };
    } catch (e) {
      console.error(`Error reading ${detailsPath}`);
    }
  }
}

let content = fs.readFileSync(constantsPath, 'utf8');

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

let matchCount = 0;
const newContent = content.replace(/(\{\s*id:\s*'frame-[^']+',\s*name:\s*'([^']+)',[\s\S]*?\s*\})/g, (match, block, name) => {
  let baseName = name.replace(' Picture Frame', '').replace('Picture Frame', '').trim();
  let searchSlug = toSlug(baseName) + '-picture-frame';
  let detail = detailsMap[searchSlug] || detailsMap[toSlug(name)] || detailsMap[toSlug(name) + '-picture-frame'];

  if (detail) {
    matchCount++;
    let cleanBlock = block
      .replace(/\s*mouldingWidthInches:.*?,/g, '')
      .replace(/\s*rabbetDepthInches:.*?,/g, '')
      .replace(/\s*borderImageSource:.*?,/g, '')
      .replace(/\s*cornerImage:.*?,/g, '')
      .replace(/\s*profileImage:.*?,/g, '');

    const w = detail.mouldingWidth || '1.0';
    const d = detail.rabbetDepth || '0.5';
    
    // Find the imagemanipulator image
    const fullFrameImg = detail.images.find(i => i.includes('imagemanipulator') || i.includes('framingengine')) || '';
    const borderSrc = fullFrameImg ? `/frames/assets/${detail.slug}/${fullFrameImg}` : '';
    
    const cornerImg = detail.images.find(i => (i.includes('corner') && i.includes('_a')) || (i.includes('_a.jpg') && !i.includes('profile')) || i.includes('corner_1')) || '';
    const profileImg = detail.images.find(i => i.includes('_b.jpg') || i.includes('profile_1')) || '';

    // Notice the COMMA at the very start here to close the previous field!
    const injection = `,
        mouldingWidthInches: "${w}",
        rabbetDepthInches: "${d}",
        borderImageSource: '${borderSrc}',
        cornerImage: '${cornerImg ? `/frames/assets/${detail.slug}/${cornerImg}` : ''}',
        profileImage: '${profileImg ? `/frames/assets/${detail.slug}/${profileImg}` : ''}'`;

    return cleanBlock.replace(/\n\s*\}$/, `${injection}\n    }`);
  }
  return match;
});

fs.writeFileSync(constantsPath, newContent, 'utf8');
console.log(`Updated ${matchCount} frame objects in constants.jsx.`);
