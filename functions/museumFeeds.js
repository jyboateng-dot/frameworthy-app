// Shared by Vite and Firebase. Credentials never enter the client bundle.
try {
    globalThis.process?.getBuiltinModule?.('dns')?.setDefaultResultOrder?.('ipv4first');
} catch {}

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
    // Metadata CC0 does not grant rights to the image. Check media usage.
    const media = info.online_media?.media?.find(item =>
        item.type === 'Images' && item.usage?.access === 'CC0' && item.content);
    if (!media) return null;
    return {
        id: record.id, title: record.title || info.title?.content,
        artist: (content.freetext?.name || []).filter(item => /artist|creator|author/i.test(item.label))
            .map(item => item.content).join(', ') || 'Unknown artist',
        image: media.thumbnail || media.content, fullRes: media.content,
        rights: 'CC0', sourceUrl: info.record_link,
        metadata: content,
    };
}

async function smithsonian(page, key) {
    const apiKey = key || process.env.SMITHSONIAN_API_KEY || 'DEMO_KEY';
    const params = new URLSearchParams({
        q: 'online_media_type:Images AND (unit_code:SAAM OR unit_code:NPG OR unit_code:FSG)',
        start: String((page - 1) * PAGE_SIZE), rows: String(PAGE_SIZE), api_key: apiKey,
    });
    const data = await json(`https://api.si.edu/openaccess/api/v1.0/search?${params}`);
    if (data.status !== 200 || !data.response) throw new Error('Smithsonian returned an invalid response.');
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
    return { artworks, total: data.response.rowCount || 0 };
}

function parisQuery(page) {
    return `{ nodeQuery(limit: ${PAGE_SIZE}, offset: ${(page - 1) * PAGE_SIZE}, filter: {conditions: [{field: "type", value: "oeuvre"}, {field: "field_visuels", operator: IS_NOT_NULL}]}) {
        count entities { entityUuid ... on NodeOeuvre {
            title absolutePath fieldLrefAdlib
            fieldVisuels { entity { vignette fieldLegende fieldCopyright } }
        } }
    } }`;
}

async function paris(page, token) {
    if (!token) {
        const error = new Error('The Paris Musées collection is awaiting connection credentials.');
        error.status = 503;
        throw error;
    }
    const data = await json('https://apicollections.parismusees.paris.fr/graphql', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'auth-token': token },
        body: JSON.stringify({ query: parisQuery(page) }),
    });
    if (data.errors?.length || !data.data?.nodeQuery) {
        throw new Error(data.errors?.[0]?.message || 'Paris Musées could not provide the collection.');
    }
    const entities = data.data.nodeQuery.entities || [];
    const artworks = entities.map(item => {
        const visual = item.fieldVisuels?.[0]?.entity || {};
        const vignette = visual.vignette;
        if (!vignette) return null;
        const image = /^https?:\/\//i.test(vignette) ? vignette : `https://parismuseescollections.paris.fr${vignette}`;
        return {
            id: String(item.entityUuid || item.entityId),
            title: item.title || 'Paris Musées Artwork',
            artist: 'Paris Musées',
            image,
            fullRes: image,
            sourceUrl: item.absolutePath || `https://www.parismuseescollections.paris.fr/fr/node/${item.entityId}`,
            rights: visual.fieldCopyright || 'Paris Musées API record; verify item-level rights',
            description: visual.fieldLegende,
            metadata: { lrefAdlib: item.fieldLrefAdlib, copyright: visual.fieldCopyright },
        };
    }).filter(Boolean);
    return { artworks, total: data.data.nodeQuery.count || artworks.length };
}

async function biodiversityHeritageLibrary(page) {
    // BHL maintains a public Flickr Commons photostream. The feed is useful
    // for discovery without exposing a BHL/Flickr key; item-level rights are
    // retained and must still be checked before a work is sold as a print.
    const params = new URLSearchParams({
        tags: 'biodiversityheritagelibrary', tagmode: 'all', format: 'json', nojsoncallback: '1',
    });
    const data = await json(`https://www.flickr.com/services/feeds/photos_public.gne?${params}`);
    const items = (data.items || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return {
        artworks: items.map(item => {
            const preview = item.media?.m;
            if (!preview) return null;
            const fullRes = preview.replace('_m.', '_b.');
            return {
                id: item.link || item.title,
                title: item.title || 'Biodiversity illustration',
                artist: item.author || 'Biodiversity Heritage Library',
                image: preview,
                fullRes,
                sourceUrl: item.link,
                rights: 'Flickr Commons / verify item-level rights',
            };
        }).filter(Boolean),
        total: data.items?.length || 0,
    };
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
