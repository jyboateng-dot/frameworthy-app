import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOVIESLOCAL_PATH = path.join(__dirname, 'moviesLocal.js');

const GENRES = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Romance', 'Thriller', 'Animation'];
const OMDB_API_KEY = 'trilogy'; // Public educational key

// Fetch IMDB Top 250
function fetchTop250() {
    return new Promise((resolve, reject) => {
        https.get('https://raw.githubusercontent.com/theapache64/top250/master/top250.json', res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Fetch movies from OMDb by title search
function searchOMDB(keyword, page = 1) {
    return new Promise((resolve) => {
        const url = `https://www.omdbapi.com/?s=${encodeURIComponent(keyword)}&type=movie&page=${page}&apikey=${OMDB_API_KEY}`;
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.Search || []);
                } catch {
                    resolve([]); // fail silently
                }
            });
        }).on('error', () => resolve([]));
    });
}

// Map of genre to search keywords to help find relevant movies in OMDb
const genreKeywords = {
    'Action': ['blood', 'war', 'gun', 'strike', 'force'],
    'Comedy': ['funny', 'laugh', 'crazy', 'stupid', 'party'],
    'Drama': ['life', 'story', 'family', 'boy', 'girl'],
    'Sci-Fi': ['star', 'alien', 'space', 'earth', 'moon'],
    'Horror': ['dead', 'night', 'dark', 'evil', 'ghost'],
    'Romance': ['love', 'heart', 'kiss', 'wedding', 'romance'],
    'Thriller': ['kill', 'secret', 'spy', 'murder', 'crime'],
    'Animation': ['toy', 'animal', 'magic', 'dragon', 'ice']
};

async function updateMoviesLocal() {
    console.log("Fetching IMDB Top 250...");
    let top250 = [];
    try {
        top250 = await fetchTop250();
    } catch (e) {
        console.error("Failed to fetch Top 250:", e);
        return;
    }

    const collections = {
        'IMDB Top 200': []
    };
    GENRES.forEach(g => collections[g] = []);

    const existingIds = new Set();

    // Process Top 200
    for (let i = 0; i < 200 && i < top250.length; i++) {
        const m = top250[i];
        const id = m.url.split('/')[2];
        const poster = m.image;
        if (!poster || poster === 'N/A') continue;

        const movieObj = {
            id: id,
            title: m.name,
            year: m.datePublished ? m.datePublished.substring(0, 4) : '',
            image: poster
        };

        collections['IMDB Top 200'].push(movieObj);
        existingIds.add(id);

        // Distribute to genres
        if (m.genre && Array.isArray(m.genre)) {
            m.genre.forEach(g => {
                if (collections[g] && collections[g].length < 50) {
                    collections[g].push(movieObj);
                }
            });
        }
    }

    // Fill missing genres up to 50
    for (const genre of GENRES) {
        console.log(`Filling genre ${genre}. Current count: ${collections[genre].length}`);
        const keywords = genreKeywords[genre];
        let keywordIdx = 0;
        let page = 1;

        while (collections[genre].length < 50 && keywordIdx < keywords.length) {
            const keyword = keywords[keywordIdx];
            const results = await searchOMDB(keyword, page);
            
            for (const r of results) {
                if (collections[genre].length >= 50) break;
                if (!existingIds.has(r.imdbID) && r.Poster && r.Poster !== 'N/A') {
                    // Upgrade OMDB poster resolution if possible (usually _V1_SX300.jpg -> _V1_.jpg)
                    let hqPoster = r.Poster;
                    if (hqPoster.includes('_V1_SX300')) {
                        hqPoster = hqPoster.replace('_V1_SX300', '_V1_');
                    }

                    collections[genre].push({
                        id: r.imdbID,
                        title: r.Title,
                        year: r.Year,
                        image: hqPoster
                    });
                    existingIds.add(r.imdbID);
                }
            }

            page++;
            if (page > 3 || results.length === 0) {
                page = 1;
                keywordIdx++;
            }
            // Sleep to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        }
    }

    const output = `export const MOVIES_LOCAL_COLLECTIONS = ${JSON.stringify(collections, null, 4)};\n`;
    fs.writeFileSync(MOVIESLOCAL_PATH, output, 'utf-8');
    console.log("Successfully generated moviesLocal.js");
}

updateMoviesLocal();
