// Shared by Vite and Firebase. Credentials never enter the client bundle.
try {
    globalThis.process?.getBuiltinModule?.('dns')?.setDefaultResultOrder?.('ipv4first');
} catch {
    // DNS ordering is an optional Node runtime optimization.
}

const PAGE_SIZE = 24;
// MediaWiki CirrusSearch supports up to 10,000 search results (416 pages of 24)
const MAX_COMMONS_OFFSET = 9960;
const MAX_COMMONS_TOTAL = 9984;

const cache = new Map();

// 2D fine art mediums: paintings, drawings, prints, portraits, illustrations
const ART_TYPES = /\b(painting|drawing|print|engraving|etching|lithograph|illustration|watercolou?r|portrait|portrait miniature|peinture|tableau|dessin|estampe|gravure|aquarelle|pastel|gouache|lithographie|eau-forte|arts graphiques|affiche|huile)\b/i;
const PAINTING_MEDIA = /\b(oil|tempera|acrylic|gouache|watercolou?r|ink|charcoal|pastel|graphite|pencil)\b/i;

// 75 DPI native print floor backed by 4x Replicate Real-ESRGAN super-resolution to 300 DPI
const MIN_PRINT_DPI = 75;
function isPrintableDpi(w, h) {
    if (!w || !h) return true;
    return Math.min(w, h) >= 5 * MIN_PRINT_DPI && Math.max(w, h) >= 7 * MIN_PRINT_DPI;
}

async function json(url, options = {}) {
    const signal = options.signal || AbortSignal.timeout(10000);
    const response = await fetch(url, { ...options, signal });
    if (!response.ok) {
        const error = new Error(response.status === 429
            ? 'The museum is receiving too many requests. Please try again shortly.'
            : `The museum service returned HTTP ${response.status}.`);
        error.status = response.status === 429 ? 429 : 502;
        throw error;
    }
    return response.json();
}

function smithsonianRecord(record) {
    const content = record.content || {};
    const info = content.descriptiveNonRepeating || {};
    const objectType = (content.freetext?.objectType || []).map(item => item.content).join(' ');
    if (objectType && !ART_TYPES.test(objectType)) return null;
    const media = info.online_media?.media?.find(item =>
        item.type === 'Images' && (item.usage?.access === 'CC0' || !item.usage?.access) && item.content);
    if (!media) return null;
    const resources = media.resources || [];
    const hiResJpeg = resources.find(r => /jpeg/i.test(r.label || '') && r.url);
    const dimResource = hiResJpeg || resources.find(r => Number(r.width) > 0 && Number(r.height) > 0);
    const width = Number(dimResource?.width) || null;
    const height = Number(dimResource?.height) || null;
    if (width && height && !isPrintableDpi(width, height)) return null;
    return {
        id: record.id,
        title: record.title || info.title?.content || 'Smithsonian Artifact',
        artist: (content.freetext?.name || []).filter(item => /artist|creator|author|maker/i.test(item.label))
            .map(item => item.content).join(', ') || 'Smithsonian Institution',
        image: media.thumbnail || media.content,
        fullRes: hiResJpeg?.url || media.content,
        imageWidth: width,
        imageHeight: height,
        rights: 'CC0 / Smithsonian Open Access',
        sourceUrl: info.record_link || `https://www.si.edu/object/${record.id}`,
        metadata: content,
    };
}

async function smithsonian(page) {
    return smithsonianCommonsFallback(page);
}

async function smithsonianCommonsFallback(page) {
    const offset = Math.min((page - 1) * PAGE_SIZE, MAX_COMMONS_OFFSET);
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:"Images from the Smithsonian Institution" (painting OR artwork OR drawing OR print OR engraving OR etching OR lithograph OR watercolor OR portrait OR oil OR illustration)',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        gsrsort: 'create_timestamp_desc',
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
        if (!isPrintableDpi(Number(info.width), Number(info.height))) return null;
        const meta = info.extmetadata || {};
        const rawTitle = meta.ObjectName?.value || item.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').trim();
        const title = rawTitle.replace(/<[^>]*>?/gm, '').trim();
        let artist = meta.Artist?.value?.split(/<br\s*\/?>/i)[0] || '';
        artist = artist.replace(/<[^>]*>?/gm, '').trim() || 'Smithsonian Artist';
        return {
            id: String(item.pageid || item.title),
            title: title || 'Smithsonian Artwork',
            artist,
            image: info.thumburl || info.url,
            fullRes: (Number(info.width) > 8000 && info.thumburl) ? info.thumburl.replace(/\/\d+px-[^/]+$/, `/4000px-${item.title.replace(/^File:/, '')}`) : info.url,
            imageWidth: info.width,
            imageHeight: info.height,
            artworkType: 'Artwork',
            sourceUrl: meta.Credit?.value?.match(/https?:\/\/[^\s"<>]+/)?.[0] || info.descriptionurl || 'https://www.si.edu/openaccess',
            rights: 'CC0 / Smithsonian Open Access',
        };
    }).filter(Boolean);
    return { artworks, total: MAX_COMMONS_TOTAL };
}

const PARIS_DEFAULT_TOKEN = '9a695903-3959-4413-8a65-7427ac729efe';

function parisQuery(page) {
    return `{ nodeQuery(limit: ${PAGE_SIZE}, offset: ${(page - 1) * PAGE_SIZE}, filter: {conditions: [{field: "type", value: "oeuvre"}, {field: "field_visuels.entity.field_image_libre", value: "1"}]}) {
        entities { entityUuid ... on NodeOeuvre {
            title absolutePath fieldLrefAdlib fieldCartelAuteur
            fieldVisuels { entity { ... on MediaImage { vignette publicUrl fieldLegende fieldCopyright } } }
        } }
    } }`;
}

async function paris(page) {
    return parisCommonsFallback(page);
}

async function parisCommonsFallback(page) {
    const offset = Math.min((page - 1) * PAGE_SIZE, MAX_COMMONS_OFFSET);
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:"Images from Paris Musées" (painting OR artwork OR drawing OR print OR engraving OR etching OR lithograph OR watercolor OR portrait OR oil OR illustration OR peinture OR tableau OR dessin OR estampe OR gravure OR aquarelle OR pastel OR gouache)',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        gsrsort: 'create_timestamp_desc',
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
        if (!isPrintableDpi(Number(info.width), Number(info.height))) return null;
        const meta = info.extmetadata || {};
        const rawTitle = meta.ObjectName?.value || item.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').trim();
        const title = rawTitle.replace(/<[^>]*>?/gm, '').replace(/^(English|French|Français)\s*:\s*/i, '').trim();
        let artist = meta.Artist?.value?.split(/<br\s*\/?>/i)[0] || '';
        artist = artist.replace(/<[^>]*>?/gm, '').trim();
        if (!artist || artist.toLowerCase() === 'unknown artist') {
            const m = item.title.replace(/^File:/, '').match(/^([^-]+)\s*-\s*/);
            artist = m ? m[1].trim() : 'Paris Musées Artist';
        }
        return {
            id: String(item.pageid || item.title),
            title: title || 'Paris Musées Artwork',
            artist,
            image: info.thumburl || info.url,
            fullRes: (Number(info.width) > 8000 && info.thumburl) ? info.thumburl.replace(/\/\d+px-[^/]+$/, `/4000px-${item.title.replace(/^File:/, '')}`) : info.url,
            imageWidth: info.width,
            imageHeight: info.height,
            sourceUrl: meta.Credit?.value?.match(/https?:\/\/[^\s"<>]+/)?.[0] || info.descriptionurl || 'https://www.parismuseescollections.paris.fr/',
            rights: 'CC0 / Paris Musées Open Content',
        };
    }).filter(Boolean);
    return { artworks, total: MAX_COMMONS_TOTAL };
}

async function artInstituteOfChicago(page) {
    const offset = Math.min((page - 1) * PAGE_SIZE, MAX_COMMONS_OFFSET);
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:"Google_Art_Project_works_in_The_Art_Institute_of_Chicago|Paintings_in_the_Art_Institute_of_Chicago|Drawings_in_the_Art_Institute_of_Chicago|Prints_in_the_Art_Institute_of_Chicago"',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        gsrsort: 'create_timestamp_desc',
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
        if (!isPrintableDpi(Number(info.width), Number(info.height))) return null;
        const meta = info.extmetadata || {};
        let rawTitle = meta.ObjectName?.value || '';
        rawTitle = rawTitle.split(/\btitle QS:/i)[0].replace(/<[^>]*>?/gm, '').trim();
        const fallbackTitle = item.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/ - Google Art Project.*$/i, '').trim();
        let title = rawTitle;
        if (!title || title.includes('undefined') || /(German|French|Italian|Spanish|Dutch):/i.test(title) || title.length < 2) {
            title = fallbackTitle;
        }
        title = title.replace(/^(English|French|Français)\s*:\s*/i, '').replace(/\s*\(cropped\)$/i, '').trim();
        let artist = meta.Artist?.value?.split(/<br\s*\/?>/i)[0] || '';
        artist = artist.replace(/<[^>]*>?/gm, '').trim();
        if (!artist || artist.toLowerCase() === 'unknown artist') {
            const m = item.title.replace(/^File:/, '').match(/^([^-]+)\s*-\s*/);
            artist = m ? m[1].trim() : 'Art Institute of Chicago';
        }
        return {
            id: String(item.pageid || item.title),
            title: title || 'Art Institute Artwork',
            artist,
            image: info.thumburl || info.url,
            fullRes: (Number(info.width) > 8000 && info.thumburl) ? info.thumburl.replace(/\/\d+px-[^/]+$/, `/4000px-${item.title.replace(/^File:/, '')}`) : info.url,
            imageWidth: info.width,
            imageHeight: info.height,
            artworkType: 'Artwork',
            sourceUrl: meta.Credit?.value?.match(/https?:\/\/[^\s"<>]+/)?.[0] || info.descriptionurl || 'https://www.artic.edu/collection',
            rights: 'Public domain / Art Institute of Chicago',
        };
    }).filter(Boolean);
    return { artworks, total: MAX_COMMONS_TOTAL };
}

async function clevelandMuseumOfArt(page) {
    const fetchType = (type) => {
        const limit = Math.floor(PAGE_SIZE / 3); // 8 of each type = 24 items per page
        const params = new URLSearchParams({
            cc0: '',
            has_image: '1',
            type,
            limit: String(limit),
            skip: String((page - 1) * limit),
        });
        return json(`https://openaccess-api.clevelandart.org/api/artworks?${params}`, {
            headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' },
            signal: AbortSignal.timeout(6000),
        });
    };
    const [paintings, drawings, prints] = await Promise.all([
        fetchType('Painting').catch(() => ({ data: [], info: { total: 3907 } })),
        fetchType('Drawing').catch(() => ({ data: [], info: { total: 2000 } })),
        fetchType('Print').catch(() => ({ data: [], info: { total: 10918 } })),
    ]);
    const total = (paintings.info?.total || 3907) + (drawings.info?.total || 2000) + (prints.info?.total || 10918);
    const combined = [...(paintings.data || []), ...(drawings.data || []), ...(prints.data || [])];
    const artworks = combined.filter(item => {
        if (!item.images?.web?.url) return false;
        const printImg = item.images.print || {};
        const webImg = item.images.web || {};
        const w = Number(printImg.width || webImg.width) || null;
        const h = Number(printImg.height || webImg.height) || null;
        return isPrintableDpi(w, h);
    }).map(item => {
        const printImg = item.images.print || {};
        const webImg = item.images.web || {};
        return {
            id: String(item.id),
            title: item.title || 'Cleveland Museum of Art Piece',
            artist: item.creators?.map(creator => creator.description).filter(Boolean).join(', ') || 'Cleveland Master',
            image: webImg.url,
            fullRes: printImg.url || item.images.original?.url || webImg.url,
            imageWidth: Number(printImg.width || webImg.width) || null,
            imageHeight: Number(printImg.height || webImg.height) || null,
            artworkType: item.type || 'Artwork',
            sourceUrl: item.url || `https://www.clevelandart.org/art/${item.id}`,
            rights: 'CC0 / Cleveland Museum of Art',
        };
    });
    return { artworks, total };
}

async function rijksmuseum(page) {
    const maxOffset = Math.floor(3295 / PAGE_SIZE) * PAGE_SIZE;
    const offset = Math.min((page - 1) * PAGE_SIZE, maxOffset);
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:"Paintings in the Rijksmuseum Amsterdam|Drawings in the Rijksmuseum Amsterdam|Prints in the Rijksmuseum Amsterdam"',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        gsrsort: 'create_timestamp_desc',
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
        if (!isPrintableDpi(Number(info.width), Number(info.height))) return null;
        const meta = info.extmetadata || {};
        const rawTitle = meta.ObjectName?.value || item.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/Rijksmuseum\s*[A-Z0-9-]+/gi, '').trim();
        const title = rawTitle.replace(/<[^>]*>?/gm, '').trim();
        let artist = meta.Artist?.value?.split(/<br\s*\/?>/i)[0] || '';
        artist = artist.replace(/<[^>]*>?/gm, '').trim() || 'Rijksmuseum Master';
        return {
            id: String(item.pageid || item.title),
            title: title || 'Rijksmuseum Artwork',
            artist,
            image: info.thumburl || info.url,
            fullRes: (Number(info.width) > 8000 && info.thumburl) ? info.thumburl.replace(/\/\d+px-[^/]+$/, `/4000px-${item.title.replace(/^File:/, '')}`) : info.url,
            imageWidth: info.width,
            imageHeight: info.height,
            artworkType: 'Artwork',
            sourceUrl: meta.Credit?.value?.match(/https?:\/\/[^\s"<>]+/)?.[0] || info.descriptionurl || 'https://www.rijksmuseum.nl/en/collection',
            rights: 'Public Domain / CC0',
        };
    }).filter(Boolean);
    return { artworks, total: 3295 };
}

async function biodiversityHeritageLibrary(page) {
    const offset = Math.min((page - 1) * PAGE_SIZE, MAX_COMMONS_OFFSET);
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:Files_from_the_Biodiversity_Heritage_Library filetype:bitmap',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        gsrsort: 'create_timestamp_desc',
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' },
    });
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
        if (!isPrintableDpi(Number(info.width), Number(info.height))) return null;
        const meta = info.extmetadata || {};
        const rawTitle = meta.ObjectName?.value || item.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/\bBHL\d+\b/gi, '').trim();
        const title = rawTitle.replace(/<[^>]*>?/gm, '').trim() || 'Biodiversity Heritage Library Plate';
        const artist = meta.Artist?.value?.replace(/<[^>]*>?/gm, '').trim() || 'Biodiversity Heritage Library';
        return {
            id: String(item.pageid || item.title),
            title,
            artist,
            image: info.thumburl || info.url,
            fullRes: info.url,
            imageWidth: info.width,
            imageHeight: info.height,
            sourceUrl: info.descriptionurl || 'https://www.biodiversitylibrary.org/',
            rights: 'Public Domain / Biodiversity Heritage Library',
        };
    }).filter(Boolean);
    return { artworks, total: MAX_COMMONS_TOTAL };
}

async function nasaOpenMedia(page) {
    const clampedPage = Math.max(1, Math.min(page, 20));
    const params = new URLSearchParams({ q: 'space photography', media_type: 'image', page_size: String(PAGE_SIZE), page: String(clampedPage) });
    const data = await json(`https://images-api.nasa.gov/search?${params}`);
    const artworks = (data.collection?.items || []).map(item => {
        const metadata = item.data?.[0] || {};
        const links = item.links || [];
        const preview = links.find(link => link.rel === 'preview')?.href || links.find(link => link.render === 'image')?.href;
        const fullRes = links.find(link => link.rel === 'canonical')?.href || links.find(link => link.render === 'image' && link.width > 800)?.href || preview;
        const width = links.find(link => link.href === fullRes)?.width;
        const height = links.find(link => link.href === fullRes)?.height;
        if (!isPrintableDpi(width, height)) return null;
        return preview ? {
            id: metadata.nasa_id || item.href,
            title: metadata.title || 'NASA image',
            artist: metadata.secondary_creator || metadata.center || 'NASA',
            image: preview,
            fullRes,
            imageWidth: width,
            imageHeight: height,
            description: metadata.description,
            date: metadata.date_created,
            sourceUrl: `https://images.nasa.gov/details/${metadata.nasa_id}`,
            rights: 'NASA media; verify item-level usage guidance',
        } : null;
    }).filter(Boolean);
    return { artworks, total: data.collection?.metadata?.total_hits || 468 };
}

async function libraryOfCongress(page) {
    const maxOffset = Math.floor(5000 / PAGE_SIZE) * PAGE_SIZE;
    const offset = Math.min((page - 1) * PAGE_SIZE, maxOffset);
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:Images_from_the_Library_of_Congress',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        gsrsort: 'create_timestamp_desc',
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
        if (!isPrintableDpi(Number(info.width), Number(info.height))) return null;
        const meta = info.extmetadata || {};
        const rawTitle = meta.ObjectName?.value || item.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/LOC\s*\d+/i, '').trim();
        const title = rawTitle.replace(/<[^>]*>?/gm, '').trim();
        const artist = meta.Artist?.value?.replace(/<[^>]*>?/gm, '').trim() || 'Library of Congress';
        return {
            id: String(item.pageid || item.title),
            title: title || 'Library of Congress Collection',
            artist,
            image: info.thumburl || info.url,
            fullRes: info.url,
            imageWidth: info.width,
            imageHeight: info.height,
            sourceUrl: info.descriptionurl || 'https://www.loc.gov/',
            rights: 'Public Domain / Library of Congress',
        };
    }).filter(Boolean);
    return { artworks, total: 5000 };
}

async function museumFeed(source, page, env = process.env) {
    if (!Number.isInteger(page) || page < 1 || page > 50000) {
        const error = new Error('Invalid collection page.'); error.status = 400; throw error;
    }
    const key = `${source}:${page}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    let value;
    if (source === 'smithsonian-open-access') value = await smithsonian(page, env.SMITHSONIAN_API_KEY);
    else if (source === 'paris-musees') value = await paris(page, env.PARIS_MUSEES_API_TOKEN);
    else if (source === 'art-institute-of-chicago') value = await artInstituteOfChicago(page);
    else if (source === 'cleveland-museum-of-art') value = await clevelandMuseumOfArt(page);
    else if (source === 'rijksmuseum') value = await rijksmuseum(page);
    else if (source === 'biodiversity-heritage-library') value = await biodiversityHeritageLibrary(page);
    else if (source === 'nasa-open-media') value = await nasaOpenMedia(page);
    else if (source === 'library-of-congress') value = await libraryOfCongress(page);
    else { const error = new Error('Unknown collection.'); error.status = 400; throw error; }
    if (cache.size >= 2000) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + 30 * 60 * 1000 });
    return value;
}

async function archivalFeed(source, page) {
    if (!Number.isInteger(page) || page < 1 || page > 50000) {
        const error = new Error('Invalid collection page.'); error.status = 400; throw error;
    }
    const key = `archival:${source}:${page}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    let value;
    if (source === 'biodiversity-heritage-library') value = await biodiversityHeritageLibrary(page);
    else if (source === 'nasa-open-media') value = await nasaOpenMedia(page);
    else if (source === 'library-of-congress') value = await libraryOfCongress(page);
    else { const error = new Error('Unknown archival collection.'); error.status = 400; throw error; }
    if (cache.size >= 2000) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + 30 * 60 * 1000 });
    return value;
}

module.exports = { museumFeed, archivalFeed, smithsonianRecord, parisQuery };
