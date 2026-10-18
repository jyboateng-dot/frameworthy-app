import { MUSEUM_SOURCES } from '../data/museumSources';
import { ARCHIVAL_SOURCES } from '../data/archivalSources';
import { normalizeMuseumArtwork } from '../utils/museumArtwork';
import { isFramableMuseumArtwork } from '../utils/museumCollectionPolicy';

const PAGE_SIZE = 24;
const requestCache = new Map();
const snapshotCache = new Map();


const artInstituteImageUrl = (imageId, width = 843) =>
    `/api/artic-image?id=${encodeURIComponent(imageId)}&width=${width}`;

const sourceById = (sourceId) => [...MUSEUM_SOURCES, ...ARCHIVAL_SOURCES].find(source => source.id === sourceId);

async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Museum API returned HTTP ${response.status}`);
    return response.json();
}

async function fetchArtInstitute(page) {
    const fetchType = async (type) => {
        const params = new URLSearchParams({
            page: String(page), limit: String(PAGE_SIZE / 2),
            fields: 'id,title,artist_display,image_id,thumbnail,dimensions,date_display,is_public_domain,artwork_type_title',
        });
        params.set('query[bool][must][0][term][is_public_domain]', 'true');
        params.set('query[bool][must][1][term][artwork_type_title.keyword]', type);
        return getJson(`https://api.artic.edu/api/v1/artworks/search?${params}`);
    };
    const [paintings, drawings] = await Promise.all([fetchType('Painting'), fetchType('Drawing')]);
    const source = sourceById('art-institute-of-chicago');
    return {
        artworks: [...(paintings.data || []), ...(drawings.data || [])].filter(item => item.image_id).map(item => {
            const masterWidth = Number(item.thumbnail?.width) || 4000;
            const masterHeight = Number(item.thumbnail?.height) || null;
            return normalizeMuseumArtwork({
                ...item,
                artist_display: item.artist_display,
                image: artInstituteImageUrl(item.image_id, 400),
                fullRes: artInstituteImageUrl(item.image_id, masterWidth),
                imageWidth: masterWidth,
                imageHeight: masterHeight,
            }, source);
        }),
        total: (paintings.pagination?.total || 0) + (drawings.pagination?.total || 0),
    };
}

async function fetchCleveland(page) {
    const fetchType = (type) => {
        const params = new URLSearchParams({
            cc0: '', has_image: '1', type,
            limit: String(PAGE_SIZE / 2), skip: String((page - 1) * PAGE_SIZE / 2),
        });
        return getJson(`https://openaccess-api.clevelandart.org/api/artworks?${params}`);
    };
    const [paintings, drawings] = await Promise.all([fetchType('Painting'), fetchType('Drawing')]);
    const source = sourceById('cleveland-museum-of-art');
    return {
        artworks: [...(paintings.data || []), ...(drawings.data || [])].filter(item => item.images?.web?.url).map(item => {
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
        }),
        total: (paintings.info?.total || 0) + (drawings.info?.total || 0),
    };
}

function firstEnglishName(items = []) {
    const names = items.filter(item => item?.type === 'Name' && item.content);
    return names.find(item => item.language?.some(language => language.id?.endsWith('300388256'))) || names[0] || null;
}

async function fetchRijks(page) {
    // Rijksmuseum's public search returns identifiers. Resolve the first
    // page of identifiers through Linked Art, then follow the VisualItem ->
    // DigitalObject chain to obtain the IIIF image URL.
    const search = await getJson('https://data.rijksmuseum.nl/search/collection?imageAvailable=true&type=painting');
    const offset = (page - 1) * PAGE_SIZE;
    const identifiers = (search.orderedItems || []).slice(offset, offset + PAGE_SIZE);
    const source = sourceById('rijksmuseum');
    const artworks = await Promise.all(identifiers.map(async item => {
        try {
            const object = await getJson(`${item.id}?_profile=la-framed`);
            const visualId = object.shows?.find(visual => visual.type === 'VisualItem')?.id;
            if (!visualId) return null;
            const visual = await getJson(`${visualId.replace('id.rijksmuseum.nl', 'data.rijksmuseum.nl')}?_profile=la-framed`);
            const digitalId = visual.digitally_shown_by?.[0]?.id;
            if (!digitalId) return null;
            const digital = await getJson(`${digitalId.replace('id.rijksmuseum.nl', 'data.rijksmuseum.nl')}?_profile=la-framed`);
            const image = digital.access_point?.find(access => access.id?.includes('iiif.micr.io'))?.id;
            if (!image) return null;
            let imageWidth = null;
            let imageHeight = null;
            try {
                const infoUrl = image.replace(/\/full\/.*$/, '/info.json');
                if (infoUrl !== image) {
                    const info = await getJson(infoUrl);
                    imageWidth = Number(info.width) || null;
                    imageHeight = Number(info.height) || null;
                }
            } catch {
                // IIIF info.json is optional metadata enrichment.
            }
            const title = firstEnglishName(object.identified_by)?.content || 'Untitled artwork';
            const artist = object.produced_by?.part?.flatMap(part => part.carried_out_by || [])
                .flatMap(person => person.notation || [])
                .find(notation => notation['@language'] === 'en')?.['@value'] || 'Unknown artist';
            return normalizeMuseumArtwork({
                id: item.id,
                title,
                artist,
                image,
                fullRes: image,
                imageWidth,
                imageHeight,
                rights: object.subject_of?.find(subject => subject.subject_to)?.subject_to,
            }, source);
        } catch {
            return null;
        }
    }));
    return { artworks: artworks.filter(Boolean), total: search.partOf?.totalItems || 0 };
}

async function fetchServerCollection(sourceId, page) {
    const archivalEndpoint = ['biodiversity-heritage-library', 'nasa-open-media', 'library-of-congress'].includes(sourceId)
        ? '/api/archival-artworks'
        : '/api/museum-artworks';
    const response = await fetch(`${archivalEndpoint}?source=${encodeURIComponent(sourceId)}&page=${page}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The collection is temporarily unavailable.');
    return { ...data, artworks: data.artworks
        .filter(record => isFramableMuseumArtwork(sourceId, record))
        .map(record => normalizeMuseumArtwork(record, sourceById(sourceId))) };
}

async function fetchNga(page) {
    const data = await getJson(`/museum-data/nga/${page}.json`);
    return { ...data, artworks: data.artworks
        .filter(record => isFramableMuseumArtwork('national-gallery-of-art', record))
        .map(record => normalizeMuseumArtwork(record, sourceById('national-gallery-of-art'))) };
}

async function fetchLibraryOfCongress(page) {
    return fetchServerCollection('library-of-congress', page);
}

async function fetchNasa(page) {
    return fetchServerCollection('nasa-open-media', page);
}

const PARIS_OPEN_ART_TYPE_IDS = [330958, 167983, 330934, 167938, 166238];
const PARIS_PUBLIC_TOKEN = '9a695903-3959-4413-8a65-7427ac729efe';

async function fetchParis(page) {
    try {
        return await fetchServerCollection('paris-musees', page);
    } catch (serverErr) {
        // Fall back directly to the open GraphQL API (CORS enabled) if server function is unreachable
        const query = `{ nodeQuery(limit: ${PAGE_SIZE}, offset: ${(page - 1) * PAGE_SIZE}, filter: {conditions: [{field: "type", value: "oeuvre"}, {field: "field_visuels.entity.field_image_libre", value: "1"}, {field: "field_oeuvre_types_objet", value: [${PARIS_OPEN_ART_TYPE_IDS.map(id => `"${id}"`).join(',')}], operator: IN}]}) {
            entities { entityUuid ... on NodeOeuvre {
                title absolutePath fieldLrefAdlib fieldCartelAuteur
                fieldOeuvreTypesObjet { entity { entityLabel } }
                fieldVisuels { entity { ... on MediaImage { vignette publicUrl fieldLegende fieldCopyright } } }
            } }
        } }`;
        const res = await fetch('https://apicollections.parismusees.paris.fr/graphql', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'auth-token': PARIS_PUBLIC_TOKEN },
            body: JSON.stringify({ query }),
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

    // A prefetched snapshot may still be in flight. Resolve it before using a
    // live loader, so switching to a warmed source reuses the same response.
    // `null` is an intentional cache value for sources/pages without a local
    // snapshot and must always fall through to the source's live loader.
    const snapshot = snapshotCache.get(requestKey) || fetchMuseumSnapshot(sourceId, page);
    snapshotCache.set(requestKey, snapshot);
    const request = snapshot.then(data => data || fetchMuseumArtworksLive(sourceId, page));
    requestCache.set(requestKey, request);
    request.catch(() => requestCache.delete(requestKey));
    return request;
}

async function fetchMuseumSnapshot(sourceId, page) {
    // Older Chicago snapshots omit artwork type, so they cannot be safely
    // screened. Use the typed live query until they are regenerated.
    if (sourceId === 'art-institute-of-chicago') return null;
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
        // A missing or failed snapshot is not a failed collection request.
    }
    return null;
}

async function fetchMuseumArtworksLive(sourceId, page) {
    const loader = LOADERS[sourceId];
    if (!loader) throw new Error('Unknown museum collection.');
    return loader(page);
}

// Warm only local snapshots during idle time. This avoids adding network/API
// pressure while making the next category switch instant where a snapshot is
// available; categories without a snapshot still use their normal live loader.
export function prefetchMuseumSnapshot(sourceId, page = 1) {
    const requestKey = `${sourceId}:${page}`;
    if (snapshotCache.has(requestKey)) return snapshotCache.get(requestKey);
    const snapshot = fetchMuseumSnapshot(sourceId, page);
    snapshotCache.set(requestKey, snapshot);
    return snapshot;
}

