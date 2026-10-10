// Maps a Prodigi frame from the picker plus a FrameWorthy size to the Prodigi
// SKU and attributes to quote and order. Only families in the Prodigi price
// sheet (prodigiCatalog.json) can be ordered; Classic and Aluminium framed
// prints aren't in it yet, so they return null.

// Picker product → catalogue family. Box frames are ordered unmounted with
// the standard Perspex glaze.
const FAMILY_FOR_PRODUCT = {
    box: 'box',
    'canvas-classic': 'canvas-classic',
    'canvas-float': 'canvas-float',
    'canvas-eco': 'canvas-eco',
};

// Picker colour slugs → the colour names the price sheet uses.
const CATALOGUE_COLOR = {
    'antique-gold': 'gold',
    'antique-silver': 'silver',
    'dark-grey': 'dark grey',
    'light-grey': 'light grey',
};

// Canvas edge wrap: Classic canvas only comes with a white edge; float and
// eco default to black, which reads as part of the frame.
const DEFAULT_WRAP = {
    'canvas-classic': 'White',
    'canvas-float': 'Black',
    'canvas-eco': 'Black',
};

// Sizes match regardless of orientation, within a rounding tolerance so A4
// (8.27 × 11.69") matches the sheet's 8.3x11.7".
const SIZE_TOLERANCE_IN = 0.06;

const parseInches = (sizeInches) => {
    const match = /^([\d.]+)x([\d.]+)"?$/.exec(sizeInches || '');
    return match ? [Number(match[1]), Number(match[2])].sort((a, b) => a - b) : null;
};

export const isProdigiOrderable = (frame) => Boolean(FAMILY_FOR_PRODUCT[frame?.prodigiProduct]);

export const prodigiColorFor = (frame) => CATALOGUE_COLOR[frame?.prodigiColor] || frame?.prodigiColor;

/**
 * @param {object[]} products prodigiCatalog.json `products`
 * @returns {{ sku: string, attributes: object, sizeInches: string } | null}
 */
export function findProdigiSku(products, frame, size, destination = 'GB') {
    const family = FAMILY_FOR_PRODUCT[frame?.prodigiProduct];
    const width = Number(size?.width);
    const height = Number(size?.height);
    if (!family || !Number.isFinite(width) || !Number.isFinite(height)) return null;
    const wanted = [width, height].sort((a, b) => a - b);
    const color = prodigiColorFor(frame);
    const wrap = DEFAULT_WRAP[family];

    const product = products.find((item) => {
        if (item.family !== family || !item.markets?.[destination]) return false;
        if (item.options?.color !== color) return false;
        if (wrap && item.options?.wrap !== wrap) return false;
        const dims = parseInches(item.sizeInches);
        return Boolean(dims) && Math.abs(dims[0] - wanted[0]) <= SIZE_TOLERANCE_IN && Math.abs(dims[1] - wanted[1]) <= SIZE_TOLERANCE_IN;
    });
    if (!product) return null;

    const attributes = { color };
    if (wrap) attributes.wrap = wrap;
    return { sku: product.sku, attributes, sizeInches: product.sizeInches };
}

// The price sheet is 3.5 MB, so it's only loaded once a Prodigi frame is
// actually picked, not with the customise page.
let catalogPromise;
const loadCatalog = () => {
    catalogPromise ??= import('./prodigiCatalog.json').then((module) => (module.default || module).products);
    return catalogPromise;
};

export async function resolveProdigiSku(frame, size, destination) {
    if (!isProdigiOrderable(frame)) return null;
    return findProdigiSku(await loadCatalog(), frame, size, destination);
}
