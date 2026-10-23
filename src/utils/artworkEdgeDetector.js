/**
 * Intelligent artwork edge & leftover frame detector.
 *
 * Scans the perimeter of public domain art and museum scans (e.g. The Met,
 * Rijksmuseum, Smithsonian) to detect leftover antique frame mouldings,
 * slip liners, or dark/light scanner margins.
 *
 * Detects borders without intruding on full-bleed original artwork.
 */

export function detectBordersFromImageData(data, width, height, maxSearchPct = 0.08) {
    if (!data || width <= 10 || height <= 10) {
        return { hasLeftoverFrame: false, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
    }

    const maxSearchY = Math.min(Math.floor(height * maxSearchPct), 250);
    const maxSearchX = Math.min(Math.floor(width * maxSearchPct), 250);

    const getPixel = (x, y) => {
        const idx = (y * width + x) * 4;
        return [data[idx], data[idx + 1], data[idx + 2]];
    };

    const getRowStats = (y) => {
        let lumSum = 0;
        const step = Math.max(1, Math.floor(width / 160));
        let count = 0;
        for (let x = 0; x < width; x += step) {
            const [r, g, b] = getPixel(x, y);
            lumSum += (r + g + b) / 3;
            count++;
        }
        const avgLum = lumSum / count;
        let varSum = 0;
        for (let x = 0; x < width; x += step) {
            const [r, g, b] = getPixel(x, y);
            const lum = (r + g + b) / 3;
            varSum += (lum - avgLum) ** 2;
        }
        return { avgLum, variance: varSum / count };
    };

    const getColStats = (x) => {
        let lumSum = 0;
        const step = Math.max(1, Math.floor(height / 160));
        let count = 0;
        for (let y = 0; y < height; y += step) {
            const [r, g, b] = getPixel(x, y);
            lumSum += (r + g + b) / 3;
            count++;
        }
        const avgLum = lumSum / count;
        let varSum = 0;
        for (let y = 0; y < height; y += step) {
            const [r, g, b] = getPixel(x, y);
            const lum = (r + g + b) / 3;
            varSum += (lum - avgLum) ** 2;
        }
        return { avgLum, variance: varSum / count };
    };

    // Sample corner pixels to identify border baseline
    const corner = getPixel(Math.min(2, width - 1), Math.min(2, height - 1));
    const cornerLum = (corner[0] + corner[1] + corner[2]) / 3;
    const isDarkBorder = cornerLum < 24;
    const isLightBorder = cornerLum > 235;

    let top = 0;
    for (let y = 0; y < maxSearchY; y++) {
        const s = getRowStats(y);
        if (isDarkBorder && s.avgLum < 26 && s.variance < 35) { top = y + 1; continue; }
        if (isLightBorder && s.avgLum > 232 && s.variance < 35) { top = y + 1; continue; }
        if (s.variance < 12 && Math.abs(s.avgLum - cornerLum) < 18) { top = y + 1; continue; }
        break;
    }

    let bottom = 0;
    for (let y = height - 1; y >= height - maxSearchY; y--) {
        const s = getRowStats(y);
        if (isDarkBorder && s.avgLum < 26 && s.variance < 35) { bottom = height - y; continue; }
        if (isLightBorder && s.avgLum > 232 && s.variance < 35) { bottom = height - y; continue; }
        if (s.variance < 12 && Math.abs(s.avgLum - cornerLum) < 18) { bottom = height - y; continue; }
        break;
    }

    let left = 0;
    for (let x = 0; x < maxSearchX; x++) {
        const s = getColStats(x);
        if (isDarkBorder && s.avgLum < 26 && s.variance < 35) { left = x + 1; continue; }
        if (isLightBorder && s.avgLum > 232 && s.variance < 35) { left = x + 1; continue; }
        if (s.variance < 12 && Math.abs(s.avgLum - cornerLum) < 18) { left = x + 1; continue; }
        break;
    }

    let right = 0;
    for (let x = width - 1; x >= width - maxSearchX; x--) {
        const s = getColStats(x);
        if (isDarkBorder && s.avgLum < 26 && s.variance < 35) { right = width - x; continue; }
        if (isLightBorder && s.avgLum > 232 && s.variance < 35) { right = width - x; continue; }
        if (s.variance < 12 && Math.abs(s.avgLum - cornerLum) < 18) { right = width - x; continue; }
        break;
    }

    // Require at least ~0.3% inset to qualify as a real border, avoiding 1px rounding noise
    const minInsetY = Math.max(2, Math.floor(height * 0.003));
    const minInsetX = Math.max(2, Math.floor(width * 0.003));

    const finalTop = top >= minInsetY ? top : 0;
    const finalBottom = bottom >= minInsetY ? bottom : 0;
    const finalLeft = left >= minInsetX ? left : 0;
    const finalRight = right >= minInsetX ? right : 0;

    const hasLeftover = (finalTop > 0 || finalBottom > 0 || finalLeft > 0 || finalRight > 0);

    // Add a tiny 0.2% buffer on detected edges to guarantee no remaining seam lines
    const bufferY = hasLeftover ? 0.002 : 0;
    const bufferX = hasLeftover ? 0.002 : 0;

    const insets = {
        top: finalTop > 0 ? Math.min(0.08, finalTop / height + bufferY) : 0,
        bottom: finalBottom > 0 ? Math.min(0.08, finalBottom / height + bufferY) : 0,
        left: finalLeft > 0 ? Math.min(0.08, finalLeft / width + bufferX) : 0,
        right: finalRight > 0 ? Math.min(0.08, finalRight / width + bufferX) : 0,
    };

    return {
        hasLeftoverFrame: hasLeftover,
        insets,
    };
}

/**
 * Loads and analyzes an image source for leftover frame borders.
 */
export async function detectArtworkContentBounds(imageSource) {
    if (typeof window === 'undefined' || !imageSource) {
        return { hasLeftoverFrame: false, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
    }
    try {
        let img = null;
        if (typeof imageSource === 'string') {
            img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageSource;
            });
        } else if (imageSource instanceof HTMLImageElement || imageSource instanceof Image) {
            img = imageSource;
        }

        if (!img || !img.naturalWidth || !img.naturalHeight) {
            return { hasLeftoverFrame: false, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
        }

        const maxDim = 400;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(10, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(10, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return { hasLeftoverFrame: false, insets: { top: 0, bottom: 0, left: 0, right: 0 } };

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return detectBordersFromImageData(imageData.data, canvas.width, canvas.height);
    } catch {
        return { hasLeftoverFrame: false, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
    }
}

/**
 * Computes the pixel bounds of clean artwork given the image dimensions and insets.
 */
export function computeCleanArtworkBounds(imageSize, insets) {
    if (!imageSize?.w || !imageSize?.h || !insets) {
        return null;
    }
    const top = Number(insets.top) || 0;
    const bottom = Number(insets.bottom) || 0;
    const left = Number(insets.left) || 0;
    const right = Number(insets.right) || 0;

    if (top <= 0 && bottom <= 0 && left <= 0 && right <= 0) {
        return { x: 0, y: 0, w: imageSize.w, h: imageSize.h };
    }

    const x = Math.round(left * imageSize.w);
    const y = Math.round(top * imageSize.h);
    const w = Math.max(1, Math.round((1 - left - right) * imageSize.w));
    const h = Math.max(1, Math.round((1 - top - bottom) * imageSize.h));

    return { x, y, w, h };
}
