import { FRAME_SIZES } from '../data/constants';

const MIN_PRINT_DPI = 120;

export function getArtworkPixelSize(record = {}) {
    const candidates = [
        record.imageWidth && record.imageHeight ? { w: record.imageWidth, h: record.imageHeight } : null,
        record.width && record.height ? { w: record.width, h: record.height } : null,
        record.image?.width && record.image?.height ? { w: record.image.width, h: record.image.height } : null,
        record.thumbnail?.width && record.thumbnail?.height ? { w: record.thumbnail.width, h: record.thumbnail.height } : null,
        record.images?.web?.width && record.images?.web?.height ? { w: record.images.web.width, h: record.images.web.height } : null,
    ];
    return candidates.filter(Boolean).find(size => Number(size.w) > 0 && Number(size.h) > 0) || null;
}

export function recommendFrameSize(record = {}) {
    const pixelSize = getArtworkPixelSize(record);
    const ratio = pixelSize ? Number(pixelSize.w) / Number(pixelSize.h) : 1;
    const candidates = FRAME_SIZES
        .filter(size => size.width > 0 && size.height > 0)
        .map(size => {
            const sizeRatio = size.width / size.height;
            const frameWidthPx = Math.min(size.width, size.height) * MIN_PRINT_DPI;
            const frameHeightPx = Math.max(size.width, size.height) * MIN_PRINT_DPI;
            return {
                size,
                ratioDiff: Math.abs(sizeRatio - (ratio >= 1 ? 1 / ratio : ratio)),
                fitsResolution: !pixelSize || (frameWidthPx <= Math.min(pixelSize.w, pixelSize.h) && frameHeightPx <= Math.max(pixelSize.w, pixelSize.h)),
            };
        });
    const feasible = candidates.filter(candidate => candidate.fitsResolution);
    const pool = feasible.length ? feasible : candidates;
    pool.sort((a, b) => {
        if (Math.abs(a.ratioDiff - b.ratioDiff) > 0.005) return a.ratioDiff - b.ratioDiff;
        const areaA = a.size.width * a.size.height;
        const areaB = b.size.width * b.size.height;
        return feasible.length ? areaB - areaA : areaA - areaB;
    });
    const chosen = pool[0]?.size || FRAME_SIZES[0];
    return {
        ...chosen,
        orientation: ratio > 1.05 ? 'landscape' : ratio < 0.95 ? 'portrait' : 'square',
    };
}

export function normalizeMuseumArtwork(record, source) {
    const pixelSize = getArtworkPixelSize(record);
    const recommendation = recommendFrameSize(record);
    return {
        ...record,
        id: `${source.id}:${record.id}`,
        sourceId: source.id,
        sourceName: source.name,
        title: record.title || 'Untitled artwork',
        artist: record.artist || record.artistDisplay || record.artist_display || record.creator || 'Unknown artist',
        image: record.image || record.imageUrl || record.image_url || record.images?.web?.url || '',
        fullRes: record.fullRes || record.fullResImage || record.images?.print?.url || record.images?.original?.url || record.image || '',
        imageWidth: pixelSize?.w || null,
        imageHeight: pixelSize?.h || null,
        recommendedSize: recommendation,
    };
}
