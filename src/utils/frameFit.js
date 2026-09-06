export const DEFAULT_POSITION = { x: 0.5, y: 0.5, zoom: 1 };

export function frameGeometry(size, orientation, mat = 'none', rail = 0) {
    const width = orientation === 'landscape' ? size.height : size.width;
    const height = orientation === 'landscape' ? size.width : size.height;
    const border = mat === 'none' ? 0 : Number(mat);
    return { width, height, mat: border, rail, outerWidth: width + rail * 2,
        outerHeight: height + rail * 2, apertureWidth: width - border * 2,
        apertureHeight: height - border * 2 };
}

export function imageCrop(image, geometry, position = DEFAULT_POSITION) {
    if (!image?.w || !image?.h || geometry.apertureWidth <= 0 || geometry.apertureHeight <= 0) return null;
    const aspect = geometry.apertureWidth / geometry.apertureHeight;
    const zoom = Math.max(1, Math.min(3, position.zoom));
    const w = Math.min(image.w, image.h * aspect) / zoom;
    const h = w / aspect;
    const x = (image.w - w) * Math.max(0, Math.min(1, position.x));
    const y = (image.h - h) * Math.max(0, Math.min(1, position.y));
    return { x, y, w, h, retained: w * h / (image.w * image.h) };
}

export function cropStyle(image, crop) {
    return crop ? { position: 'absolute', maxWidth: 'none', width: `${image.w / crop.w * 100}%`,
        height: `${image.h / crop.h * 100}%`, left: `${-crop.x / crop.w * 100}%`,
        top: `${-crop.y / crop.h * 100}%` } : {};
}
