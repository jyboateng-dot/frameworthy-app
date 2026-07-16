const fs = require('fs');

let code = fs.readFileSync('src/data/constants.jsx', 'utf8');

// Add category
code = code.replace(
  /'Textured & Decorative',/,
  "'Textured & Decorative',\n    'Ornate & Antique',"
);

// Replace categories for frames with Ornate or Antique in the name
code = code.replace(/name:\s*'[^']*(?:Ornate|Antique)[^']*',([\s\S]*?)category:\s*'[^']+'/g, (match, middle) => {
    if (middle.includes('}')) return match; // safeguard
    return match.replace(/category:\s*'[^']+'/, "category: 'Ornate & Antique'");
});

fs.writeFileSync('src/data/constants.jsx', code);
