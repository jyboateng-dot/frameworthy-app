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
        artworks: [...(paintings.data || []), ...(drawings.data || [])].filter(item => item.image_id).map(item => normalizeMuseumArtwork({
            ...item,
            artist_display: item.artist_display,
            image: artInstituteImageUrl(item.image_id, 843),
            fullRes: artInstituteImageUrl(item.image_id, 2400),
            imageWidth: item.thumbnail?.width,
            imageHeight: item.thumbnail?.height,
        }, source)),
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
        artworks: [...(paintings.data || []), ...(drawings.data || [])].filter(item => item.images?.web?.url).map(item => normalizeMuseumArtwork({
            ...item,
            artist: item.creators?.map(creator => creator.description).filter(Boolean).join(', '),
            image: item.images.web.url,
            fullRes: item.images.original?.url || item.images.print?.url || item.images.web.url,
        }, source)),
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
            const title = firstEnglishName(object.identified_by)?.content || 'Untitled artwork';
            const artist = object.produced_by?.part?.flatMap(part => part.carried_out_by || [])
                .flatMap(person => person.notation || [])
                .find(notation => notation['@language'] === 'en')?.['@value'] || 'Unknown artist';
            return normalizeMuseumArtwork({ id: item.id, title, artist, image, fullRes: image, rights: object.subject_of?.find(subject => subject.subject_to)?.subject_to }, source);
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
const LOADERS = {
    'art-institute-of-chicago': fetchArtInstitute,
    'cleveland-museum-of-art': fetchCleveland,
    rijksmuseum: fetchRijks,
    'smithsonian-open-access': page => fetchServerCollection('smithsonian-open-access', page),
    'paris-musees': page => fetchServerCollection('paris-musees', page),
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

