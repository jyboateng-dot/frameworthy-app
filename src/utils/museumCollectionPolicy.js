import { getArtworkPixelSize, isArtworkPrintableAtMinDpi } from './museumArtwork';

// Keep only 2D visual art: paintings, drawings, prints, portraits, illustrations, etc.
// Exclude 3D artefacts (sculptures, coins, ceramics, furniture, archaeological objects).
const ART_TYPES = /\b(painting|drawing|print|engraving|etching|lithograph|illustration|watercolou?r|portrait|portrait miniature|peinture|tableau|dessin|estampe|gravure|aquarelle|pastel|gouache|lithographie|eau-forte|arts graphiques|affiche|huile)\b/i;
const PAINTING_MEDIA = /\b(oil|tempera|acrylic|gouache|watercolou?r|ink|charcoal|pastel|graphite|pencil)\b/i;

/**
 * Museum collection policy for framed artwork.
 * Filters for 2D visual art (paintings, drawings, prints, portraits) and ensures
 * image resolution meets the minimum 75 native DPI floor (upscaled 4x to 300 DPI via Replicate).
 */
export function isFramableMuseumArtwork(sourceId, record) {
    if (!record?.image && !record?.fullRes) return false;
    const pixelSize = getArtworkPixelSize(record);
    if (pixelSize && !isArtworkPrintableAtMinDpi(pixelSize)) return false;
    if (sourceId === 'rijksmuseum') return true; // Source query is paintings, drawings, prints.
    if (sourceId === 'national-gallery-of-art') return ART_TYPES.test(record.classification || '');
    if (sourceId === 'cleveland-museum-of-art') {
        const type = record.type || record.artworkType;
        if (type && !/^artwork$/i.test(type)) return ART_TYPES.test(type);
        if (record.medium || record.technique) return PAINTING_MEDIA.test(record.medium || record.technique);
        return Boolean(record.rights?.includes('Cleveland') || record.sourceUrl?.includes('clevelandart.org'));
    }
    if (sourceId === 'art-institute-of-chicago') {
        const type = record.artworkType || record.artwork_type_title || record.type || record.classification || record.medium;
        if (type && !/^artwork$/i.test(type)) return ART_TYPES.test(type);
        return Boolean(record.rights?.includes('Art Institute') || record.sourceUrl?.includes('artic.edu'));
    }
    if (sourceId === 'smithsonian-open-access') {
        const type = record.metadata?.freetext?.objectType?.map(item => item.content).join(' ') || record.objectType || record.artworkType || '';
        if (type && !/^artwork$/i.test(type)) return ART_TYPES.test(type);
        return Boolean(record.rights?.includes('Smithsonian') || record.sourceUrl?.includes('si.edu'));
    }
    if (sourceId === 'paris-musees') {
        if (record.objectType && !/^artwork$/i.test(record.objectType)) return ART_TYPES.test(record.objectType);
        return Boolean(record.rights?.includes('Paris Musées') || record.sourceUrl?.includes('parismusees'));
    }
    if (sourceId === 'biodiversity-heritage-library') {
        if (record.rights === 'Public Domain / Biodiversity Heritage Library') return true;
        return /\b(drawn|drawing|illustrat(?:ion|ed)|painting|painted|plate|print|engraving|lithograph|watercolou?r)\b/i.test(record.title || '');
    }
    if (sourceId === 'nasa-open-media') return true;
    if (sourceId === 'library-of-congress') return true;
    return false;
}

