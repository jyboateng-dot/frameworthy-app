import { getArtworkPixelSize, isArtworkPrintableAtMinDpi } from './museumArtwork';

// Keep only flat visual art that can reasonably be offered as framed artwork.
// A portrait is a subject, not a medium: photographs and sculptures remain out.
const ART_TYPES = /\b(painting|drawing|print|engraving|etching|lithograph|illustration|watercolou?r|portrait miniature|peinture|dessin|estampe|aquarelle)\b/i;
const PAINTING_MEDIA = /\b(oil|tempera|acrylic|gouache|watercolou?r|ink|charcoal|pastel|graphite|pencil)\b/i;

export function isFramableMuseumArtwork(sourceId, record) {
    if (!record?.image) return false;
    const pixelSize = getArtworkPixelSize(record);
    if (pixelSize && !isArtworkPrintableAtMinDpi(pixelSize)) return false;
    if (sourceId === 'rijksmuseum') return true; // Source query is type=painting.
    if (sourceId === 'national-gallery-of-art') return ART_TYPES.test(record.classification || '');
    if (sourceId === 'cleveland-museum-of-art') {
        if (record.type) return ART_TYPES.test(record.type);
        return PAINTING_MEDIA.test(record.medium || record.technique || '');
    }
    if (sourceId === 'art-institute-of-chicago') return ART_TYPES.test(record.artworkType || record.artwork_type_title || '');
    if (sourceId === 'smithsonian-open-access') {
        const type = record.metadata?.freetext?.objectType?.map(item => item.content).join(' ') || record.objectType || '';
        return ART_TYPES.test(type);
    }
    if (sourceId === 'paris-musees') return ART_TYPES.test(record.objectType || '');
    if (sourceId === 'biodiversity-heritage-library') {
        if (record.rights === 'Public Domain / Biodiversity Heritage Library') return true;
        return /\b(drawn|drawing|illustrat(?:ion|ed)|painting|painted|plate|print|engraving|lithograph|watercolou?r)\b/i.test(record.title || '');
    }
    // NASA's archival endpoint is explicitly queried with media_type=image,
    // so its curated category can safely accept the returned space imagery.
    if (sourceId === 'nasa-open-media') return true;
    return false;
}
