export const DEFAULT_POSITION = { x: 0.5, y: 0.5, zoom: 1 };
export const MIN_CROP_DPI = 150;

export function isDefaultFitPosition(position = DEFAULT_POSITION) {
    if (!position) return true;
    const x = Number.isFinite(Number(position.x)) ? Number(position.x) : 0.5;
    const y = Number.isFinite(Number(position.y)) ? Number(position.y) : 0.5;
    const zoom = Number.isFinite(Number(position.zoom)) ? Number(position.zoom) : 1;
    return Math.abs(x - 0.5) < 0.001 && Math.abs(y - 0.5) < 0.001 && Math.abs(zoom - 1) < 0.001;
}

export function maxZoomForMinDpi(image, geometry, minDpi = MIN_CROP_DPI) {
    if (!image?.w || !image?.h || !(geometry?.apertureWidth > 0) || !(geometry?.apertureHeight > 0)) {
        return 3;
    }
    const aspect = geometry.apertureWidth / geometry.apertureHeight;
    const baseW = Math.min(image.w, image.h * aspect);
    const baseH = baseW / aspect;
    const maxZoomW = baseW / (geometry.apertureWidth * minDpi);
    const maxZoomH = baseH / (geometry.apertureHeight * minDpi);
    const allowedZoom = Math.min(maxZoomW, maxZoomH);
    return Math.max(1, Math.min(3, Math.floor(allowedZoom * 100) / 100));
}

export function frameGeometry(size, orientation, mat = 'none', rail = 0) {
    const width = orientation === 'landscape' ? size.height : size.width;
    const height = orientation === 'landscape' ? size.width : size.height;
    const border = mat === 'none' ? 0 : Number(mat);
    return { width, height, mat: border, rail, outerWidth: width + rail * 2,
        outerHeight: height + rail * 2, apertureWidth: width - border * 2,
        apertureHeight: height - border * 2 };
}

export function imageCrop(image, geometry, position = DEFAULT_POSITION, minDpi = MIN_CROP_DPI, contentBounds = null) {
    if (!image?.w || !image?.h || geometry.apertureWidth <= 0 || geometry.apertureHeight <= 0) return null;
    const bounds = contentBounds && contentBounds.w > 0 && contentBounds.h > 0
        ? contentBounds
        : { x: 0, y: 0, w: image.w, h: image.h };
    const aspect = geometry.apertureWidth / geometry.apertureHeight;
    const maxZoom = maxZoomForMinDpi(bounds, geometry, minDpi);
    const requestedZoom = Number.isFinite(Number(position?.zoom)) ? Number(position.zoom) : 1;
    const zoom = Math.max(1, Math.min(maxZoom, requestedZoom));
    const w = Math.min(bounds.w, bounds.h * aspect) / zoom;
    const h = w / aspect;
    const x = bounds.x + (bounds.w - w) * Math.max(0, Math.min(1, position?.x ?? 0.5));
    const y = bounds.y + (bounds.h - h) * Math.max(0, Math.min(1, position?.y ?? 0.5));
    return { x, y, w, h, retained: w * h / (image.w * image.h), contentBounds: bounds };
}

export function cropStyle(image, crop) {
    return crop ? { position: 'absolute', maxWidth: 'none', width: `${image.w / crop.w * 100}%`,
        height: `${image.h / crop.h * 100}%`, left: `${-crop.x / crop.w * 100}%`,
        top: `${-crop.y / crop.h * 100}%` } : {};
}

