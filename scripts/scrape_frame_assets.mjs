import fs from 'fs';
import path from 'path';
import https from 'https';

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1))); // backoff
    }
  }
}

async function scrapeFrame(url) {
  const urlObj = new URL(url);
  const slug = urlObj.pathname.split('/').pop().replace('.html', '');
  const dir = path.join(process.cwd(), 'frame assets', slug);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`[Frame] Fetching ${slug}...`);
  const html = await fetchWithRetry(url);

  // Extract images JSON
  const imagesMatch = html.match(/"images":\s*(\[\{.*?\}\])/s);
  let imageUrls = [];
  if (imagesMatch) {
    try {
      const jsonStr = imagesMatch[1].replace(/\\\//g, '/'); 
      const imagesData = JSON.parse(jsonStr);
      imageUrls = imagesData.map(img => img.full || img.img).filter(Boolean);
    } catch (e) {
      // Fallback
      const fallbackMatches = imagesMatch[1].match(/"full":"(.*?)"/g);
      if (fallbackMatches) {
        imageUrls = fallbackMatches.map(m => m.replace(/"full":"(.*)"/, '$1').replace(/\\\//g, '/'));
      }
    }
  }
  imageUrls = [...new Set(imageUrls)];

  const mouldingMatch = html.match(/([\d./-]+)\s*-?inch\s+moulding\s+width/i);
  const rabbetMatch = html.match(/([\d./-]+)\s*-?inch\s+rabbet\s+depth/i);
  const titleMatch = html.match(/<title>([^<]+)/i);
  
  const details = {
    url,
    title: titleMatch ? titleMatch[1].split('|')[0].trim() : slug,
    mouldingWidth: mouldingMatch ? mouldingMatch[1] : null,
    rabbetDepth: rabbetMatch ? rabbetMatch[1] : null,
    images: []
  };

  for (let i = 0; i < imageUrls.length; i++) {
    const imgUrl = imageUrls[i].replace(/\\\//g, '/');
    if (!imgUrl.startsWith('http')) continue;
    
    const filename = imgUrl.split('/').pop();
    const dest = path.join(dir, filename);
    
    try {
      if (!fs.existsSync(dest)) {
        await downloadImage(imgUrl, dest);
      }
      details.images.push(filename);
    } catch (e) {
      console.error(`[Frame] Failed to download ${imgUrl}`);
    }
  }

  fs.writeFileSync(path.join(dir, 'details.json'), JSON.stringify(details, null, 2));
  console.log(`[Frame] Finished scraping ${slug}.`);
}

async function getCategoryUrls() {
  const csvPath = path.join(process.cwd(), 'catalog_downloads', 'frame-render-supply-inventory.csv');
  const urls = new Set();
  if (fs.existsSync(csvPath)) {
    const csv = fs.readFileSync(csvPath, 'utf-8');
    const lines = csv.split('\n');
    for (const line of lines) {
      // Find frameworthy URLs in the CSV
      const match = line.match(/https:\/\/frameworthy\.com\/([a-z0-9-]+-picture-frame)\.html/);
      if (match) {
        urls.add(match[0]);
      }
    }
  }
  
  console.log(`[Category] Found ${urls.size} total frames in local inventory.`);
  return Array.from(urls);
}

async function main() {
  const target = process.argv[2];
  
  if (target && target.endsWith('.html') && !target.includes('picture-frames.html')) {
    // Single frame mode
    await scrapeFrame(target);
  } else {
    // Category mode (using local CSV)
    const urls = await getCategoryUrls();
    
    // Process sequentially
    for (const url of urls) {
      try {
        await scrapeFrame(url);
      } catch (err) {
        console.error(`Error processing ${url}:`, err.message);
      }
    }
  }
}

main().catch(console.error);
