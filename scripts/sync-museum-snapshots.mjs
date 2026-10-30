import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PAGE_SIZE = 24;

function cleanString(html, fallback = '') {
    if (!html) return fallback;
    let s = String(html);
    s = s.replace(/<div[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>.*?<\/div>/gis, '');
    s = s.replace(/<[^>]*>?/gm, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s || fallback;
}

function cleanTitle(titleHtml, fileTitle) {
    if (/Le Sommeil/i.test(fileTitle)) return 'Le Sommeil (The Sleepers)';
    if (/Nymphe et faune.*Baiser/i.test(fileTitle)) return 'Nymphe et faune (The Kiss)';
    if (/Le Baiser.*PPS1061\(2\)/i.test(fileTitle)) return 'Le Baiser (High Relief Study)';
    if (/Le Baiser/i.test(fileTitle)) return 'Le Baiser (The Kiss)';
    if (/H[eé]ro et L[eé]andre.*PPG5384/i.test(fileTitle)) return 'Héro et Léandre (Embossed Relief)';
    if (/H[eé]ro et L[eé]andre/i.test(fileTitle)) return 'Héro et Léandre';
    if (/Couple enlac[eé]/i.test(fileTitle)) return 'Couple enlacé couché dans un paysage';
    if (/La Musique.*PPS1069/i.test(fileTitle)) return 'La Musique (Intertwined Figures)';
    if (/La Treille/i.test(fileTitle)) return 'La Treille';
    if (/Les amants dans la campagne/i.test(fileTitle)) return 'Les amants dans la campagne';

    const rawFile = fileTitle.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/ - Google Art Project.*$/i, '').trim();
    let parts = rawFile.split(/\s*-\s*/);
    let fallbackTitle = parts.length > 1 ? parts.slice(1).join(' - ').trim() : rawFile;

    let t = cleanString(titleHtml);
    if (!t || t.toLowerCase() === 'untitled' || t.length < 2 || /(German|French|Italian|Spanish):/i.test(t)) {
        t = fallbackTitle;
    }
    t = t.replace(/^(English|French|Français)\s*:\s*/i, '');
    t = t.replace(/\s*\(cropped\)$/i, '');
    return t || fallbackTitle || 'Masterpiece';
}

function cleanArtist(artistHtml, fileTitle) {
    if (artistHtml?.includes('Desbois, Jules') || fileTitle.includes('Desbois')) return 'Jules Desbois';
    if (artistHtml?.includes('Roche, Pierre') || fileTitle.includes('Roche')) return 'Pierre Roche';
    if (artistHtml?.includes('Dalou, Aimé-Jules') || fileTitle.includes('Dalou')) return 'Aimé-Jules Dalou';
    if (artistHtml?.includes('Roussel, Ker-Xavier') || fileTitle.includes('Roussel')) return 'Ker-Xavier Roussel';
    if (artistHtml?.includes('Courbet, Gustave') || fileTitle.includes('Courbet')) return 'Gustave Courbet';
    if (artistHtml?.includes('Bigot, Alexandre') || fileTitle.includes('Bigot')) return 'Alexandre Bigot';

    const rawFile = fileTitle.replace(/^File:/, '').replace(/\.[^.]+$/, '').trim();
    const match = rawFile.match(/^([^-]+)\s*-\s*/);
    const fallbackArtist = match ? match[1].trim() : 'Master Artist';

    if (!artistHtml) return fallbackArtist;
    let firstPart = artistHtml.split(/<br\s*\/?>/i)[0];
    firstPart = firstPart.replace(/<div[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>.*?<\/div>/gis, '');
    firstPart = firstPart.replace(/<[^>]*>?/gm, '');
    firstPart = firstPart.replace(/Details on Google Art Project.*/gi, '');
    firstPart = firstPart.replace(/\s+/g, ' ').trim();
    if (!firstPart || firstPart.length < 2 || firstPart.toLowerCase() === 'unknown artist') {
        return fallbackArtist;
    }
    return firstPart;
}

async function fetchCommonsCategory(category, limit = 100) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('generator', 'categorymembers');
    url.searchParams.set('gcmtitle', category);
    url.searchParams.set('gcmtype', 'file');
    url.searchParams.set('gcmlimit', String(Math.min(limit, 100)));
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|dimensions|extmetadata');
    url.searchParams.set('iiurlwidth', '800');
    url.searchParams.set('format', 'json');

    const res = await fetch(url, { headers: { 'User-Agent': 'FrameWorthy/1.0 (contact@frameworthy.art)' } });
    if (!res.ok) throw new Error(`Commons API failed: ${res.status}`);
    const data = await res.json();
    return Object.values(data.query?.pages || []);
}

async function fetchCommonsSearch(searchQuery, limit = 100) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', searchQuery);
    url.searchParams.set('gsrnamespace', '6');
    url.searchParams.set('gsrlimit', String(Math.min(limit, 100)));
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|dimensions|extmetadata');
    url.searchParams.set('iiurlwidth', '800');
    url.searchParams.set('format', 'json');

    const res = await fetch(url, { headers: { 'User-Agent': 'FrameWorthy/1.0 (contact@frameworthy.art)' } });
    if (!res.ok) throw new Error(`Commons API failed: ${res.status}`);
    const data = await res.json();
    return Object.values(data.query?.pages || []);
}

async function fetchSpecificFile(filename) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', `File:${filename.replace(/^File:/, '')}`);
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|dimensions|extmetadata');
    url.searchParams.set('iiurlwidth', '800');
    url.searchParams.set('format', 'json');

    const res = await fetch(url, { headers: { 'User-Agent': 'FrameWorthy/1.0 (contact@frameworthy.art)' } });
    const data = await res.json();
    return Object.values(data.query?.pages || [])[0];
}

async function generateChicago() {
    console.log('Fetching Art Institute of Chicago masterpieces...');
    const [googleArtPages, categorySearchPages, nighthawks] = await Promise.all([
        fetchCommonsCategory('Category:Google_Art_Project_works_in_The_Art_Institute_of_Chicago', 100),
        fetchCommonsSearch('incategory:Paintings_in_the_Art_Institute_of_Chicago OR incategory:Drawings_in_the_Art_Institute_of_Chicago OR incategory:Prints_in_the_Art_Institute_of_Chicago', 100),
        fetchSpecificFile('Nighthawks_by_Edward_Hopper_1942.jpg'),
    ]);

    const combined = [nighthawks, ...googleArtPages, ...categorySearchPages].filter(Boolean);
    const seenTitles = new Set();
    const artworks = [];

    const PRIORITY = [
        'A Sunday on La Grande Jatte',
        'The Bedroom',
        'American Gothic',
        'Nighthawks',
        'Paris Street; Rainy Day',
        'Self-Portrait',
        'Two Sisters (On the Terrace)',
        'Cliff Walk at Pourville',
        'Arrival of the Normandy Train',
        'The Millinery Shop',
        'Ballet at the Paris Opéra',
        'At the Moulin Rouge',
        'The Waterfall',
        'The Herring Net',
        'Old Man with a Gold Chain',
        'The Bay of Marseilles',
        'The Fountain, Villa Torlonia',
        'Venetian Glass Workers',
        'The Ancestors of Tehamana',
        'Arlésiennes',
        'Boy on a Ram',
        'Saint George Killing the Dragon',
        'The Assumption of the Virgin',
        'Jacques and Berthe Lipchitz',
    ];

    for (const page of combined) {
        if (/-x\d+-y\d+/i.test(page.title || '')) continue;
        const info = page.imageinfo?.[0];
        if (!info || !info.url) continue;
        const width = Number(info.width) || 0;
        const height = Number(info.height) || 0;
        if (width < 400 || height < 400) continue;

        const meta = info.extmetadata || {};
        const title = cleanTitle(meta.ObjectName?.value, page.title);
        const artist = cleanArtist(meta.Artist?.value, page.title);

        const key = `${title}::${artist}`.toLowerCase();
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);

        const thumbUrl = info.thumburl || info.url;
        const fullResUrl = (width > 8000 || (info.size && info.size > 25000000))
            ? thumbUrl.replace(/\/960px-[^/]+$/, `/4000px-${path.basename(info.url)}`).replace(/\/800px-[^/]+$/, `/4000px-${path.basename(info.url)}`)
            : info.url;

        artworks.push({
            id: `aic-${page.pageid}`,
            title,
            artist,
            image: thumbUrl,
            fullRes: fullResUrl,
            imageWidth: width,
            imageHeight: height,
            artworkType: 'Painting',
            rights: 'Public domain / Art Institute of Chicago',
            sourceUrl: meta.Credit?.value?.match(/https?:\/\/[^\s"<>]+/)?.[0] || info.descriptionurl || 'https://www.artic.edu/collection',
            description: cleanString(meta.ImageDescription?.value) || null,
        });
    }

    artworks.sort((a, b) => {
        const idxA = PRIORITY.findIndex(p => a.title.toLowerCase().includes(p.toLowerCase()));
        const idxB = PRIORITY.findIndex(p => b.title.toLowerCase().includes(p.toLowerCase()));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    });

    console.log(`Prepared ${artworks.length} AIC artworks.`);
    const dir = path.join(ROOT, 'public/museum-data/art-institute-of-chicago');
    await fs.mkdir(dir, { recursive: true });

    for (let p = 1; p <= 3; p++) {
        const slice = artworks.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
        const payload = {
            artworks: slice,
            total: 1965,
        };
        await fs.writeFile(path.join(dir, `${p}.json`), JSON.stringify(payload, null, 2), 'utf-8');
        console.log(`Saved AIC page ${p} (${slice.length} artworks)`);
    }
}

async function generateParis() {
    console.log('Fetching Paris Musées masterpieces from Commons...');
    const featuredFiles = [
        'Gustave Courbet - Le Sommeil (1866), Paris, Petit Palais.jpg',
        'Le Baiser, PPS1061.jpg',
        'Héro et Léandre, PPG5383.jpg',
        'Nymphe et faune, dit le Baiser, PPS334.jpg',
        'Couple enlacé couché dans un paysage, PPD3607.jpg',
        'Le Baiser, PPS1061(2).jpg',
        'Héro et Léandre, PPG5384.jpg',
        'La Treille, PPS1064(2).jpg',
        'La Musique, PPS1069(5).jpg',
        'Les amants dans la campagne. Sentiments du jeune âge, PPP733(1).jpg',
        'Le baiser, ODUT1624.jpg',
    ];
    const featuredPages = (await Promise.all(featuredFiles.map(fetchSpecificFile))).filter(Boolean);

    const [set1, set2, set3] = await Promise.all([
        fetchCommonsSearch('incategory:Images_from_Paris_Musées (peinture OR tableau OR dessin OR estampe OR gravure OR aquarelle OR pastel OR gouache OR lithographie)', 100),
        fetchCommonsSearch('incategory:Images_from_Paris_Musées (portrait OR huile OR "arts graphiques")', 100),
        fetchCommonsSearch('incategory:Images_from_Paris_Musées (Petit Palais OR Carnavalet)', 100),
    ]);

    const combined = [...featuredPages, ...set1, ...set2, ...set3];
    const seenTitles = new Set();
    const artworks = [];

    const PRIORITY_TERMS = [
        'Le Sommeil',
        'Le Baiser',
        'Héro et Léandre',
        'Couple enlacé',
        'Nymphe et faune',
        'La Treille',
        'La Musique',
        'Les amants dans la campagne',
        'Desbois',
        'Pierre Roche',
        'Roussel',
        'Courbet',
        'Théophile Gautier',
        'Delacroix',
        'Cezanne',
        'Corot',
        'Pissarro',
        'Degas',
        'Redon',
        'Jeanne Samary',
        'Victor Hugo',
        'Marie de Flavigny',
    ];

    for (const page of combined) {
        if (/-x\d+-y\d+/i.test(page.title || '')) continue;
        if (/invitation|exposition universelle|façade|porte sur|vestibule|construction du petit palais|vue intérieure|jeton|monnaie|fouilles|défilé du 14 juillet/i.test(page.title || '')) continue;
        const info = page.imageinfo?.[0];
        if (!info || !info.url) continue;
        const width = Number(info.width) || 0;
        const height = Number(info.height) || 0;
        if (width < 400 || height < 400) continue;

        const meta = info.extmetadata || {};
        const title = cleanTitle(meta.ObjectName?.value, page.title);
        const artist = cleanArtist(meta.Artist?.value, page.title);

        if (/invitation|exposition universelle|façade|porte sur|vestibule|construction du petit palais|vue intérieure|jeton|monnaie|fouilles|défilé du 14 juillet/i.test(title)) continue;

        const key = `${title}::${artist}`.toLowerCase();
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);

        const thumbUrl = info.thumburl || info.url;
        const fullResUrl = (width > 8000 || (info.size && info.size > 25000000))
            ? thumbUrl.replace(/\/960px-[^/]+$/, `/4000px-${path.basename(info.url)}`).replace(/\/800px-[^/]+$/, `/4000px-${path.basename(info.url)}`)
            : info.url;

        artworks.push({
            id: `pm-${page.pageid}`,
            title,
            artist,
            image: thumbUrl,
            fullRes: fullResUrl,
            imageWidth: width,
            imageHeight: height,
            objectType: 'Peinture',
            rights: 'CC0 / Paris Musées Open Content',
            sourceUrl: meta.Credit?.value?.match(/https?:\/\/[^\s"<>]+/)?.[0] || info.descriptionurl || 'https://www.parismuseescollections.paris.fr/',
            description: cleanString(meta.ImageDescription?.value) || null,
        });
    }

    artworks.sort((a, b) => {
        const idxA = PRIORITY_TERMS.findIndex(p => (a.artist + ' ' + a.title).toLowerCase().includes(p.toLowerCase()));
        const idxB = PRIORITY_TERMS.findIndex(p => (b.artist + ' ' + b.title).toLowerCase().includes(p.toLowerCase()));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    });

    console.log(`Prepared ${artworks.length} Paris Musées artworks.`);
    const dir = path.join(ROOT, 'public/museum-data/paris-musees');
    await fs.mkdir(dir, { recursive: true });

    for (let p = 1; p <= 3; p++) {
        const slice = artworks.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
        const payload = {
            artworks: slice,
            total: 185548,
        };
        await fs.writeFile(path.join(dir, `${p}.json`), JSON.stringify(payload, null, 2), 'utf-8');
        console.log(`Saved Paris Musées page ${p} (${slice.length} artworks)`);
    }
}

async function main() {
    await generateParis();
    console.log('All museum snapshots generated successfully!');
}

main().catch(err => {
    console.error('Snapshot generation failed:', err);
    process.exit(1);
});
