const fs = require('fs');
const html = fs.readFileSync('scratch/archive_bubola.html', 'utf8');

const blocks = html.split(/class="single_prodotto\s/);
const dims = {};

for (const block of blocks) {
    const imgMatch = block.match(/<img[^>]*src=["']([^"']+)["']/i);
    const titleMatch = block.match(/<span class=["']single_prodotto_title["']>([^<]+)<\/span>/i);
    
    if (imgMatch && titleMatch) {
        const src = imgMatch[1];
        let title = titleMatch[1];
        title = title.replace(/&#215;/g, 'x'); // decode multiplication sign
        
        // E.g. "6340/01 40x40 +s/na02 30x30+ppt av" -> 40x40
        const dimMatch = title.match(/(\d{2,3}\s*x\s*\d{2,3})/i);
        
        if (dimMatch && src.includes('uploads')) {
            let file = src.split('/').pop();
            file = file.replace(/-\d+x\d+\.jpg$/, '.jpg');
            
            let dimStr = dimMatch[1].replace(/x/i, ' x ') + ' cm';
            dims[file] = dimStr;
        }
    }
}

console.log('Parsed ' + Object.keys(dims).length + ' dimensions.');
if (Object.keys(dims).length > 0) {
    const currentDims = JSON.parse(fs.readFileSync('src/data/source_dims.json', 'utf8'));
    let added = 0;
    for (const [file, dim] of Object.entries(dims)) {
        if (currentDims[file] !== dim) {
            currentDims[file] = dim;
            added++;
        }
    }
    fs.writeFileSync('src/data/source_dims.json', JSON.stringify(currentDims, null, 2));
    console.log('Updated ' + added + ' dimensions in source_dims.json');
}
