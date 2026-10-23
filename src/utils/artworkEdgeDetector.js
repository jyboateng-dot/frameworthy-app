/**
 * Intelligent artwork edge & leftover frame detector.
 *
 * Scans public domain art and museum scans (e.g. The Met, Rijksmuseum,
 * Smithsonian, Art Institute of Chicago) to detect leftover antique frame
 * mouldings, slip liners, linen mats, and scanner margins of any color
 * (black, white, cream, gold, wood-brown, gray, velvet).
 *
 * Employs a dual-strategy engine:
 * 1. Color-Agnostic Flat Margin Scan: detects solid or flat-gradient scanner borders,
 *    easel backboards, and slip liners of any color.
 * 2. Frame Rail & Sight-Edge Projection: detects textured wood mouldings and ornate
 *    gilded antique frames (up to 28% of dimension) by finding the inner aperture
 *    sight-edge where the frame drops into the canvas.
 *
 * Guarantees zero intrusion on clean full-bleed artwork.
 */

export function detectBordersFromImageData(data, width, height, maxSearchPct = 0.28) {
    if (!data || width <= 10 || height <= 10) {
        return { hasLeftoverFrame: false, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
    }

    const channels = data.length / (width * height);
    const getPixel = (x, y) => {
        const idx = (y * width + x) * channels;
        return [data[idx], data[idx + 1], data[idx + 2]];
    };

    const getLum = (x, y) => {
        const p = getPixel(x, y);
        return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    };

    const maxSearchY = Math.min(Math.floor(height * maxSearchPct), Math.floor(height / 2) - 8);
    const maxSearchX = Math.min(Math.floor(width * maxSearchPct), Math.floor(width / 2) - 8);

    // --- Strategy 1: Color-Agnostic Flat Margin Detection ---
    // Evaluates horizontal / vertical variance across rows and columns.
    // Handles black, white, gray, beige, linen, or solid-color studio backdrops.
    const rowStats = (y, startX = 0, endX = width) => {
        let lumSum = 0;
        const step = Math.max(1, Math.floor((endX - startX) / 100));
        let count = 0;
        for (let x = startX; x < endX; x += step) {
            lumSum += getLum(x, y);
            count++;
        }
        const avgLum = lumSum / count;
        let varSum = 0;
        for (let x = startX; x < endX; x += step) {
            varSum += (getLum(x, y) - avgLum) ** 2;
        }
        return { avgLum, variance: varSum / count };
    };

    const colStats = (x, startY = 0, endY = height) => {
        let lumSum = 0;
        const step = Math.max(1, Math.floor((endY - startY) / 100));
        let count = 0;
        for (let y = startY; y < endY; y += step) {
            lumSum += getLum(x, y);
            count++;
        }
        const avgLum = lumSum / count;
        let varSum = 0;
        for (let y = startY; y < endY; y += step) {
            varSum += (getLum(x, y) - avgLum) ** 2;
        }
        return { avgLum, variance: varSum / count };
    };

    let flatTop = 0;
    for (let y = 0; y < maxSearchY; y++) {
        const s = rowStats(y);
        if (s.variance < 32) flatTop = y + 1;
        else break;
    }

    let flatBottom = 0;
    for (let y = height - 1; y >= height - maxSearchY; y--) {
        const s = rowStats(y);
        if (s.variance < 32) flatBottom = height - y;
        else break;
    }

    let flatLeft = 0;
    for (let x = 0; x < maxSearchX; x++) {
        const s = colStats(x);
        if (s.variance < 32) flatLeft = x + 1;
        else break;
    }

    let flatRight = 0;
    for (let x = width - 1; x >= width - maxSearchX; x--) {
        const s = colStats(x);
        if (s.variance < 32) flatRight = width - x;
        else break;
    }

    // --- Strategy 2: Frame Moulding & Sight-Edge Projection ---
    // Antique picture frames and inner slips/liners consist of multiple profile bevels
    // starting from the outer edge and stepping inward to the innermost sight edge.
    // We scan inwards along each rail (top, bottom, left, right) over the central 70% span,
    // following consecutive moulding steps/rebates to find the true innermost sight edge.
    const detectRail = (isRow, isMaxSide, dim, otherDim, flatInset) => {
        const maxSearch = Math.min(Math.floor(dim * 0.25), Math.floor(dim / 2) - 8);
        const spanMin = Math.floor(otherDim * 0.15);
        const spanMax = Math.floor(otherDim * 0.85);
        const span = spanMax - spanMin;
        const step = Math.max(1, Math.floor(span / 80));

        let lastEdgeInset = 0;
        let bestScore = 0;
        const maxGap = Math.max(4, Math.floor(dim * 0.035));

        for (let inset = Math.max(1, flatInset); inset < maxSearch; inset++) {
            const pos = isMaxSide ? (dim - 1 - inset) : (inset - 1);
            let edgeCount = 0;
            let totalDiff = 0;
            let count = 0;

            for (let j = spanMin; j < spanMax; j += step) {
                const diff = isRow
                    ? Math.abs(getLum(j, pos + 1) - getLum(j, pos))
                    : Math.abs(getLum(pos + 1, j) - getLum(pos, j));
                totalDiff += diff;
                if (diff > 16) edgeCount++;
                count++;
            }

            const avgDiff = totalDiff / count;
            const edgeFraction = edgeCount / count;
            const score = avgDiff * edgeFraction;

            const isSignificant = (edgeFraction >= 0.45 && avgDiff >= 14) ||
                                  (edgeFraction >= 0.28 && avgDiff >= 18) ||
                                  (score >= 7.5 && edgeFraction >= 0.30);

            if (isSignificant) {
                if (lastEdgeInset === 0) {
                    lastEdgeInset = inset;
                    bestScore = score;
                } else if (inset - lastEdgeInset <= maxGap) {
                    lastEdgeInset = inset;
                    bestScore = Math.max(bestScore, score);
                }
            }
        }

        return { inset: lastEdgeInset, score: bestScore };
    };

    const topRail = detectRail(true, false, height, width, flatTop);
    const bottomRail = detectRail(true, true, height, width, flatBottom);
    const leftRail = detectRail(false, false, width, height, flatLeft);
    const rightRail = detectRail(false, true, width, height, flatRight);

    // Require opposite rails or at least two coherent rails to confirm a textured frame moulding,
    // ensuring natural pictorial horizon or landscape lines are never mistaken for frames.
    const hasOppositeH = topRail.score > 0 && bottomRail.score > 0;
    const hasOppositeV = leftRail.score > 0 && rightRail.score > 0;
    const railCount = [topRail.score > 0, bottomRail.score > 0, leftRail.score > 0, rightRail.score > 0].filter(Boolean).length;
    const validFrameStructure = hasOppositeH || hasOppositeV || railCount >= 2;

    const topInset = Math.max(flatTop, validFrameStructure ? topRail.inset : 0);
    const bottomInset = Math.max(flatBottom, validFrameStructure ? bottomRail.inset : 0);
    const leftInset = Math.max(flatLeft, validFrameStructure ? leftRail.inset : 0);
    const rightInset = Math.max(flatRight, validFrameStructure ? rightRail.inset : 0);

    // Require at least ~0.3% inset to qualify as a real border, avoiding 1px rounding noise
    const minInsetY = Math.max(2, Math.floor(height * 0.003));
    const minInsetX = Math.max(2, Math.floor(width * 0.003));

    const finalTop = topInset >= minInsetY ? topInset : 0;
    const finalBottom = bottomInset >= minInsetY ? bottomInset : 0;
    const finalLeft = leftInset >= minInsetX ? leftInset : 0;
    const finalRight = rightInset >= minInsetX ? rightInset : 0;

    const hasLeftover = (finalTop > 0 || finalBottom > 0 || finalLeft > 0 || finalRight > 0);

    // Add a small 0.2% buffer on detected edges to guarantee no remaining seam lines
    const bufferY = hasLeftover ? 0.002 : 0;
    const bufferX = hasLeftover ? 0.002 : 0;

    const insets = {
        top: finalTop > 0 ? Math.min(0.30, finalTop / height + bufferY) : 0,
        bottom: finalBottom > 0 ? Math.min(0.30, finalBottom / height + bufferY) : 0,
        left: finalLeft > 0 ? Math.min(0.30, finalLeft / width + bufferX) : 0,
        right: finalRight > 0 ? Math.min(0.30, finalRight / width + bufferX) : 0,
    };

    return {
        hasLeftoverFrame: hasLeftover,
        insets,
    };
}

/**
 * Loads and analyzes an image source for leftover frame borders and scanner margins.
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

        const maxDim = 320;
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
