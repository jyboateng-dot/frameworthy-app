import fs from 'fs';
const html = fs.readFileSync('catalog_downloads/supplier-source-archive/frames/frame-9565/supplier-product-page.html', 'utf8');
const match = html.match(/"images":\s*(\[\{.*?\}\])/s);
if (match) {
    console.log(match[1].substring(0, 1000));
} else {
    console.log("No images array found in JSON.");
    
    // Let's try matching 'data-gallery-role="gallery"' or similar
    const urls = [];
    const regex = /"full":\s*"([^"]+)"/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
        urls.push(m[1].replace(/\\\//g, '/'));
    }
    console.log("Full URLs found:", urls);
}
