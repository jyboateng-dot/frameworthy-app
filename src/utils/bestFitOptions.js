import { frameGeometry, imageCrop } from './frameFit';
import { maxMatWidthForSize } from './matting';
import { MIN_PRINT_DPI, doesSizeMeetMinDpi } from './museumArtwork';
import {
    isProdigiConfigurationAvailable,
    prodigiMountWidthInForSize,
    prodigiAvailableSizes,
} from './prodigiFlow';

export function bestFitOptions({
    sizes,
    natural,
    size,
    orientation,
    mat,
    rail,
    frame,
    price,
    matPrice,
    prodigiConfiguration = {},
}) {
    const isProdigi = Boolean(frame?.prodigiProduct);
    const candidateSizes = isProdigi
        ? (sizes && sizes.length > 0 && sizes[0]?.product ? sizes : prodigiAvailableSizes(frame, prodigiConfiguration))
        : sizes;

    const basePrice = Number.isFinite(size?.price) ? Math.round(size.price * (frame?.priceMod || 1)) : 0;
    const candidates = [];
    const seen = new Set();

    for (const candidate of candidateSizes) {
        if (!doesSizeMeetMinDpi(candidate, natural, MIN_PRINT_DPI)) continue;
        for (const direction of ['portrait', 'landscape']) {
            if (candidate.width === candidate.height && direction === 'landscape') continue;

            // Determine border options:
            let allowedBorders;
            if (isProdigi) {
                // In Prodigi, only box and classic mouldings offer mounted variants.
                // Canvas, aluminium, etc. are exclusively unmounted.
                const canHaveMount = ['box', 'classic'].includes(frame?.prodigiProduct);
                const hasUnmounted = isProdigiConfigurationAvailable(frame, candidate, { ...prodigiConfiguration, mounted: false });
                const hasMounted = canHaveMount && isProdigiConfigurationAvailable(frame, candidate, { ...prodigiConfiguration, mounted: true });

                const borders = [];
                if (hasUnmounted) borders.push('none');
                if (hasMounted) {
                    const mountWidth = String(prodigiMountWidthInForSize(candidate));
                    borders.push(mountWidth);
                }
                allowedBorders = [...new Set(borders)];
            } else {
                allowedBorders = [...new Set([mat, 'none'])];
            }

            for (const border of allowedBorders) {
                if (candidate.id === size.id && direction === orientation && border === mat) continue;
                if (!isProdigi && border !== 'none' && Number(border) > maxMatWidthForSize(candidate.width, candidate.height, rail)) continue;

                const geometry = frameGeometry(candidate, direction, border, rail);
                const key = `${geometry.width}:${geometry.height}:${geometry.mat}`;
                if (seen.has(key)) continue;
                seen.add(key);

                let total;
                if (isProdigi) {
                    total = null; // Live quote fetched upon application
                } else {
                    total = Math.round((candidate.price || 0) * (frame?.priceMod || 1)) + (price || 0) - basePrice
                        - (mat !== 'none' && border === 'none' ? matPrice : 0);
                }

                const crop = imageCrop(natural, geometry);
                if (!crop) continue;

                const distance = Math.abs(Math.log((candidate.width * candidate.height) / (size.width * size.height)));
                candidates.push({
                    size: candidate,
                    orientation: direction,
                    mat: border,
                    geometry,
                    price: total,
                    retained: crop.retained,
                    score: crop.retained - distance * 0.08 - (border === mat ? 0 : 0.02),
                });
            }
        }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}
