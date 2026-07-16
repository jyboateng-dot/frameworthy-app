const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    console.log('Navigating to framed-prints...');
    try {
        await page.goto('https://www.bubolaenaibo.com/collezione/framed-prints/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('Page loaded, waiting for Cloudflare challenge if any...');
        await page.waitForTimeout(10000); // Wait 10s for JS challenge to resolve and redirect
        
        console.log('Extracting product links...');
        
        const products = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.product, .item, article, .col-md-4, li.product'));
            return items.map(item => {
                const link = item.querySelector('a');
                const img = item.querySelector('img');
                const title = item.querySelector('h2, h3, .title, .woocommerce-loop-product__title');
                const desc = item.querySelector('.description, .excerpt, p');
                return {
                    url: link ? link.href : null,
                    img: img ? img.src : null,
                    title: title ? title.innerText.trim() : null,
                    desc: desc ? desc.innerText.trim() : null,
                    html: item.innerHTML.substring(0, 500)
                };
            }).filter(i => i.url || i.img);
        });
        
        // Let's also just dump the whole body HTML in case our selectors are wrong
        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'page_body.html'), html);
        
        fs.writeFileSync(path.join(__dirname, 'scrape_test.json'), JSON.stringify({ count: products.length, products: products.slice(0, 5) }, null, 2));
        console.log('Dumped to scrape_test.json. Found ' + products.length + ' items.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

run().catch(console.error);
