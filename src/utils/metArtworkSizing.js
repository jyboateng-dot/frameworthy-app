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
 * Returns Met collection category names sorted so categories with the
 * biggest max frame sizes appear first.
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
        };
    }

    return Object.keys(stats).sort((a, b) => {
        const sa = stats[a], sb = stats[b];
        if (sb.maxArea !== sa.maxArea) return sb.maxArea - sa.maxArea;
        if (sb.maxDim !== sa.maxDim) return sb.maxDim - sa.maxDim;
        if (sb.avgArea !== sa.avgArea) return sb.avgArea - sa.avgArea;
        return a.localeCompare(b);
    });
}

