// The Frame Studio's starting demo photo, shown before a user picks their
// own image. It's landscape-shaped — shared as a named constant (rather
// than inlined separately in App.jsx) so CustomizeFramePage's orientation
// auto-detect effect can recognize it and skip overriding the intended
// portrait default with this placeholder's own shape.
const DEFAULT_DEMO_IMAGE_BASE = 'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&q=80&sat=-20&con=-10';
export const getDemoImageForOrientation = (orientation = 'portrait') => (
    orientation === 'square'
        ? `${DEFAULT_DEMO_IMAGE_BASE}&w=1400&h=1400`
        : orientation === 'landscape'
            ? `${DEFAULT_DEMO_IMAGE_BASE}&w=1600&h=1000`
            : `${DEFAULT_DEMO_IMAGE_BASE}&w=1000&h=1600`
);
export const DEFAULT_DEMO_IMAGE = getDemoImageForOrientation('landscape');

// Prices are GHS, calibrated against real Ghana custom-framing market rates
// (~GHS 45 base cost + ~GHS 1.05/sq in), not a straight USD->GHS relabel.
export const FRAME_SIZES = [
    { id: '5x7', width: 5, height: 7, label: '13 x 18 cm', price: 80 },
    { id: '8x10', width: 8, height: 10, label: '20 x 25 cm', price: 130 },
    { id: 'a4', width: 8.27, height: 11.69, label: '21 x 30 cm (A4)', price: 145 },
    { id: '11x14', width: 11, height: 14, label: '28 x 35 cm', price: 205 },
    { id: '12x12', width: 12, height: 12, label: '30 x 30 cm', price: 195 },
    { id: '12x18', width: 12, height: 18, label: '30 x 45 cm', price: 270 },
    { id: 'a3', width: 11.69, height: 16.53, label: '30 x 42 cm (A3)', price: 250 },
    { id: '16x20', width: 16, height: 20, label: '40 x 50 cm', price: 380 },
    { id: 'a2', width: 16.53, height: 23.39, label: '42 x 60 cm (A2)', price: 450 },
    { id: '18x24', width: 18, height: 24, label: '45 x 60 cm', price: 500 },
    { id: '20x30', width: 20, height: 30, label: '50 x 75 cm', price: 675 },
    { id: '24x36', width: 24, height: 36, label: '60 x 90 cm (A1)', price: 950 },

    // Inspiration Sizing Mappings
    { id: 'sm', width: 8, height: 10, label: '20 x 25 cm (Sm)', price: 130 },
    { id: 'md', width: 12, height: 18, label: '30 x 45 cm (Md)', price: 270 },
    { id: 'lg', width: 20, height: 30, label: '50 x 75 cm (Lg)', price: 675 },
    { id: 'xl', width: 24, height: 36, label: '60 x 90 cm (XL)', price: 950 },
    { id: 'lg-land', width: 30, height: 20, label: '75 x 50 cm (Lg-Land)', price: 675 },
    { id: 'xl-land', width: 36, height: 24, label: '90 x 60 cm (XL-Land)', price: 950 },

    // Inspiration Showcase Names
    { id: 'Small', width: 8, height: 10, label: '20 x 25 cm (Small)', price: 130 },
    { id: 'Medium', width: 12, height: 18, label: '30 x 45 cm (Medium)', price: 270 },
    { id: 'Large', width: 18, height: 24, label: '45 x 60 cm (Large)', price: 500 },
    { id: 'Statement', width: 24, height: 36, label: '60 x 90 cm (Statement)', price: 950 },

    // Missing Art & Painting Dimensions
    { id: '20x20cm', width: 8, height: 8, label: '20 x 20 cm', price: 110 },
    { id: '35x50cm', width: 14, height: 20, label: '35 x 50 cm', price: 340 },
    { id: '40x40cm', width: 16, height: 16, label: '40 x 40 cm', price: 315 },
    { id: '50x50cm', width: 20, height: 20, label: '50 x 50 cm', price: 465 },
    { id: '60x60cm', width: 24, height: 24, label: '60 x 60 cm', price: 650 },
    { id: '80x80cm', width: 32, height: 32, label: '80 x 80 cm', price: 1120 },
    { id: '90x90cm', width: 36, height: 36, label: '90 x 90 cm', price: 1405 },
    { id: '100x100cm', width: 40, height: 40, label: '100 x 100 cm', price: 1725 },
    { id: '24x80cm', width: 9.5, height: 31.5, label: '24 x 80 cm', price: 360 },
    { id: '27x80cm', width: 10.5, height: 31.5, label: '27 x 80 cm', price: 390 },
    { id: '65x100cm', width: 26, height: 40, label: '65 x 100 cm', price: 1135 },
    { id: '80x120cm', width: 32, height: 48, label: '80 x 120 cm', price: 1660 },
    { id: '90x120cm', width: 36, height: 48, label: '90 x 120 cm', price: 1860 },
    { id: '70x100cm', width: 28, height: 40, label: '70 x 100 cm', price: 1220 },
    { id: '40x80cm', width: 16, height: 32, label: '40 x 80 cm', price: 585 },
    { id: '50x100cm', width: 20, height: 40, label: '50 x 100 cm', price: 885 },
    { id: '25x100cm', width: 10, height: 40, label: '25 x 100 cm', price: 465 },
    { id: '17x60cm', width: 7, height: 24, label: '17 x 60 cm', price: 220 },
    { id: '25x60cm', width: 10, height: 24, label: '25 x 60 cm', price: 295 },
    { id: '10x60cm', width: 4, height: 24, label: '10 x 60 cm', price: 145 },
    { id: '60x120cm', width: 24, height: 48, label: '60 x 120 cm', price: 1255 },
    { id: '80x110cm', width: 32, height: 44, label: '80 x 110 cm', price: 1525 },
    { id: '50x150cm', width: 20, height: 60, label: '50 x 150 cm', price: 1305 },
    { id: '65x150cm', width: 26, height: 60, label: '65 x 150 cm', price: 1685 },
    { id: '30x90cm', width: 12, height: 36, label: '30 x 90 cm', price: 500 },
    { id: '80x180cm', width: 32, height: 72, label: '80 x 180 cm', price: 2465 },
    { id: '120x120cm', width: 48, height: 48, label: '120 x 120 cm', price: 2465 },
    { id: '70x140cm', width: 28, height: 56, label: '70 x 140 cm', price: 1690 },
    { id: '50x60cm', width: 20, height: 24, label: '50 x 60 cm', price: 550 },
    { id: '60x150cm', width: 24, height: 60, label: '60 x 150 cm', price: 1555 },
    { id: '80x160cm', width: 32, height: 64, label: '80 x 160 cm', price: 2195 },
    { id: '100x150cm', width: 40, height: 60, label: '100 x 150 cm', price: 2565 },
    { id: '150x150cm', width: 60, height: 60, label: '150 x 150 cm', price: 3850 },
    { id: '100x180cm', width: 40, height: 72, label: '100 x 180 cm', price: 3080 },
    { id: '180x180cm', width: 72, height: 72, label: '180 x 180 cm', price: 5550 }
];

export const formatDimensions = (label, unit, orientation) => {
    if (!label) return label;
    
    // Extract base W and H from the label
    let wRaw = null, hRaw = null;
    let isCm = label.toLowerCase().includes('cm');
    
    const dimsMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:x|×|X)\s*(\d+(?:\.\d+)?)/i);
    if (dimsMatch) {
        wRaw = parseFloat(dimsMatch[1]);
        hRaw = parseFloat(dimsMatch[2]);
    }

    if (wRaw !== null && hRaw !== null) {
        // Enforce orientation order (W x H)
        let wFinal = wRaw;
        let hFinal = hRaw;
        if (orientation === 'landscape' && wRaw < hRaw) {
            wFinal = hRaw;
            hFinal = wRaw;
        } else if (orientation === 'portrait' && wRaw > hRaw) {
            wFinal = hRaw;
            hFinal = wRaw;
        }
        
        // Format to target unit
        if (unit === 'in') {
            const wIn = isCm ? Math.round(wFinal / 2.54) : wFinal;
            const hIn = isCm ? Math.round(hFinal / 2.54) : hFinal;
            // Preserve alias tags (like (Lg-Land))
            const aliasMatch = label.match(/\((.*?)\)/);
            const aliasTag = aliasMatch ? ` (${aliasMatch[1]})` : '';
            return `${wIn} × ${hIn} in${aliasTag}`;
        } else {
            // Target unit is cm
            const wCm = isCm ? wFinal : Math.round(wFinal * 2.54);
            const hCm = isCm ? hFinal : Math.round(hFinal * 2.54);
            // Preserve alias tags
            const aliasMatch = label.match(/\((.*?)\)/);
            const aliasTag = aliasMatch ? ` (${aliasMatch[1]})` : '';
            return `${wCm} × ${hCm} cm${aliasTag}`;
        }
    }

    return label;
};

export const findSizeByDimension = (dimsString) => {
    if (!dimsString) return null;
    const nums = dimsString.match(/\d+/g);
    if (!nums || nums.length < 2) return null;
    const [w, h] = nums.map(Number);
    for (const size of FRAME_SIZES) {
        const labelNums = size.label.match(/\d+/g);
        if (labelNums && labelNums.length >= 2) {
            const [lw, lh] = labelNums.map(Number);
            if ((w === lw && h === lh) || (w === lh && h === lw)) {
                // FRAME_SIZES entries are stored portrait-canonical — but the
                // input dims string's own order tells us whether the piece
                // is actually meant to display as landscape (e.g. "90 x 60"
                // matches the same entry as "60 x 90" but needs the opposite
                // orientation), so return that alongside the matched entry.
                return { ...size, orientation: w >= h ? 'landscape' : 'portrait' };
            }
        }
    }
    return null;
};

export const parseCustomSize = (dimsString) => {
    if (!dimsString || dimsString.includes('Gallery')) return null;
    const nums = dimsString.match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) return null;
    const [w, h] = nums.map(Number);
    // Assume cm based on dataset
    const minDim = Math.min(w, h);
    const maxDim = Math.max(w, h);
    return {
        id: `custom-${w}x${h}`,
        width: minDim / 2.54,
        height: maxDim / 2.54,
        label: dimsString,
        price: Math.round(((w * h) / 1000) * 10) + 40, // rough estimate price
        // width/height above are normalized to portrait (min/max) so every
        // custom size fits the app's portrait-canonical convention — but that
        // throws away which of the original dims was the width, so callers
        // need this to know whether to also set orientation to 'landscape'
        // (otherwise a "120 x 60" piece silently renders as 60 x 120).
        orientation: w >= h ? 'landscape' : 'portrait'
    };
};

// Inspiration/Museum/catalogue artwork sizes come from product data via
// parseCustomSize above, which does no bounds checking at all — unlike the
// manual "+ Custom Size" form, which enforces this same 13x18-180x180cm
// range the catalogue and visualizer are built around. A malformed dims
// string (or a genuinely out-of-range piece) would otherwise reach
// checkout/pricing unchecked. Clamps to that range and reports whether it
// had to, so a caller can surface a notice — never touches a size that was
// already valid. Every caller that builds a size from a raw dims string
// (CustomizeFramePage's Inspiration hand-off, WishlistPage's direct
// add-to-cart) must run it through this — duplicating the clamp math
// instead of importing it is exactly how id/price drift happens: the
// server prices a custom size purely from the numbers in its "custom-WxH"
// id, so id, width, height, and price all have to come from the same
// clamped pair or the client and server silently disagree on price.
export const MIN_SHORT_SIZE_CM = 13;
export const MIN_LONG_SIZE_CM = 18;
export const MAX_SIZE_CM = 180;
export const clampSizeToValidRange = (size) => {
    if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
        return { size, wasClamped: false };
    }
    const shortCm = Math.min(size.width, size.height) * 2.54;
    const longCm = Math.max(size.width, size.height) * 2.54;
    const rawClampedShortCm = Math.min(Math.max(shortCm, MIN_SHORT_SIZE_CM), MAX_SIZE_CM);
    const rawClampedLongCm = Math.min(Math.max(longCm, MIN_LONG_SIZE_CM), MAX_SIZE_CM);
    const wasClamped = Math.abs(rawClampedShortCm - shortCm) > 0.01 || Math.abs(rawClampedLongCm - longCm) > 0.01;
    if (!wasClamped) return { size, wasClamped: false };
    // Rounded to whole cm (every real dims string in the catalogue already
    // is one) and id/width/height/price are all derived from this SAME
    // rounded pair — see the module comment above for why that matters.
    const clampedShortCm = Math.round(rawClampedShortCm);
    const clampedLongCm = Math.round(rawClampedLongCm);
    // width/height stay in inches, short-side-first — parseCustomSize's own
    // portrait-normalized convention. orientation is a separate field on
    // the size object and is left exactly as the source page set it.
    return {
        size: {
            ...size,
            id: `custom-${clampedShortCm}x${clampedLongCm}`,
            width: clampedShortCm / 2.54,
            height: clampedLongCm / 2.54,
            price: Math.round(((clampedShortCm * clampedLongCm) / 1000) * 10) + 40,
        },
        wasClamped: true,
        clampedShortCm,
        clampedLongCm,
    };
};

export const MAT_COLORS = [
    { id: 'white', name: 'Polar White', hex: '#ffffff', price: 75, light: true },
    { id: 'ivory', name: 'Warm Ivory', hex: '#f5f2eb', price: 75, light: true },
    { id: 'cream', name: 'Cream Beige', hex: '#e2d7c0', price: 75, light: true },
    { id: 'celadon', name: 'Celadon Green', hex: '#e2ead3', price: 100, light: true },
    { id: 'pale-yellow', name: 'Straw Yellow', hex: '#f9edd0', price: 100, light: true },
    { id: 'black', name: 'Soot Black', hex: '#181818', price: 75, light: false },
    { id: 'navy', name: 'Royal Navy', hex: '#1f4e79', price: 100, light: false },
    { id: 'hunter-green', name: 'Hunter Green', hex: '#1c4436', price: 100, light: false },
    { id: 'terracotta', name: 'Terracotta', hex: '#cf8247', price: 100, light: false },
    { id: 'maroon', name: 'Burgundy Maroon', hex: '#6e2531', price: 100, light: false },
];

export const CATEGORIES = [
    'Featured Frames',
    'Modern & Minimalist',
    'Wood Finishes',
    'Classic & Traditional',
    'Ornate & Antique',
    'Rustic & Distressed',
    'Glossy Finishes',
    'Textured & Decorative',
    'Canvas',
    'Prodigi Classic Frames',
    'Prodigi Box Frames',
    'Prodigi Aluminium Frames',
    'Prodigi Classic Framed Canvas',
    'Prodigi Float Framed Canvas',
    'Prodigi Eco Framed Canvas',
    'Prodigi Stretched Canvas',
];

// Prodigi frames are separate fulfilment products, but use the same picker
// and visualizer record contract as FrameWorthy's existing mouldings.
const PRODIGI_FLOAT_CANVAS_THUMBNAILS = {
    black: '/prodigi/views/canvas-float-black-corner.jpg',
    white: '/prodigi/views/canvas-float-white-corner.jpg',
    'antique-gold': '/prodigi/views/canvas-float-antique-gold-corner.jpg',
    'antique-silver': '/prodigi/views/canvas-float-antique-silver-corner.jpg',
    natural: '/prodigi/views/canvas-float-natural-corner.jpg',
    brown: '/prodigi/views/canvas-float-brown-corner.jpg',
};

// Prodigi publishes Eco product photography for black and white only. The
// remaining finishes use the equivalent photographed floater frame; the Eco
// product record still supplies the recycled canvas material and ECO SKU.
const PRODIGI_ECO_CANVAS_THUMBNAILS = {
    black: '/prodigi/views/canvas-eco-black-corner.jpg',
    white: '/prodigi/views/canvas-eco-white-corner.jpg',
    'antique-gold': '/prodigi/views/canvas-eco-antique-gold-corner.jpg',
    'antique-silver': '/prodigi/views/canvas-eco-antique-silver-corner.jpg',
    natural: '/prodigi/views/canvas-eco-natural-corner.jpg',
    brown: '/prodigi/views/canvas-eco-brown-corner.jpg',
};

const PRODIGI_FRAME_RECORDS = [
    ...['black', 'white', 'natural', 'antique-silver', 'brown', 'antique-gold', 'dark-grey', 'light-grey'].map((color, index) => ({
        id: `prodigi-classic-${color}`,
        name: `Classic · ${color.replace(/(^|-)/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase())}`,
        category: 'Prodigi Classic Frames',
        baseColor: ['#242321', '#f4f1e9', '#b08a5a', '#aaa9a5', '#68472f', '#c4a357', '#555451', '#c3c1bd'][index],
        width: '20px', widthCategory: 'standard', priceMod: 1, type: 'Framed Print',
        desc: 'Solid wood classic frame · Perspex, float glass or Motheye glaze.',
        previewImg: `/prodigi/finishes/classic-${color}.png`, cornerImage: `/prodigi/finishes/classic-${color}.png`, borderImageSource: `/prodigi/finishes/classic-${color}.png`, borderImageSlicePct: 27,
        mouldingWidthIn: 20 / 25.4, rabbetDepthIn: 17 / 25.4, totalDepthIn: 22 / 25.4, renderProfile: 'flat', finish: /gold|silver/.test(color) ? 'metallic' : 'matte', prodigiProduct: 'classic', prodigiColor: ({ 'antique-gold': 'gold', 'antique-silver': 'silver', 'dark-grey': 'dark grey', 'light-grey': 'light grey' }[color] || color),
    })),
    ...['black', 'white', 'natural'].map((color, index) => ({
        id: `prodigi-box-${color}`, name: `Box · ${color[0].toUpperCase()}${color.slice(1)}`, category: 'Prodigi Box Frames',
        baseColor: ['#242321', '#f4f1e9', '#b08a5a'][index], width: '20px', widthCategory: 'standard', priceMod: 1, type: 'Box Frame',
        desc: 'Hand-stained solid wood box frame · 33 mm wall depth.',
        previewImg: `/prodigi/finishes/box-${color}.png`, cornerImage: `/prodigi/finishes/box-${color}.png`, borderImageSource: `/prodigi/finishes/box-${color}.png`, borderImageSlicePct: 27,
        mouldingWidthIn: 20 / 25.4, rabbetDepthIn: 30 / 25.4, totalDepthIn: 33 / 25.4, renderProfile: 'deep', finish: 'matte', prodigiProduct: 'box', prodigiColor: color,
    })),
    ...['black', 'silver', 'gold'].map((color, index) => ({
        id: `prodigi-aluminium-${color}`, name: `Aluminium · ${color[0].toUpperCase()}${color.slice(1)}`, category: 'Prodigi Aluminium Frames',
        baseColor: ['#242321', '#aaa9a5', '#c4a357'][index], width: '10px', widthCategory: 'narrow', priceMod: 1, type: 'Aluminium Frame',
        desc: 'Lightweight aluminium frame · shatterproof Perspex glaze.',
        previewImg: `/prodigi/finishes/aluminium-${color}.png`, cornerImage: `/prodigi/finishes/aluminium-${color}.png`, borderImageSource: `/prodigi/finishes/aluminium-${color}.png`, borderImageSlicePct: 27,
        mouldingWidthIn: 10 / 25.4, rabbetDepthIn: 12 / 25.4, totalDepthIn: 19 / 25.4, renderProfile: 'flat', finish: 'metallic', prodigiProduct: 'aluminium', prodigiColor: color,
    })),
    ...['black', 'white', 'natural', 'antique-silver', 'brown', 'antique-gold', 'dark-grey', 'light-grey'].map((color, index) => ({
        id: `prodigi-classic-canvas-${color}`, name: `Classic Canvas · ${color.replace(/(^|-)/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase())}`,
        category: 'Prodigi Classic Framed Canvas', baseColor: ['#242321', '#f4f1e9', '#b08a5a', '#aaa9a5', '#68472f', '#c4a357', '#555451', '#c3c1bd'][index],
        width: '20px', widthCategory: 'standard', priceMod: 1, type: 'Canvas Frame', desc: '400 gsm cotton canvas in the classic satin-laminated frame.',
        previewImg: `/prodigi/finishes/classic-${color}.png`, cornerImage: `/prodigi/finishes/classic-${color}.png`, borderImageSource: `/prodigi/finishes/classic-${color}.png`, borderImageSlicePct: 27,
        mouldingWidthIn: 20 / 25.4, rabbetDepthIn: 17 / 25.4, totalDepthIn: 22 / 25.4, renderProfile: 'flat', finish: /gold|silver/.test(color) ? 'metallic' : 'matte', prodigiProduct: 'canvas-classic', prodigiColor: ({ 'antique-gold': 'gold', 'antique-silver': 'silver', 'dark-grey': 'dark grey', 'light-grey': 'light grey' }[color] || color), canvasThicknessMm: 19, canvasFrameStyle: 'traditional', isCanvas: true,
    })),
    ...['black', 'white', 'antique-gold', 'antique-silver', 'natural', 'brown'].map((color, index) => ({
        id: `prodigi-float-canvas-${color}`, name: `Float Canvas · ${color.replace(/(^|-)/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase())}`,
        category: 'Prodigi Float Framed Canvas', baseColor: ['#242321', '#f4f1e9', '#c4a357', '#aaa9a5', '#b08a5a', '#68472f'][index],
        width: '12px', widthCategory: 'narrow', priceMod: 1, type: 'Canvas Frame', desc: '38 mm cotton canvas · floating frame with a 5 mm reveal.',
        thumbnailImage: PRODIGI_FLOAT_CANVAS_THUMBNAILS[color],
        previewImg: `/prodigi/finishes/canvas-float-${color}.png`, cornerImage: `/prodigi/finishes/canvas-float-${color}.png`, borderImageSource: `/prodigi/finishes/canvas-float-${color}.png`, borderImageSlicePct: 27,
        mouldingWidthIn: 12 / 25.4, rabbetDepthIn: 40 / 25.4, totalDepthIn: 53 / 25.4, renderProfile: 'floater', finish: /gold|silver/.test(color) ? 'metallic' : 'matte', prodigiProduct: 'canvas-float', prodigiColor: ({ 'antique-gold': 'gold', 'antique-silver': 'silver' }[color] || color), canvasThicknessMm: 38, canvasFrameStyle: 'floater', canvasGapMm: 5, isCanvas: true,
    })),
    ...['black', 'white', 'antique-gold', 'antique-silver', 'natural', 'brown'].map((color, index) => ({
        id: `prodigi-eco-canvas-${color}`, name: `Eco Canvas · ${color.replace(/(^|-)/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase())}`,
        category: 'Prodigi Eco Framed Canvas', baseColor: ['#242321', '#f4f1e9', '#c4a357', '#aaa9a5', '#b08a5a', '#68472f'][index],
        width: '12px', widthCategory: 'narrow', priceMod: 1, type: 'Canvas Frame', desc: '38 mm recycled satin canvas · floating frame with a 5 mm reveal.',
        thumbnailImage: PRODIGI_ECO_CANVAS_THUMBNAILS[color],
        previewImg: `/prodigi/finishes/canvas-eco-${color}.png`, cornerImage: `/prodigi/finishes/canvas-eco-${color}.png`, borderImageSource: `/prodigi/finishes/canvas-eco-${color}.png`, borderImageSlicePct: 27,
        mouldingWidthIn: 12 / 25.4, rabbetDepthIn: 40 / 25.4, totalDepthIn: 53 / 25.4, renderProfile: 'floater', finish: /gold|silver/.test(color) ? 'metallic' : 'matte', prodigiProduct: 'canvas-eco', prodigiColor: ({ 'antique-gold': 'gold', 'antique-silver': 'silver' }[color] || color), canvasThicknessMm: 38, canvasFrameStyle: 'floater', canvasGapMm: 5, isCanvas: true,
    })),
    {
        id: 'prodigi-stretched-canvas', name: 'Stretched Canvas · 38 mm', category: 'Prodigi Stretched Canvas',
        baseColor: '#f4f1e9', width: '0px', widthCategory: 'narrow', priceMod: 1, type: 'Stretched Canvas',
        desc: '400 gsm cotton canvas hand-stretched over 38 mm pine bars.',
        thumbnailImage: '/prodigi/views/stretched-canvas-white-corner.jpg',
        previewImg: '/prodigi/views/stretched-canvas-product.jpg', cornerImage: '/prodigi/views/stretched-canvas-white-corner.jpg',
        mouldingWidthIn: 0, rabbetDepthIn: 38 / 25.4, totalDepthIn: 38 / 25.4, renderProfile: 'flat', finish: 'matte',
        prodigiProduct: 'stretched-canvas', canvasThicknessMm: 38, canvasFrameStyle: 'stretched', canvasOnly: true, isCanvas: true,
    },
];

export const FRAME_STYLES = [...PRODIGI_FRAME_RECORDS];

export const WALL_TEXTURES = [
    { name: 'Clean White', class: 'bg-gray-50' },          // 0: Classic neutral
    { name: 'Warm Gray', class: 'bg-[#C1C1C1]' },          // 1: Warmer, medium gray
    { name: 'Light Greige', class: 'bg-[#D4CFCB]' },       // 2: Popular soft grey/beige blend
    { name: 'Soft Beige', class: 'bg-[#E6E0D4]' },         // 3: Creamy neutral
    { name: 'Dusty Rose', class: 'bg-[#DDAA99]' },         // 4: Subtle pink/nude
    { name: 'Sky Blue', class: 'bg-blue-200' },            // 5: Light and airy common tone
    { name: 'Moss Green', class: 'bg-[#98A38E]' },         // 6: Muted, earthy green
    { name: 'Deep Taupe', class: 'bg-[#8F8783]' },         // 7: Dark brown-gray
    { name: 'Slate Grey', class: 'bg-slate-700' },         // 8: Darker sophisticated grey
    { name: 'Navy Accent', class: 'bg-indigo-900' },       // 9: Bold accent wall
];
