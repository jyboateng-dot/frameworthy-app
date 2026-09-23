import { MUSEUM_SOURCES } from '../data/museumSources';
import { normalizeMuseumArtwork } from '../utils/museumArtwork';

const PAGE_SIZE = 24;


const artInstituteImageUrl = (imageId, width = 843) =>
    `/api/artic-image?id=${encodeURIComponent(imageId)}&width=${width}`;

const sourceById = (sourceId) => MUSEUM_SOURCES.find(source => source.id === sourceId);

async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Museum API returned HTTP ${response.status}`);
    return response.json();
}

async function fetchArtInstitute(page) {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        fields: 'id,title,artist_display,image_id,thumbnail,dimensions,date_display,is_public_domain',
    });
    params.set('query[term][is_public_domain]', 'true');
    const payload = await getJson(`https://api.artic.edu/api/v1/artworks/search?${params}`);
    const source = sourceById('art-institute-of-chicago');
    return {
        artworks: (payload.data || []).filter(item => item.image_id).map(item => normalizeMuseumArtwork({
            ...item,
            artist_display: item.artist_display,
            image: artInstituteImageUrl(item.image_id, 843),
            fullRes: artInstituteImageUrl(item.image_id, 2400),
            imageWidth: item.thumbnail?.width,
            imageHeight: item.thumbnail?.height,
        }, source)),
        total: payload.pagination?.total || 0,
    };
}

async function fetchCleveland(page) {
    const params = new URLSearchParams({
        cc0: '',
        has_image: '1',
        limit: String(PAGE_SIZE),
        skip: String((page - 1) * PAGE_SIZE),
    });
    const payload = await getJson(`https://openaccess-api.clevelandart.org/api/artworks?${params}`);
    const source = sourceById('cleveland-museum-of-art');
    return {
        artworks: (payload.data || []).filter(item => item.images?.web?.url).map(item => normalizeMuseumArtwork({
            ...item,
            artist: item.creators?.map(creator => creator.description).filter(Boolean).join(', '),
            image: item.images.web.url,
            fullRes: item.images.original?.url || item.images.print?.url || item.images.web.url,
        }, source)),
        total: payload.info?.total || 0,
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
    const response = await fetch(`/api/museum-artworks?source=${encodeURIComponent(sourceId)}&page=${page}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The collection is temporarily unavailable.');
    return { ...data, artworks: data.artworks.map(record => normalizeMuseumArtwork(record, sourceById(sourceId))) };
}

async function fetchNga(page) {
    const data = await getJson(`/museum-data/nga/${page}.json`);
    return { ...data, artworks: data.artworks.map(record => normalizeMuseumArtwork(record, sourceById('national-gallery-of-art'))) };
}
const LOADERS = {
    'art-institute-of-chicago': fetchArtInstitute,
    'cleveland-museum-of-art': fetchCleveland,
    rijksmuseum: fetchRijks,
    'smithsonian-open-access': page => fetchServerCollection('smithsonian-open-access', page),
    'paris-musees': page => fetchServerCollection('paris-musees', page),
    'national-gallery-of-art': fetchNga,
};

export async function fetchMuseumArtworks(sourceId, page = 1) {
    const loader = LOADERS[sourceId];
    if (!loader) throw new Error('Unknown museum collection.');
    return loader(page);
}

