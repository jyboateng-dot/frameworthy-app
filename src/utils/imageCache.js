// Add to Cart needs the full-size artwork as a decoded <img> to draw onto
// canvases. Without sharing, the page's preload, the thumbnail capture and the
// frame-fit output each downloaded and decoded the same (potentially huge)
// original again. This keeps the most recent artwork around so the work is done
// once. It deliberately retains only ONE image: a decoded original can be tens
// of MB, which matters on phones.
const MAX_ENTRIES = 1;
const cache = new Map();

/**
 * Loads an image for canvas use (CORS-enabled) and reuses the in-flight or
 * completed load for the same source. Failed loads are never cached, so a
 * retry fetches again.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageCached(src) {
    const cached = cache.get(src);
    if (cached) {
        // Re-insert so the Map's insertion order tracks recency.
        cache.delete(src);
        cache.set(src, cached);
        return cached;
    }

    const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not load the original image. Please try again.'));
        image.src = src;
    });
    cache.set(src, promise);
    promise.catch(() => {
        if (cache.get(src) === promise) cache.delete(src);
    });
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
    return promise;
}

export const clearImageCache = () => cache.clear();
