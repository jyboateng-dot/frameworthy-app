import { FRAME_SIZES, findSizeByDimension } from '../data/constants';
import { doesSizeMeetMinDpi, isArtworkPrintableAtMinDpi, recommendFrameSize } from './museumArtwork';
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
