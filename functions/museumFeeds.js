// Shared by Vite and Firebase. Credentials never enter the client bundle.
try {
    globalThis.process?.getBuiltinModule?.('dns')?.setDefaultResultOrder?.('ipv4first');
} catch {
    // DNS ordering is an optional Node runtime optimization.
}

const PAGE_SIZE = 24;
const cache = new Map();

async function json(url, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
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
    const media = info.online_media?.media?.find(item =>
        item.type === 'Images' && (item.usage?.access === 'CC0' || !item.usage?.access) && item.content);
    if (!media) return null;
    const resources = media.resources || [];
    const hiResJpeg = resources.find(r => /jpeg/i.test(r.label || '') && r.url);
    const dimResource = hiResJpeg || resources.find(r => Number(r.width) > 0 && Number(r.height) > 0);
    return {
        id: record.id,
        title: record.title || info.title?.content || 'Smithsonian Artifact',
        artist: (content.freetext?.name || []).filter(item => /artist|creator|author|maker/i.test(item.label))
            .map(item => item.content).join(', ') || 'Smithsonian Institution',
        image: media.thumbnail || media.content,
        fullRes: hiResJpeg?.url || media.content,
        imageWidth: Number(dimResource?.width) || null,
        imageHeight: Number(dimResource?.height) || null,
        rights: 'CC0 / Smithsonian Open Access',
        sourceUrl: info.record_link || `https://www.si.edu/object/${record.id}`,
        metadata: content,
    };
}

async function smithsonian(page, key) {
    const apiKey = key || process.env.SMITHSONIAN_API_KEY;
    if (apiKey && apiKey !== 'DEMO_KEY') {
        try {
            const params = new URLSearchParams({
                q: 'online_media_type:Images',
                start: String((page - 1) * PAGE_SIZE),
                rows: String(PAGE_SIZE),
                api_key: apiKey,
            });
            const data = await json(`https://api.si.edu/openaccess/api/v1.0/search?${params}`);
            if (data.status === 200 && data.response?.rows) {
                const artworks = [];
                const rows = data.response.rows || [];
                for (let offset = 0; offset < rows.length; offset += 3) {
                    const batch = await Promise.all(rows.slice(offset, offset + 3).map(async row => {
                        const existing = smithsonianRecord(row);
                        if (existing) return existing;
                        try {
                            const detail = await json(`https://api.si.edu/openaccess/api/v1.0/content/${encodeURIComponent(row.url)}?api_key=${encodeURIComponent(apiKey)}`);
                            return smithsonianRecord(detail.response || {});
                        } catch {
                            return null;
                        }
                    }));
                    artworks.push(...batch.filter(Boolean));
                }
                if (artworks.length > 0) {
                    return { artworks, total: data.response.rowCount || 7500000 };
                }
            }
        } catch {
            // Fall back to high-res Smithsonian CC0 mirror on Wikimedia Commons
        }
    }
    return smithsonianCommonsFallback(page);
}

async function smithsonianCommonsFallback(page) {
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:"Images from the Smithsonian Institution"',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {});
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
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
    return { artworks, total: 16283 };
}

const PARIS_DEFAULT_TOKEN = '9a695903-3959-4413-8a65-7427ac729efe';
const PARIS_ESTIMATED_TOTAL = 326567;

function parisQuery(page) {
    return `{ nodeQuery(limit: ${PAGE_SIZE}, offset: ${(page - 1) * PAGE_SIZE}, filter: {conditions: [{field: "type", value: "oeuvre"}, {field: "field_visuels.entity.field_image_libre", value: "1"}]}) {
        entities { entityUuid ... on NodeOeuvre {
            title absolutePath fieldLrefAdlib fieldCartelAuteur
            fieldVisuels { entity { ... on MediaImage { vignette publicUrl fieldLegende fieldCopyright } } }
        } }
    } }`;
}

async function paris(page, token) {
    const apiToken = token || process.env.PARIS_MUSEES_API_TOKEN || PARIS_DEFAULT_TOKEN;
    try {
        if (!apiToken) {
            const error = new Error('The Paris Musées collection is awaiting connection credentials.');
            error.status = 503;
            throw error;
        }
        const data = await json('https://apicollections.parismusees.paris.fr/graphql', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'auth-token': apiToken },
            body: JSON.stringify({ query: parisQuery(page) }),
            signal: AbortSignal.timeout(3500),
        });
        if (data.errors?.length || !data.data?.nodeQuery) {
            throw new Error(data.errors?.[0]?.message || 'Paris Musées could not provide the collection.');
        }
        const entities = data.data.nodeQuery.entities || [];
        const artworks = entities.map(item => {
            if (!item) return null;
            const visual = item.fieldVisuels?.find(v => v?.entity?.publicUrl)?.entity || item.fieldVisuels?.[0]?.entity || {};
            const vignette = visual.vignette;
            if (!vignette && !visual.publicUrl) return null;
            const rawPreview = vignette || visual.publicUrl;
            const image = /^https?:\/\//i.test(rawPreview) ? rawPreview : `https://parismuseescollections.paris.fr${rawPreview}`;
            const fullRes = visual.publicUrl
                ? (/^https?:\/\//i.test(visual.publicUrl) ? visual.publicUrl : `https://www.parismuseescollections.paris.fr${visual.publicUrl}`)
                : image;
            return {
                id: String(item.entityUuid || item.entityId),
                title: item.title || 'Paris Musées Artwork',
                artist: item.fieldCartelAuteur || 'Paris Musées',
                image,
                fullRes,
                sourceUrl: item.absolutePath || `https://www.parismuseescollections.paris.fr/fr/node/${item.entityId}`,
                rights: visual.fieldCopyright || 'CC0 / Paris Musées Open Content',
                description: visual.fieldLegende,
                metadata: { lrefAdlib: item.fieldLrefAdlib, copyright: visual.fieldCopyright },
            };
        }).filter(Boolean);
        if (artworks.length > 0) {
            return { artworks, total: PARIS_ESTIMATED_TOTAL };
        }
    } catch {
        // Fall back to high-resolution Commons CC0 Paris Musées mirror if municipal portal is unreachable/503
    }
    return parisCommonsFallback(page);
}

async function parisCommonsFallback(page) {
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:"Images from Paris Musées"',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {});
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
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
    return { artworks, total: PARIS_ESTIMATED_TOTAL };
}

async function artInstituteOfChicago(page) {
    try {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(PAGE_SIZE),
            fields: 'id,title,artist_display,image_id,thumbnail,dimensions,date_display,is_public_domain',
        });
        params.set('query[term][is_public_domain]', 'true');
        const data = await json(`https://api.artic.edu/api/v1/artworks/search?${params}`);
        if (data.data && data.data.length > 0) {
            const artworks = data.data.filter(item => item.image_id).map(item => {
                const masterWidth = Number(item.thumbnail?.width) || 4000;
                const masterHeight = Number(item.thumbnail?.height) || null;
                return {
                    id: String(item.id),
                    title: item.title || 'Art Institute Artwork',
                    artist: item.artist_display || 'Art Institute of Chicago',
                    image: `https://frameworthyco.com/api/artic-image?id=${encodeURIComponent(item.image_id)}&width=400`,
                    fullRes: `https://frameworthyco.com/api/artic-image?id=${encodeURIComponent(item.image_id)}&width=${masterWidth}`,
                    imageWidth: masterWidth,
                    imageHeight: masterHeight,
                    sourceUrl: `https://www.artic.edu/artworks/${item.id}`,
                    rights: 'Public domain / Art Institute of Chicago',
                };
            });
            if (artworks.length > 0) {
                return { artworks, total: data.pagination?.total || 62119 };
            }
        }
    } catch {
        // Fall back to Commons
    }

    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: '"Art Institute of Chicago"',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {});
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
        const meta = info.extmetadata || {};
        const rawTitle = meta.ObjectName?.value || item.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/ - Google Art Project.*$/i, '').trim();
        const title = rawTitle.replace(/<[^>]*>?/gm, '').replace(/^(English|French|Français)\s*:\s*/i, '').trim();
        let artist = meta.Artist?.value?.split(/<br\s*\/?>/i)[0] || '';
        artist = artist.replace(/<[^>]*>?/gm, '').trim();
        if (!artist || artist.toLowerCase() === 'unknown artist') {
            const m = item.title.replace(/^File:/, '').match(/^([^-]+)\s*-\s*/);
            artist = m ? m[1].trim() : 'Master Artist';
        }
        return {
            id: String(item.pageid || item.title),
            title: title || 'Art Institute Artwork',
            artist,
            image: info.thumburl || info.url,
            fullRes: (Number(info.width) > 8000 && info.thumburl) ? info.thumburl.replace(/\/\d+px-[^/]+$/, `/4000px-${item.title.replace(/^File:/, '')}`) : info.url,
            imageWidth: info.width,
            imageHeight: info.height,
            sourceUrl: meta.Credit?.value?.match(/https?:\/\/[^\s"<>]+/)?.[0] || info.descriptionurl || 'https://www.artic.edu/collection',
            rights: 'Public domain / Art Institute of Chicago',
        };
    }).filter(Boolean);
    return { artworks, total: 12887 };
}

async function clevelandMuseumOfArt(page) {
    const params = new URLSearchParams({
        cc0: '',
        has_image: '1',
        limit: String(PAGE_SIZE),
        skip: String((page - 1) * PAGE_SIZE),
    });
    const data = await json(`https://openaccess-api.clevelandart.org/api/artworks?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const artworks = (data.data || []).filter(item => item.images?.web?.url).map(item => {
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
    return { artworks, total: data.info?.total || 41806 };
}

async function rijksmuseum(page) {
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:"Paintings in the Rijksmuseum Amsterdam|Drawings in the Rijksmuseum Amsterdam|Prints in the Rijksmuseum Amsterdam|Photographs in the Rijksmuseum Amsterdam|Sculptures in the Rijksmuseum Amsterdam|Ceramics in the Rijksmuseum Amsterdam"',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {});
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
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
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:Files_from_the_Biodiversity_Heritage_Library filetype:bitmap',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' },
    });
    const pages = Object.values(data.query?.pages || {});
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
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
    return { artworks, total: 245396 };
}

async function nasaOpenMedia(page) {
    const params = new URLSearchParams({ q: 'space photography', media_type: 'image', page_size: String(PAGE_SIZE), page: String(page) });
    const data = await json(`https://images-api.nasa.gov/search?${params}`);
    const artworks = (data.collection?.items || []).map(item => {
        const metadata = item.data?.[0] || {};
        const links = item.links || [];
        const preview = links.find(link => link.rel === 'preview')?.href || links.find(link => link.render === 'image')?.href;
        const fullRes = links.find(link => link.rel === 'canonical')?.href || links.find(link => link.render === 'image' && link.width > 800)?.href || preview;
        return preview ? {
            id: metadata.nasa_id || item.href,
            title: metadata.title || 'NASA image',
            artist: metadata.secondary_creator || metadata.center || 'NASA',
            image: preview,
            fullRes,
            imageWidth: links.find(link => link.href === fullRes)?.width,
            imageHeight: links.find(link => link.href === fullRes)?.height,
            description: metadata.description,
            date: metadata.date_created,
            sourceUrl: `https://images.nasa.gov/details/${metadata.nasa_id}`,
            rights: 'NASA media; verify item-level usage guidance',
        } : null;
    }).filter(Boolean);
    return { artworks, total: data.collection?.metadata?.total_hits || artworks.length };
}

async function libraryOfCongress(page) {
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: 'incategory:Images_from_the_Library_of_Congress',
        gsrnamespace: '6',
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String(offset),
        prop: 'imageinfo',
        iiprop: 'url|dimensions|extmetadata',
        iiurlwidth: '800',
        format: 'json',
    });
    const data = await json(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'FrameWorthyApp/1.0 (contact@frameworthy.art)' }
    });
    const pages = Object.values(data.query?.pages || {});
    const artworks = pages.map(item => {
        const info = item.imageinfo?.[0];
        if (!info || !info.url) return null;
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
    if (!Number.isInteger(page) || page < 1 || page > 10000) {
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
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + 15 * 60 * 1000 });
    return value;
}

async function archivalFeed(source, page) {
    if (!Number.isInteger(page) || page < 1 || page > 10000) {
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
    cache.set(key, { value, expires: Date.now() + 15 * 60 * 1000 });
    return value;
}

module.exports = { museumFeed, archivalFeed, smithsonianRecord, parisQuery };
