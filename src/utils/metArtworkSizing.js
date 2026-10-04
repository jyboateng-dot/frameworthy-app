import { FRAME_SIZES, findSizeByDimension } from '../data/constants';
import { recommendFrameSize } from './museumArtwork';
import MET_ARTWORK_PIXEL_DIMENSIONS from '../data/metArtworkPixelDimensions.json';
import WEB_MET_DIMS from '../data/web_met_dims.json';

const DEFAULT_MET_DIMENSIONS = '40 x 50 cm';

export function getMetRecommendedSize(artwork = {}) {
    const imageDimensions = MET_ARTWORK_PIXEL_DIMENSIONS[artwork.id];
    if (imageDimensions) return recommendFrameSize(imageDimensions);

    const filename = artwork.image?.split('/').pop();
    const dimensions = WEB_MET_DIMS[filename] || DEFAULT_MET_DIMENSIONS;
    const size = findSizeByDimension(dimensions)
        || FRAME_SIZES.find(candidate => candidate.id === '16x20')
        || FRAME_SIZES[0];

    return {
        ...size,
        orientation: artwork.orientation || size.orientation || 'portrait',
    };
}
