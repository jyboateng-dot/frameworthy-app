import fs from 'fs';
let content = fs.readFileSync('src/pages/framing/CustomizeFramePage.jsx', 'utf8');
content = content.replace(
    /<p className="text-\[10px\] text-stone-500">\s*\)\}\s*<\/p>/g,
    '<p className="text-[10px] text-stone-500">{isPreset && presetDims ? presetDims : selectedFrame.category}</p>'
);
fs.writeFileSync('src/pages/framing/CustomizeFramePage.jsx', content, 'utf8');
