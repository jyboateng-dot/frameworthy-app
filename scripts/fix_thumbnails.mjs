import fs from 'fs';
let content = fs.readFileSync('src/data/constants.jsx', 'utf8');
content = content.replace(/previewImg:\s*'(\/frames\/\d+)_b\.jpg'/g, "previewImg: '$1_a.jpg'");
content = content.replace(/filename:\s*'(\d+)_b\.jpg'/g, "filename: '$1_a.jpg'");
fs.writeFileSync('src/data/constants.jsx', content, 'utf8');
