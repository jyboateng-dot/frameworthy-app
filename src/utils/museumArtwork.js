import { FRAME_SIZES } from '../data/constants';

// Native print floor before AI super-resolution (Replicate Real-ESRGAN upscales 4x to 300 DPI)
export const MIN_PRINT_DPI = 75;

function normalizePixelPair(pixelSize) {
    if (!pixelSize) return null;
    const w = Number(pixelSize.w ?? pixelSize.width);
    const h = Number(pixelSize.h ?? pixelSize.height);
    return w > 0 && h > 0 ? { w, h } : null;
}

export function doesSizeMeetMinDpi(size, pixelSize, minDpi = MIN_PRINT_DPI) {
    const normalized = normalizePixelPair(pixelSize);
    if (!normalized) return true;
    const width = Number(size?.width);
    const height = Number(size?.height);
    if (!(width > 0 && height > 0)) return false;
    const frameShortPx = Math.min(width, height) * minDpi;
    const frameLongPx = Math.max(width, height) * minDpi;
    const imageShortPx = Math.min(normalized.w, normalized.h);
    const imageLongPx = Math.max(normalized.w, normalized.h);
    return frameShortPx <= imageShortPx && frameLongPx <= imageLongPx;
}

export function isArtworkPrintableAtMinDpi(pixelSize, minDpi = MIN_PRINT_DPI) {
    const normalized = normalizePixelPair(pixelSize);
    if (!normalized) return true;
    return FRAME_SIZES.some(size => doesSizeMeetMinDpi(size, normalized, minDpi));
}

export function getArtworkPixelSize(record = {}) {
    const mediaResource = record.metadata?.descriptiveNonRepeating?.online_media?.media
        ?.flatMap(item => item.resources || [])
        ?.find(res => Number(res?.width) > 0 && Number(res?.height) > 0);
    const candidates = [
        record.imageWidth && record.imageHeight ? { w: record.imageWidth, h: record.imageHeight } : null,
        record.width && record.height ? { w: record.width, h: record.height } : null,
        record.images?.print?.width && record.images?.print?.height ? { w: record.images.print.width, h: record.images.print.height } : null,
        record.image?.width && record.image?.height ? { w: record.image.width, h: record.image.height } : null,
        record.thumbnail?.width && record.thumbnail?.height ? { w: record.thumbnail.width, h: record.thumbnail.height } : null,
        mediaResource ? { w: mediaResource.width, h: mediaResource.height } : null,
        record.images?.web?.width && record.images?.web?.height ? { w: record.images.web.width, h: record.images.web.height } : null,
    ];
    const found = candidates.filter(Boolean).find(size => Number(size.w) > 0 && Number(size.h) > 0);
    return found ? { w: Number(found.w), h: Number(found.h) } : null;
}

// Core recognizable customer frame sizes preferred for initial presentation
const CORE_FRAME_SIZE_IDS = new Set([
    '8x10', 'a4', '11x14', '12x12', '12x18', 'a3', '16x20', 'a2', '18x24', '20x30', '24x36'
]);

// Ideal target aperture area (~350 sq in, around 16x20 to 18x24) for initial visualizer loading
const TARGET_RECOMMENDED_AREA = 350;

export function recommendFrameSize(record = {}) {
    const pixelSize = getArtworkPixelSize(record);
    const ratio = pixelSize ? Number(pixelSize.w) / Number(pixelSize.h) : 1;
    const shortRatio = ratio >= 1 ? 1 / ratio : ratio;

    const candidates = FRAME_SIZES
        .filter(size => size.width > 0 && size.height > 0)
        .map(size => {
            const sizeRatio = Math.min(size.width, size.height) / Math.max(size.width, size.height);
            return {
                size,
                ratioDiff: Math.abs(sizeRatio - shortRatio),
                fitsResolution: doesSizeMeetMinDpi(size, pixelSize, MIN_PRINT_DPI),
            };
        });
    const feasible = candidates.filter(candidate => candidate.fitsResolution);
    const pool = feasible.length ? feasible : candidates;
    pool.sort((a, b) => {
        // 1. If aspect ratio difference is noticeable (> 0.04), prioritize the closer aspect ratio
        if (Math.abs(a.ratioDiff - b.ratioDiff) > 0.04) {
            return a.ratioDiff - b.ratioDiff;
        }
        // 2. Prefer core recognizable frame sizes over obscure custom cutouts
        const isCoreA = CORE_FRAME_SIZE_IDS.has(a.size.id);
        const isCoreB = CORE_FRAME_SIZE_IDS.has(b.size.id);
        if (isCoreA !== isCoreB) return isCoreA ? -1 : 1;

        // 3. Target the balanced "sweet spot" area (16x20" - 18x24") for initial loading
        const areaA = a.size.width * a.size.height;
        const areaB = b.size.width * b.size.height;
        const distA = Math.abs(areaA - TARGET_RECOMMENDED_AREA);
        const distB = Math.abs(areaB - TARGET_RECOMMENDED_AREA);
        return distA - distB;
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
