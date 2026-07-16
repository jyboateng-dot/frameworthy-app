const fs = require('fs');
const html = fs.readFileSync('scratch/archive_bubola.html', 'utf8');

// The dimensions are usually near the product titles. Let's find all text blocks matching a dimension pattern like "40x50" or "40 x 50"
const regex = /(?:Framed Print|Stampa Incorniciata)?\s*([0-9]{4}[A-Z0-9]+)\s*<.*?([0-9]{2,3}\s*[xX]\s*[0-9]{2,3}\s*cm)/gi;
let match;
while ((match = regex.exec(html)) !== null) {
    console.log(match[1] + ' => ' + match[2]);
}

// Let's also just dump any lines containing 'cm' to see what they look like
const lines = html.split('\n');
const cmLines = lines.filter(l => l.includes('cm') && /[0-9]{2,3}x[0-9]{2,3}/.test(l));
console.log('CM Lines:', cmLines.slice(0, 10));
