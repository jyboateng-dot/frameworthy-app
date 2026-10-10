const productImage = (path) => `https://www.prodigi.com/${path}`;

const boxFrameColors = {
    black: productImage('download/product-range/box-frames/Box%20black%20framed%20print%20chevron.jpg'),
    white: productImage('download/product-range/box-frames/Box%20white%20framed%20print%20chevron.jpg'),
    natural: productImage('download/product-range/box-frames/Box%20natural%20framed%20print%20chevron.jpg'),
};

const floatFrameColors = (prefix) => Object.fromEntries([
    ['black', 'black'],
    ['white', 'white'],
    ['gold', 'antique-gold'],
    ['silver', 'antique-silver'],
    ['natural', 'natural'],
    ['brown', 'brown'],
].map(([color, slug]) => [color, productImage(`img/products/chevrons/${prefix}-${slug}.png`)]));

const classicFrameColors = {
    black: productImage('img/products/chevrons/classic-black.png'),
    white: productImage('img/products/chevrons/classic-white.png'),
    natural: productImage('img/products/chevrons/classic-natural.png'),
    silver: productImage('img/products/chevrons/classic-antique-silver.png'),
    brown: productImage('img/products/chevrons/classic-brown.png'),
    gold: productImage('img/products/chevrons/classic-antique-gold.png'),
    'dark grey': productImage('img/products/chevrons/classic-dark-grey.png'),
    'light grey': productImage('img/products/chevrons/classic-light-grey.png'),
};

const boxDirectory = 'download/product-range/box-frames/';
const floatDirectory = 'download/product-range/framed-canvas/';
const classicDirectory = 'img/products/additional/classic-framed-canvas/';
const ecoDirectory = 'img/products/additional/eco-framed-canvas/';
const aluminiumDirectory = 'img/products/additional/aluminium-frames/';
const stretchedCanvasDirectory = 'download/product-range/stretched-canvas/';

export const PRODIGI_PRESENTATION = {
    classic: {
        page: 'https://www.prodigi.com/products/wall-art/framed-prints/classic-frames/',
        thumbnail: productImage('download/product-range/classic-frames/Classic%20black%20framed%20print%20near%20corner.jpg'),
        colors: classicFrameColors,
        views: [
            { id: 'product', label: 'Product view', src: productImage('download/product-range/classic-frames/Classic%20black%20framed%20print%20flat.jpg') },
            { id: 'corner', label: 'Frame corner', src: productImage('download/product-range/classic-frames/Classic%20black%20framed%20print%20near%20corner.jpg') },
            { id: 'back', label: 'Frame reverse', src: productImage('download/product-range/classic-frames/Prodigi-classic-frame-back.jpg') },
        ],
        specs: [
            ['Frame face', '20 mm'], ['Depth from wall', '22 mm'], ['Rebate', '5 mm wide · 17 mm deep'],
            ['Frame material', 'Satin-laminated wood'], ['Print', 'Giclée · 5 paper types'], ['Mount', 'Optional · 2.4 mm conservation board'],
            ['Glazing', 'Perspex, float glass or Motheye'], ['Frame colours', '8 finishes'],
            ['Hanging', 'Cobra hook ≤70 × 100 cm; sawtooth above'], ['Production time', 'About 72 hours'],
        ],
    },
    box: {
        page: 'https://www.prodigi.com/products/wall-art/framed-prints/box-frames/',
        thumbnail: productImage(`${boxDirectory}Box%20black%20framed%20print%20face%20on.jpg`),
        colors: boxFrameColors,
        views: [
            { id: 'product', label: 'Product view', src: productImage(`${boxDirectory}Box%20black%20framed%20print%20face%20on.jpg`) },
            { id: 'profile', label: 'Side profile', src: productImage(`${boxDirectory}Box%20black%20framed%20print%20end%20on.jpg`) },
            { id: 'section', label: 'Frame section', src: productImage(`${boxDirectory}Box%20frame%20cross-section.png`) },
        ],
        specs: [
            ['Frame face', '20 mm'], ['Depth from wall', '33 mm'], ['Rebate', '8 mm wide · 30 mm deep'],
            ['Frame material', 'Hand-stained wood'], ['Print', 'Giclée · 5 paper types'], ['Mount', 'Optional · 2.4 mm conservation board'],
            ['Mount colours', 'Snow white, black, off-white'], ['Glazing', 'Perspex, float glass or Motheye'], ['Frame colours', 'Black, white, natural'],
            ['Assembly', 'Delivered fully assembled'], ['Hanging', 'Cobra hook ≤70 × 100 cm; sawtooth above'], ['Production time', 'About 72 hours'],
            ['File guidance', 'JPG or PDF · 300 dpi recommended'],
        ],
    },
    aluminium: {
        page: 'https://www.prodigi.com/products/wall-art/framed-prints/aluminium-frames/',
        thumbnail: productImage(`${aluminiumDirectory}prodigi-black-aluminium-frame.webp`),
        colors: {
            black: productImage('img/products/chevrons/aluminium-black.png'),
            silver: productImage('img/products/chevrons/aluminium-silver.png'),
            gold: productImage('img/products/chevrons/aluminium-gold.png'),
        },
        views: [
            { id: 'product', label: 'Product view', src: productImage(`${aluminiumDirectory}prodigi-black-aluminium-frame.webp`) },
            { id: 'silver', label: 'Silver finish', src: productImage('img/products/chevrons/aluminium-silver.png') },
            { id: 'gold', label: 'Gold finish', src: productImage('img/products/chevrons/aluminium-gold.png') },
        ],
        specs: [
            ['Frame face', '10 mm'], ['Depth from wall', '19 mm'], ['Rebate depth', '12 mm'],
            ['Frame material', 'Lightweight aluminium'], ['Print', '200 gsm enhanced matte · Giclée'],
            ['Glazing', 'Shatterproof Perspex'], ['Frame colours', 'Black, silver, gold'],
            ['Hanging', 'Built-in rear hanger'], ['Production time', 'About 72 hours'],
        ],
    },
    'canvas-float': {
        page: 'https://www.prodigi.com/products/wall-art/canvas/framed-canvas/framed-canvas/',
        thumbnail: productImage(`${floatDirectory}Black%20framed%20canvas%20near%20corner.jpg`),
        colors: floatFrameColors('canvas-float'),
        views: [
            { id: 'product', label: 'Product view', src: productImage(`${floatDirectory}White%20framed%20canvas.jpg`) },
            { id: 'corner', label: 'Frame corner', src: productImage(`${floatDirectory}Black%20framed%20canvas%20near%20corner.jpg`) },
            { id: 'profile', label: 'Side profile', src: productImage(`${floatDirectory}Canvas%20framed%20black%20end-on.jpg`) },
            { id: 'section', label: 'Frame section', src: productImage(`${floatDirectory}Framed%20canvas%20cross-section.png`) },
        ],
        specs: [
            ['Canvas', '38 mm · 400 gsm cotton'], ['Frame face', '12 mm'], ['Shadow gap', '5 mm'],
            ['Base width', '32 mm'], ['Depth from wall', '53 mm'], ['Rebate depth', '40 mm'],
            ['Frame material', 'Wood'], ['Frame colours', 'Black, white, antique gold/silver, natural, brown'],
            ['Print method', 'Latex inks or UVgel'], ['Hanging equipment', 'Not included'], ['Production time', 'About 72–120 hours'],
        ],
    },
    'canvas-classic': {
        page: 'https://www.prodigi.com/products/wall-art/canvas/framed-canvas/classic-framed-canvas/',
        thumbnail: productImage(`${classicDirectory}prodigi-classic-framed-19mm-canvas-natural.webp`),
        colors: classicFrameColors,
        views: [
            { id: 'product', label: 'Product view', src: productImage(`${classicDirectory}classic-frame-canvas-woman-print-a_.webp`) },
            { id: 'corner', label: 'Frame corner', src: productImage(`${classicDirectory}prodigi-classic-framed-canvas-19mm-corner.webp`) },
            { id: 'profile', label: 'Full frame', src: productImage(`${classicDirectory}framed-canvas-19mm-full.webp`) },
        ],
        specs: [
            ['Canvas', '19 mm · 400 gsm cotton'], ['Frame', 'Classic satin-laminated picture frame'],
            ['Frame colours', '8 finishes'], ['Print method', 'Latex inks or UVgel'],
            ['Hanging equipment', 'Not included'], ['Production time', 'About 72 hours'], ['File guidance', 'JPG or PDF · 300 dpi recommended'],
        ],
    },
    'canvas-eco': {
        page: 'https://www.prodigi.com/products/wall-art/canvas/framed-canvas/eco-framed-canvas/',
        thumbnail: productImage(`${ecoDirectory}eco-framed-canvas_3.webp`),
        colors: floatFrameColors('eco-canvas-float'),
        views: [
            { id: 'product', label: 'Product view', src: productImage(`${ecoDirectory}eco-framed-canvas_3.webp`) },
            { id: 'detail', label: 'Frame detail', src: productImage(`${ecoDirectory}eco-framed-canvas_2.webp`) },
            { id: 'profile', label: 'Frame profile', src: productImage(`${ecoDirectory}eco-framed-canvas_1.webp`) },
        ],
        specs: [
            ['Canvas', '38 mm · 330 gsm satin'], ['Canvas material', 'Recycled plastic bottles'], ['Frame face', '12 mm'],
            ['Shadow gap', '5 mm'], ['Base width', '32 mm'], ['Depth from wall', '53 mm'], ['Rebate depth', '40 mm'],
            ['Frame material', 'Wood'], ['Frame colours', 'Black, white, antique gold/silver, natural, brown'],
            ['Print method', 'Latex inks or UVgel'], ['Hanging equipment', 'Not included'], ['Production time', 'About 72–120 hours'],
            ['File guidance', 'JPG or PDF · 300 dpi recommended'],
        ],
    },
    'stretched-canvas': {
        page: 'https://www.prodigi.com/products/wall-art/canvas/stretched-canvas/stretched-canvas/',
        thumbnail: productImage(`${stretchedCanvasDirectory}Stretched%2038mm%20canvas%20corner.jpg`),
        colors: {},
        views: [
            { id: 'product', label: 'Product view', src: productImage(`${stretchedCanvasDirectory}Stretched%2038mm%20canvas.jpg`) },
            { id: 'corner', label: 'Stretcher-bar corner', src: productImage(`${stretchedCanvasDirectory}Stretched%2038mm%20canvas%20corner.jpg`) },
            { id: 'texture', label: 'Canvas texture', src: productImage(`${stretchedCanvasDirectory}Canvas-substrate-texture.jpg`) },
            { id: 'white-edge', label: 'White 38 mm edge', src: productImage(`${stretchedCanvasDirectory}White%20edge%2038mm%20canvas.jpg`) },
            { id: 'image-wrap', label: 'Image-wrap edge', src: productImage(`${stretchedCanvasDirectory}Image%20wrap%20on%20a%2038mm%20stretched%20canvas.jpg`) },
            { id: 'mirror-wrap', label: 'Mirror-wrap edge', src: productImage(`${stretchedCanvasDirectory}Mirror%20wrap%20on%20a%2038mm%20stretched%20canvas.jpg`) },
            { id: 'black-wrap', label: 'Black-wrap edge', src: productImage(`${stretchedCanvasDirectory}Black%20wrap%20on%20a%2038mm%20stretched%20canvas.jpg`) },
            { id: 'white-wrap', label: 'White-wrap edge', src: productImage(`${stretchedCanvasDirectory}White%20wrap%20on%20a%2038mm%20stretched%20canvas.jpg`) },
            { id: 'blank-mockup', label: 'Blank canvas mockup', src: productImage(`${stretchedCanvasDirectory}Prodigi-global-canvas-8x10-blank.jpg`) },
        ],
        downloads: [
            { label: 'Stretched canvas product sheet (PDF)', href: 'https://www.prodigi.com/download/product-range/Prodigi%20Stretched%20canvas.pdf' },
            { label: 'Full product photography asset bundle (ZIP)', href: 'https://www.prodigi.com/download/product-range/stretched-canvas/prodigi-stretched-canvas-photo-assets.zip' },
        ],
        specs: [
            ['Canvas', '400 gsm artist-grade cotton'], ['Stretcher bar', '38 mm standard stretcher bar'],
            ['Stretcher material', 'European kiln-dried knotless pine'], ['Edge finishes', 'Image wrap, mirror wrap, black or white'],
            ['Finish', 'Hand stretched and finished'], ['Display permanence', 'Up to 200 years'],
            ['Print method', 'Latex inks or UVgel'], ['Hanging equipment', 'Not included'],
            ['File guidance', 'JPG or PDF · 300 dpi'], ['Colour profile', 'Prodigi Standard Canvas · 400 gsm'],
            ['Fulfilment', 'Global print-on-demand · nearest print lab'], ['Packaging', 'White-label · double-wall corrugated box in GB/EU/US/AU'],
            ['Eco credentials', 'Vegan-friendly; local fulfilment reduces carbon'],
        ],
    },
};

export const PRODIGI_PRODUCT_SOURCES = Object.values(PRODIGI_PRESENTATION).map(({ page }) => page);
