import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ALBUMLOCAL_PATH = path.join(__dirname, 'albumsLocal.js');

function fetchAlbums(artistName, retries = 5) {
    return new Promise((resolve, reject) => {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=album&limit=200`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.results || []);
                } catch (e) {
                    if (data.includes("Rate limit") || data.includes("Forbidden") || data.includes("403")) {
                        console.log(`Rate limited on ${artistName}, waiting 10s...`);
                        if (retries > 0) {
                            setTimeout(() => fetchAlbums(artistName, retries - 1).then(resolve).catch(reject), 10000);
                        } else {
                            reject(new Error("Rate limit exceeded too many times"));
                        }
                    } else {
                        reject(new Error("Invalid JSON: " + data));
                    }
                }
            });
        }).on('error', (e) => {
            if (retries > 0) {
                setTimeout(() => fetchAlbums(artistName, retries - 1).then(resolve).catch(reject), 5000);
            } else {
                reject(e);
            }
        });
    });
}

async function updateAlbumsLocal() {
    const text = fs.readFileSync(ALBUMLOCAL_PATH, 'utf-8');
    const match = text.match(/export const ALBUMS_LOCAL_COLLECTIONS = (\{[\s\S]*\});/);
    if (!match) {
        console.error("Could not parse ALBUMS_LOCAL_COLLECTIONS");
        return;
    }
    
    const data = eval('(' + match[1] + ')');
    let totalProcessed = 0;
    
    for (const genre in data) {
        console.log(`Processing Genre: ${genre}`);
        for (const artist in data[genre]) {
            try {
                const results = await fetchAlbums(artist);
                
                // Keep existing albums
                const existingAlbums = data[genre][artist];
                const existingIds = new Set(existingAlbums.map(a => a.id.toString()));
                
                const filtered = results.filter(item => {
                    if (item.collectionType !== 'Album') return false;
                    const title = item.collectionName || '';
                    if (title.includes(' - Single') || title.includes(' - EP')) return false;
                    // Generic name check
                    if (item.artistName && !item.artistName.toLowerCase().includes(artist.toLowerCase().split(' ')[0])) return false;
                    return true;
                });
                
                for (const item of filtered) {
                    const idStr = item.collectionId.toString();
                    if (!existingIds.has(idStr)) {
                        const image = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '1000x1000bb') : '';
                        if (image) {
                            existingAlbums.push({
                                id: idStr,
                                title: item.collectionName,
                                artist: item.artistName,
                                image: image,
                                year: item.releaseDate ? item.releaseDate.substring(0, 4) : ''
                            });
                            existingIds.add(idStr);
                        }
                    }
                }
                
                // Deduplicate by clean title
                const seenTitles = new Set();
                const uniqueAlbums = [];
                for (const a of existingAlbums) {
                    const cleanTitle = a.title.toLowerCase().replace(/\[.*?\]|\(.*?\)/g, '').trim();
                    if (!seenTitles.has(cleanTitle)) {
                        seenTitles.add(cleanTitle);
                        uniqueAlbums.push(a);
                    }
                }
                data[genre][artist] = uniqueAlbums;
                totalProcessed++;
                console.log(`  [${totalProcessed}] Fetched: ${artist} - Total albums: ${uniqueAlbums.length}`);
            } catch (err) {
                console.error(`  Failed to fetch ${artist}: ${err.message}`);
            }
            // Sleep 500ms to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
            
            // Save incrementally
            const output = `export const ALBUMS_LOCAL_COLLECTIONS = ${JSON.stringify(data, null, 4)};\n`;
            fs.writeFileSync(ALBUMLOCAL_PATH, output, 'utf-8');
        }
    }
    
    console.log("Updated albumsLocal.js successfully.");
}

updateAlbumsLocal();
