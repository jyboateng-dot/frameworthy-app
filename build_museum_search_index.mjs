// Builds public/museum-data/search-index.json — a lightweight, deduplicated
// {id, title, artist, image} record per unique Museum Art product, used
// solely to make the catalog searchable from SearchPage's "Search Everything"
// tab.
//
// WHY THIS EXISTS SEPARATELY FROM THE PER-CATEGORY FILES
//
// Every other source SearchPage searches (Original Paintings, Met Museum,
// Album Artwork, ...) is a small static JS array bundled directly into the
// app, so it's just filtered in memory. Museum Art can't work that way — at
// ~33k products it's split into public/museum-data/<category>.json files,
// fetched on demand per tab specifically so the app never has to load the
// whole catalog at once (see scrape_bymuseum_cloudinary.mjs). A product also
// isn't unique-per-file: the same painting can appear in several category
// files (an artist bucket AND a subject bucket, for instance), so naively
// searching across all 96 files would need to fetch every one of them (tens
// of MB) and dedupe by id on every keystroke.
//
// This script does that dedup once, offline, and drops the fields search
// doesn't need (description, shortDescription, categories) — those are what
// make the full per-category files heavy. What's left is small enough
// (~6MB for the full catalog) to fetch once when the Search tab is used,
// and it carries everything a search result needs to render AND hand off to
// the frame customizer directly, with no second fetch required per result.
//
// Re-run this after any change to the per-category files in
// public/museum-data/ (i.e. after re-running scrape_bymuseum_cloudinary.mjs).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'public', 'museum-data');
const OUTPUT_FILE = path.join(DATA_DIR, 'search-index.json');

function main() {
    const files = fs.readdirSync(DATA_DIR).filter(
        (f) => f.endsWith('.json') && f !== 'index.json' && f !== 'search-index.json'
    );

    const byId = new Map();
    for (const file of files) {
        const items = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        for (const item of items) {
            if (!byId.has(item.id)) {
                byId.set(item.id, {
                    id: item.id,
                    title: item.title,
                    artist: item.artist || null,
                    image: item.image,
                });
            }
        }
    }

    const index = Array.from(byId.values());
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index));

    const sizeMb = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
    console.log(`Wrote search-index.json: ${index.length} unique products, ${sizeMb}MB, from ${files.length} category files.`);
}

main();
