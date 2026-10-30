import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const { museumFeed, archivalFeed } = await import('../functions/museumFeeds.js');

const SOURCES = [
    { id: 'art-institute-of-chicago', type: 'museum' },
    { id: 'cleveland-museum-of-art', type: 'museum' },
    { id: 'paris-musees', type: 'museum' },
    { id: 'rijksmuseum', type: 'museum' },
    { id: 'smithsonian-open-access', type: 'museum' },
    { id: 'biodiversity-heritage-library', type: 'archival' },
    { id: 'nasa-open-media', type: 'archival' },
    { id: 'library-of-congress', type: 'archival' },
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function syncAll() {
    console.log('--- Syncing museum snapshots in exact API order ---');
    for (const source of SOURCES) {
        const fetchFn = source.type === 'archival' ? archivalFeed : museumFeed;
        const dir = path.join(ROOT, 'public', 'museum-data', source.id);
        await fs.mkdir(dir, { recursive: true });

        console.log(`\nFetching ${source.id}...`);
        for (let page = 1; page <= 3; page++) {
            try {
                const data = await fetchFn(source.id, page);
                if (!data || !Array.isArray(data.artworks) || data.artworks.length === 0) {
                    throw new Error(`Empty artworks for ${source.id} page ${page}`);
                }
                const outPath = path.join(dir, `${page}.json`);
                await fs.writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8');
                console.log(`  Page ${page}: ${data.artworks.length} items (total: ${data.total}) -> ${outPath}`);
                console.log(`    First: "${data.artworks[0]?.title}" by ${data.artworks[0]?.artist}`);
                console.log(`    Last:  "${data.artworks[data.artworks.length - 1]?.title}" by ${data.artworks[data.artworks.length - 1]?.artist}`);
            } catch (err) {
                console.error(`  Error fetching ${source.id} page ${page}:`, err.message);
                throw err;
            }
            await sleep(400); // Politeness delay to prevent rate limits
        }
    }
    console.log('\nAll snapshots synced successfully in exact API order!');
}

syncAll().catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
});
