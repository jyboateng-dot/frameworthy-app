import fs from 'fs';
import path from 'path';

const DELAY_MS = 10;
const MAX_ATTEMPTS = 4;
const ASSETS_DIR = path.join(process.cwd(), 'public', 'frames', 'assets');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isUsableImage(buf) {
    if (!buf || buf.length < 4) return false;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
    if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return true; // PNG
    if (buf.toString('ascii', 0, 4) === 'RIFF') return true; // WEBP
    return false;
}

async function fetchWithRetry(url, retries = 3, isHtml = false) {
  for (let i = 1; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
            Accept: isHtml ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' : 'image/avif,image/webp,image/jpeg,image/png,*/*',
            Referer: 'https://frameworthy.com/',
        }
      });
      if (!response.ok) {
        if (response.status >= 500) {
            await sleep(DELAY_MS * i * 3);
            continue;
        }
        throw new Error(`Status ${response.status}`);
      }
      
      if (isHtml) return await response.text();
      
      const buf = Buffer.from(await response.arrayBuffer());
      if (!isUsableImage(buf)) {
          console.warn(`[WARN] Not a usable image: ${url}`);
          await sleep(DELAY_MS * i * 3);
          continue;
      }
      return buf;
      
    } catch (e) {
      if (i === retries) throw e;
      await sleep(DELAY_MS * i * 3);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

async function scrapeFrame(slug) {
  const dir = path.join(ASSETS_DIR, slug);
  const url = `https://frameworthy.com/${slug}.html`;
  
  console.log(`[Frame] Fetching ${slug}...`);
  
  let html;
  try {
      html = await fetchWithRetry(url, MAX_ATTEMPTS, true);
  } catch(e) {
      console.error(`[Frame] Error fetching HTML for ${slug}: ${e.message}`);
      return;
  }

  // Clear directory before we repopulate to avoid zombie corrupt files
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });

  const imagesMatch = html.match(/"images":\s*(\[\{.*?\}\])/s);
  let imagesList = [];
  if (imagesMatch) {
    try {
      const jsonStr = imagesMatch[1].replace(/\\\//g, '/'); 
      const imagesData = JSON.parse(jsonStr);
      imagesList = imagesData.map(img => ({
          url: img.full || img.img,
          position: img.position || '0'
      })).filter(i => i.url);
    } catch (e) {
      const fallbackMatches = imagesMatch[1].match(/"full":"(.*?)"/g);
      if (fallbackMatches) {
        imagesList = fallbackMatches.map((m, idx) => ({
            url: m.replace(/"full":"(.*)"/, '$1').replace(/\\\//g, '/'),
            position: String(idx)
        }));
      }
    }
  }

  // Deduplicate by URL to avoid fetching exact same URL twice
  const distinctUrls = new Map();
  for (const item of imagesList) {
      if (!distinctUrls.has(item.url)) {
          distinctUrls.set(item.url, item);
      }
  }
  imagesList = Array.from(distinctUrls.values());

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

  for (let i = 0; i < imagesList.length; i++) {
    const imgObj = imagesList[i];
    const imgUrl = imgObj.url;
    if (!imgUrl.startsWith('http')) continue;
    
    const originalFilename = imgUrl.split('/').pop();
    // Prefix with position to ensure distinct images sharing a filename don't overwrite
    const filename = `pos${imgObj.position}_${originalFilename}`;
    const dest = path.join(dir, filename);
    
    try {
      const buf = await fetchWithRetry(imgUrl, MAX_ATTEMPTS, false);
      fs.writeFileSync(dest, buf);
      details.images.push(filename);
    } catch (e) {
      console.error(`[Frame] Failed to download ${imgUrl} : ${e.message}`);
    }
    
    await sleep(5); // Be polite
  }

  fs.writeFileSync(path.join(dir, 'details.json'), JSON.stringify(details, null, 2));
  console.log(`[Frame] Finished scraping ${slug} (${details.images.length} images).`);
  await sleep(10); // Delay between frames
}

async function main() {
    let slugs = [];
    if (fs.existsSync('missing_frames.json')) {
        slugs = JSON.parse(fs.readFileSync('missing_frames.json', 'utf8'));
    } else {
        console.error("missing_frames.json not found!");
        process.exit(1);
    }
    
    console.log(`Starting refetch for ${slugs.length} frames...`);
    for (let i = 0; i < slugs.length; i++) {
        console.log(`\n--- Progress: ${i+1} / ${slugs.length} ---`);
        await scrapeFrame(slugs[i]);
    }
    console.log("DONE!");
}

main().catch(console.error);
