import { MUSEUM_SOURCES } from '../data/museumSources';
import { ARCHIVAL_SOURCES } from '../data/archivalSources';
import { normalizeMuseumArtwork } from '../utils/museumArtwork';
import { isFramableMuseumArtwork } from '../utils/museumCollectionPolicy';

const PAGE_SIZE = 24;
const requestCache = new Map();
const snapshotCache = new Map();
const PUBLIC_SITE_ORIGIN = 'https://frameworthyco.com';

const KNOWN_SNAPSHOT_PAGES = {
    'national-gallery-of-art': 1677,
    'art-institute-of-chicago': 3,
    'cleveland-museum-of-art': 3,
    'paris-musees': 4,
    rijksmuseum: 3,
    'smithsonian-open-access': 3,
    'biodiversity-heritage-library': 3,
    'nasa-open-media': 3,
    'library-of-congress': 3,
};

const artInstituteImageUrl = (imageId, width = 843) =>
    `${PUBLIC_SITE_ORIGIN}/api/artic-image?id=${encodeURIComponent(imageId)}&width=${width}`;

const sourceById = (sourceId) => [...MUSEUM_SOURCES, ...ARCHIVAL_SOURCES].find(source => source.id === sourceId);

async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Museum API returned HTTP ${response.status}`);
    return response.json();
}

async function fetchArtInstitute(page) {
    return fetchServerCollection('art-institute-of-chicago', page);
}

async function fetchCleveland(page) {
    try {
        const params = new URLSearchParams({
            cc0: '',
            has_image: '1',
            limit: String(PAGE_SIZE),
            skip: String((page - 1) * PAGE_SIZE),
        });
        const payload = await getJson(`https://openaccess-api.clevelandart.org/api/artworks?${params}`);
        const source = sourceById('cleveland-museum-of-art');
        const artworks = (payload.data || []).filter(item => item.images?.web?.url).map(item => {
            const printImg = item.images.print || {};
            const webImg = item.images.web || {};
            return normalizeMuseumArtwork({
                ...item,
                artist: item.creators?.map(creator => creator.description).filter(Boolean).join(', '),
                image: webImg.url,
                fullRes: printImg.url || item.images.original?.url || webImg.url,
                imageWidth: Number(printImg.width || webImg.width) || null,
                imageHeight: Number(printImg.height || webImg.height) || null,
            }, source);
        });
        return {
            artworks,
            total: payload.info?.total || artworks.length,
        };
    } catch {
        return fetchServerCollection('cleveland-museum-of-art', page);
    }
}

async function fetchRijks(page) {
    return fetchServerCollection('rijksmuseum', page);
}

async function fetchServerCollection(sourceId, page) {
    const archivalEndpoint = ['biodiversity-heritage-library', 'nasa-open-media', 'library-of-congress'].includes(sourceId)
        ? '/api/archival-artworks'
        : '/api/museum-artworks';
    const response = await fetch(`${archivalEndpoint}?source=${encodeURIComponent(sourceId)}&page=${page}`);
    let data = {};
    try {
        if (typeof response.json === 'function') {
            data = await response.json();
        }
    } catch {
        data = {};
    }
    if (!response.ok) throw new Error(data?.error || 'The collection is temporarily unavailable.');
    return {
        ...data,
        artworks: (data.artworks || [])
            .filter(record => isFramableMuseumArtwork(sourceId, record))
            .map(record => normalizeMuseumArtwork(record, sourceById(sourceId))),
    };
}

async function fetchNga(page) {
    const data = await getJson(`/museum-data/nga/${page}.json`);
    return {
        ...data,
        artworks: data.artworks
            .filter(record => isFramableMuseumArtwork('national-gallery-of-art', record))
            .map(record => normalizeMuseumArtwork(record, sourceById('national-gallery-of-art'))),
    };
}

async function fetchLibraryOfCongress(page) {
    return fetchServerCollection('library-of-congress', page);
}

async function fetchNasa(page) {
    return fetchServerCollection('nasa-open-media', page);
}

const PARIS_PUBLIC_TOKEN = '9a695903-3959-4413-8a65-7427ac729efe';

async function fetchParis(page) {
    try {
        return await fetchServerCollection('paris-musees', page);
    } catch (serverErr) {
        // Fall back directly to the open GraphQL API (CORS enabled) if server function is unreachable
        const query = `{ nodeQuery(limit: ${PAGE_SIZE}, offset: ${(page - 1) * PAGE_SIZE}, filter: {conditions: [{field: "type", value: "oeuvre"}, {field: "field_visuels.entity.field_image_libre", value: "1"}]}) {
            entities { entityUuid ... on NodeOeuvre {
                title absolutePath fieldLrefAdlib fieldCartelAuteur
                fieldOeuvreTypesObjet { entity { entityLabel } }
                fieldVisuels { entity { ... on MediaImage { vignette publicUrl fieldLegende fieldCopyright } } }
            } }
        } }`;
        const res = await fetch('https://apicollections.parismusees.paris.fr/graphql', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'auth-token': PARIS_PUBLIC_TOKEN },
            body: JSON.stringify({ query }),
            signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) throw serverErr;
        const data = await res.json();
        const entities = data.data?.nodeQuery?.entities || [];
        const source = sourceById('paris-musees');
        const artworks = entities.map(item => {
            if (!item) return null;
            const objectType = item.fieldOeuvreTypesObjet?.map(type => type.entity?.entityLabel).filter(Boolean).join(', ') || '';
            const visual = item.fieldVisuels?.find(v => v?.entity?.publicUrl)?.entity || item.fieldVisuels?.[0]?.entity || {};
            const vignette = visual.vignette;
            if (!vignette && !visual.publicUrl) return null;
            const rawPreview = vignette || visual.publicUrl;
            const image = /^https?:\/\//i.test(rawPreview) ? rawPreview : `https://parismuseescollections.paris.fr${rawPreview}`;
            const fullRes = visual.publicUrl
                ? (/^https?:\/\//i.test(visual.publicUrl) ? visual.publicUrl : `https://www.parismuseescollections.paris.fr${visual.publicUrl}`)
                : image;
            return normalizeMuseumArtwork({
                id: String(item.entityUuid || item.entityId),
                title: item.title || 'Paris Musées Artwork',
                artist: item.fieldCartelAuteur || 'Paris Musées',
                image,
                fullRes,
                sourceUrl: item.absolutePath || `https://www.parismuseescollections.paris.fr/fr/node/${item.entityId}`,
                rights: visual.fieldCopyright || 'CC0 / Paris Musées Open Content',
                description: visual.fieldLegende,
                objectType,
                metadata: { lrefAdlib: item.fieldLrefAdlib, copyright: visual.fieldCopyright },
            }, source);
        }).filter(record => record && isFramableMuseumArtwork('paris-musees', record));
        return { artworks, total: 185548 };
    }
}

const LOADERS = {
    'art-institute-of-chicago': fetchArtInstitute,
    'cleveland-museum-of-art': fetchCleveland,
    rijksmuseum: fetchRijks,
    'smithsonian-open-access': page => fetchServerCollection('smithsonian-open-access', page),
    'paris-musees': fetchParis,
    'national-gallery-of-art': fetchNga,
    'library-of-congress': fetchLibraryOfCongress,
    'nasa-open-media': fetchNasa,
    'biodiversity-heritage-library': page => fetchServerCollection('biodiversity-heritage-library', page),
};

export async function fetchMuseumArtworks(sourceId, page = 1) {
    const requestKey = `${sourceId}:${page}`;
    const existing = requestCache.get(requestKey);
    if (existing) return existing;

    const snapshot = snapshotCache.get(requestKey) || fetchMuseumSnapshot(sourceId, page);
    snapshotCache.set(requestKey, snapshot);
    const request = snapshot.then(data => data || fetchMuseumArtworksLive(sourceId, page));
    requestCache.set(requestKey, request);
    request.catch(() => requestCache.delete(requestKey));
    return request;
}

async function fetchMuseumSnapshot(sourceId, page) {
    if (page > (KNOWN_SNAPSHOT_PAGES[sourceId] || 0)) {
        return null;
    }
    try {
        const staticUrl = sourceId === 'national-gallery-of-art'
            ? `/museum-data/nga/${page}.json`
            : `/museum-data/${sourceId}/${page}.json`;
        const res = await fetch(staticUrl);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.artworks) && data.artworks.length > 0) {
                const artworks = data.artworks.filter(record => isFramableMuseumArtwork(sourceId, record));
                if (!artworks.length) return null;
                return {
                    ...data,
                    artworks: artworks.map(record => normalizeMuseumArtwork(record, sourceById(sourceId))),
                };
            }
        }
    } catch {
        // A missing or failed snapshot falls back to the live loader.
    }
    return null;
}

async function fetchMuseumArtworksLive(sourceId, page) {
    const loader = LOADERS[sourceId];
    if (!loader) throw new Error('Unknown museum collection.');
    return loader(page);
}

export function prefetchMuseumSnapshot(sourceId, page = 1) {
    const requestKey = `${sourceId}:${page}`;
    if (snapshotCache.has(requestKey)) return snapshotCache.get(requestKey);
    const snapshot = fetchMuseumSnapshot(sourceId, page);
    snapshotCache.set(requestKey, snapshot);
    return snapshot;
}
