const fs = require('fs');
const https = require('https');
const path = require('path');

function fetchPage(page) {
    const url = `https://frameworthy.com/custom-picture-frames.html?p=${page}&product_list_order=name`;
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function extractId(url) {
    const filename = url.split('/').pop();
    const match = filename.match(/^(\d+)/);
    if (match) return match[1];
    return filename.split('.')[0];
}

async function run() {
    const idToName = new Map();
    
    console.log("Fetching pages...");
    // Let's fetch the first 30 pages
    for (let page = 1; page <= 30; page++) {
        const html = await fetchPage(page);
        
        // Find all img tags inside product items
        // Since regex can be tricky with attribute order, let's look for:
        // alt="Name" and src=".../1234_..."
        
        const itemRegex = /<li class="item product product-item">([\s\S]*?)<\/li>/g;
        let itemMatch;
        let foundOnPage = 0;
        
        while ((itemMatch = itemRegex.exec(html)) !== null) {
            const itemHtml = itemMatch[1];
            
            // extract alt
            const altMatch = itemHtml.match(/alt="([^"]+)"/);
            // extract src (look for product image)
            const srcMatch = itemHtml.match(/src="(https:\/\/frameworthy\.com\/media\/catalog\/product\/cache\/[^"]+)"/);
            
            if (altMatch && srcMatch) {
                const title = altMatch[1].replace(/&#x20;/g, ' ').replace(/&quot;/g, '"');
                const url = srcMatch[1];
                const baseId = extractId(url);
                idToName.set(baseId, title);
                foundOnPage++;
            }
        }
        
        console.log(`Page ${page}: found ${foundOnPage} products.`);
        if (foundOnPage === 0) break;
    }
    
    console.log(`Extracted ${idToName.size} name mappings.`);
    
    const constantsPath = path.join(__dirname, 'src', 'data', 'constants.jsx');
    let constantsContent = fs.readFileSync(constantsPath, 'utf8');
    
    let replacements = 0;
    for (const [id, name] of idToName.entries()) {
        const frameId = `frame-${id}`;
        
        // replace generic name
        const genericNameRegex = new RegExp(`name:\\s*'Frame ${id}'`, 'g');
        if (genericNameRegex.test(constantsContent)) {
            constantsContent = constantsContent.replace(genericNameRegex, `name: '${name}'`);
            replacements++;
            console.log(`Replaced 'Frame ${id}' with '${name}'`);
        }
        // replace desc
        const descRegex = new RegExp(`desc:\\s*'Custom frame style ${id}\\.'`, 'g');
        if (descRegex.test(constantsContent)) {
            constantsContent = constantsContent.replace(descRegex, `desc: '${name}.'`);
        }
    }
    
    if (replacements > 0) {
        fs.writeFileSync(constantsPath, constantsContent);
        console.log(`Updated ${replacements} frame names in constants.jsx.`);
    } else {
        console.log('No generic names found to replace.');
    }
}

run().catch(console.error);
