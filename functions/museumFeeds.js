// Shared by Vite and Firebase. Credentials never enter the client bundle.
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
    if (!key) {
        const error = new Error('The Smithsonian collection is awaiting connection credentials.');
        error.status = 503;
        throw error;
    }
    const params = new URLSearchParams({
        q: 'online_media_type:Images AND (unit_code:SAAM OR unit_code:NPG OR unit_code:FSG)',
        start: String((page - 1) * PAGE_SIZE), rows: String(PAGE_SIZE), api_key: key,
    });
    const data = await json(`https://api.si.edu/openaccess/api/v1.0/search?${params}`);
    if (data.status !== 200 || !data.response) throw new Error('Smithsonian returned an invalid response.');
    const artworks = [];
    // Bound concurrency and propagate failures rather than reporting an empty success.
    const rows = data.response.rows || [];
    for (let offset = 0; offset < rows.length; offset += 3) {
        const batch = await Promise.all(rows.slice(offset, offset + 3).map(async row => {
            const existing = smithsonianRecord(row);
            if (existing) return existing;
            const detail = await json(`https://api.si.edu/openaccess/api/v1.0/content/${encodeURIComponent(row.url)}?api_key=${encodeURIComponent(key)}`);
            return smithsonianRecord(detail.response || {});
        }));
        artworks.push(...batch.filter(Boolean));
    }
    return { artworks, total: data.response.rowCount || 0 };
}

function parisQuery(page) {
    return `{ nodeQuery(limit: 24, offset: ${(page - 1) * PAGE_SIZE}, filter: {conditions: [{field: "type", value: "oeuvre"}]}) {
        count entities { entityId ... on NodeOeuvre {
            title absolutePath
            fieldOeuvreAuteurs { entity { name } }
            fieldVisuelsPrincipals { entity { vignette } }
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
        throw new Error('Paris Musées could not provide the collection. Its API schema needs verification with the configured account.');
    }
    // Public vignette fields also include copyrighted thumbnails. Do not silently
    // treat them as print-ready CC0 assets before verifying the authenticated
    // media rights/high-resolution fields against the account's schema.
    const error = new Error('Paris Musées is connected; image rights and print-resolution fields still need verification before artworks can be offered for framing.');
    error.status = 503;
    throw error;
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
    else { const error = new Error('Unknown archival collection.'); error.status = 400; throw error; }
    cache.set(key, { value, expires: Date.now() + 15 * 60 * 1000 });
    return value;
}

module.exports = { museumFeed, archivalFeed, smithsonianRecord, parisQuery };
