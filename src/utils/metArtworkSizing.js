import { FRAME_SIZES, findSizeByDimension } from '../data/constants';
import { doesSizeMeetMinDpi, isArtworkPrintableAtMinDpi, recommendFrameSize } from './museumArtwork';
import { maxFramePrintSize } from './maxFramePrintSize';
import MET_ARTWORK_PIXEL_DIMENSIONS from '../data/metArtworkPixelDimensions.json';
import WEB_MET_DIMS from '../data/web_met_dims.json';

const DEFAULT_MET_DIMENSIONS = '40 x 50 cm';

export function getMetArtworkPixelSize(artwork = {}) {
    const dims = MET_ARTWORK_PIXEL_DIMENSIONS[artwork.id];
    if (!dims || !(Number(dims.width) > 0 && Number(dims.height) > 0)) return null;
    return { w: Number(dims.width), h: Number(dims.height) };
}

export function isMetArtworkPrintable(artwork = {}) {
    const pixelSize = getMetArtworkPixelSize(artwork);
    return isArtworkPrintableAtMinDpi(pixelSize);
}

export function getMetRecommendedSize(artwork = {}) {
    const imageDimensions = MET_ARTWORK_PIXEL_DIMENSIONS[artwork.id];
    if (imageDimensions) return recommendFrameSize(imageDimensions);

    const filename = artwork.image?.split('/').pop();
    const dimensions = WEB_MET_DIMS[filename] || DEFAULT_MET_DIMENSIONS;
    const size = findSizeByDimension(dimensions)
        || FRAME_SIZES.find(candidate => candidate.id === '16x20')
        || FRAME_SIZES[0];

    const pixelSize = getMetArtworkPixelSize(artwork);
    if (pixelSize && !doesSizeMeetMinDpi(size, pixelSize)) {
        return recommendFrameSize(pixelSize);
    }

    return {
        ...size,
        orientation: artwork.orientation || size.orientation || 'portrait',
    };
}

/**
 * Collection categories that feature actual 2D paintings, portraits, prints,
 * drawings, and fine art wall photography (as opposed to 3D artefacts,
 * sculptures, armor, pottery, and antiquities).
 */
export const MET_PAINTING_PORTRAIT_CATEGORIES = new Set([
    'European Paintings',
    'Classic Masterpieces',
    'Vincent van Gogh',
    'Claude Monet',
    'The Robert Lehman Collection',
    'Japanese Prints',
    'Drawings and Prints',
    'Photographs',
]);

export function isPaintingOrPortraitCategory(categoryName = '') {
    if (MET_PAINTING_PORTRAIT_CATEGORIES.has(categoryName)) return true;
    const lower = String(categoryName).toLowerCase();
    return lower.includes('painting') ||
        lower.includes('portrait') ||
        lower.includes('drawing') ||
        lower.includes('print') ||
        lower.includes('photograph') ||
        lower.includes('masterpiece') ||
        lower.includes('monet') ||
        lower.includes('gogh');
}

/**
 * Returns Met collection category names sorted so that actual paintings
 * and portrait-like 2D wall art appear first on the list (with biggest
 * max frame sizes prioritized), while artefacts/sculptures are pushed back.
 */
export function getSortedMetCategories(collections = {}) {
    const stats = {};
    for (const [cat, items] of Object.entries(collections || {})) {
        const printable = (items || []).filter(isMetArtworkPrintable);
        if (!printable.length) continue;
        let maxArea = 0;
        let maxDim = 0;
        let totalArea = 0;
        let count = 0;
        for (const item of printable) {
            const px = getMetArtworkPixelSize(item);
            const size = maxFramePrintSize(px);
            if (size) {
                const area = size.width * size.height;
                const dim = Math.max(size.width, size.height);
                if (area > maxArea) {
                    maxArea = area;
                    maxDim = dim;
                }
                totalArea += area;
                count++;
            }
        }
        stats[cat] = {
            count,
            maxArea,
            maxDim,
            avgArea: count ? totalArea / count : 0,
            isPainting: isPaintingOrPortraitCategory(cat),
        };
    }

    return Object.keys(stats).sort((a, b) => {
        const sa = stats[a], sb = stats[b];
        // 1. Actual paintings and portrait-like categories appear first; artefacts pushed back
        if (sa.isPainting !== sb.isPainting) {
            return sa.isPainting ? -1 : 1;
        }
        // 2. Within each tier, categories with the biggest max frame sizes appear first
        if (sb.maxArea !== sa.maxArea) return sb.maxArea - sa.maxArea;
        if (sb.maxDim !== sa.maxDim) return sb.maxDim - sa.maxDim;
        if (sb.avgArea !== sa.avgArea) return sb.avgArea - sa.avgArea;
        return a.localeCompare(b);
    });
}


