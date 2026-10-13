// Product-page links remain external, but every image below is a reviewed
// local copy prepared from the official asset downloads. This keeps the
// catalogue stable if Prodigi reorganises its CDN and makes the selected
// references available to the renderer without runtime hotlinking.
const localAsset = (path) => `/prodigi/${path}`;

const boxFrameColors = {
    black: localAsset('finishes/box-black.png'),
    white: localAsset('finishes/box-white.png'),
    natural: localAsset('finishes/box-natural.png'),
};

const floatFrameColors = (prefix) => Object.fromEntries([
    ['black', 'black'],
    ['white', 'white'],
    ['gold', 'antique-gold'],
    ['silver', 'antique-silver'],
    ['natural', 'natural'],
    ['brown', 'brown'],
].map(([color, slug]) => [color, localAsset(`finishes/${prefix === 'eco-canvas-float' ? 'canvas-eco' : prefix}-${slug}.png`)]));

const classicFrameColors = {
    black: localAsset('finishes/classic-black.png'),
    white: localAsset('finishes/classic-white.png'),
    natural: localAsset('finishes/classic-natural.png'),
    silver: localAsset('finishes/classic-antique-silver.png'),
    brown: localAsset('finishes/classic-brown.png'),
    gold: localAsset('finishes/classic-antique-gold.png'),
    'dark grey': localAsset('finishes/classic-dark-grey.png'),
    'light grey': localAsset('finishes/classic-light-grey.png'),
};

export const PRODIGI_PRESENTATION = {
    classic: {
        page: 'https://www.prodigi.com/products/wall-art/framed-prints/classic-frames/',
        thumbnail: localAsset('views/classic-corner.jpg'),
        colors: classicFrameColors,
        views: [
            { id: 'product', label: 'Product view', src: localAsset('views/classic-product.jpg') },
            { id: 'corner', label: 'Frame corner', src: localAsset('views/classic-corner.jpg') },
            { id: 'back', label: 'Frame reverse', src: localAsset('views/classic-back.jpg') },
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
        thumbnail: localAsset('views/box-product.jpg'),
        colors: boxFrameColors,
        views: [
            { id: 'product', label: 'Product view', src: localAsset('views/box-product.jpg') },
            { id: 'profile', label: 'Side profile', src: localAsset('views/box-profile.jpg') },
            { id: 'section', label: 'Frame section', src: localAsset('diagrams/box-section.png') },
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
        thumbnail: localAsset('views/aluminium-product.webp'),
        colors: {
            black: localAsset('finishes/aluminium-black.png'),
            silver: localAsset('finishes/aluminium-silver.png'),
            gold: localAsset('finishes/aluminium-gold.png'),
        },
        views: [
            { id: 'product', label: 'Product view', src: localAsset('views/aluminium-product.webp') },
            { id: 'silver', label: 'Silver finish', src: localAsset('views/aluminium-silver.webp') },
            { id: 'gold', label: 'Gold finish', src: localAsset('views/aluminium-gold.webp') },
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
        thumbnail: localAsset('views/canvas-float-corner.jpg'),
        colors: floatFrameColors('canvas-float'),
        views: [
            { id: 'product', label: 'Product view', src: localAsset('views/canvas-float-product.jpg') },
            { id: 'corner', label: 'Frame corner', src: localAsset('views/canvas-float-corner.jpg') },
            { id: 'profile', label: 'Side profile', src: localAsset('views/canvas-float-profile.jpg') },
            { id: 'section', label: 'Frame section', src: localAsset('diagrams/canvas-float-section.png') },
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
        thumbnail: localAsset('views/canvas-classic-product.webp'),
        colors: classicFrameColors,
        views: [
            { id: 'product', label: 'Product view', src: localAsset('views/canvas-classic-product.webp') },
            { id: 'corner', label: 'Frame corner', src: localAsset('views/canvas-classic-corner.webp') },
            { id: 'profile', label: 'Full frame', src: localAsset('views/canvas-classic-profile.webp') },
        ],
        specs: [
            ['Canvas', '19 mm · 400 gsm cotton'], ['Frame', 'Classic satin-laminated picture frame'],
            ['Frame colours', '8 finishes'], ['Print method', 'Latex inks or UVgel'],
            ['Hanging equipment', 'Not included'], ['Production time', 'About 72 hours'], ['File guidance', 'JPG or PDF · 300 dpi recommended'],
        ],
    },
    'canvas-eco': {
        page: 'https://www.prodigi.com/products/wall-art/canvas/framed-canvas/eco-framed-canvas/',
        thumbnail: localAsset('views/canvas-eco-product.webp'),
        colors: floatFrameColors('eco-canvas-float'),
        views: [
            { id: 'product', label: 'Product view', src: localAsset('views/canvas-eco-product.webp') },
            { id: 'detail', label: 'Frame detail', src: localAsset('views/canvas-eco-detail.webp') },
            { id: 'profile', label: 'Frame profile', src: localAsset('views/canvas-eco-profile.webp') },
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
        thumbnail: localAsset('views/stretched-canvas-product.jpg'),
        colors: {},
        views: [
            { id: 'product', label: 'Product view', src: localAsset('views/stretched-canvas-product.jpg') },
            { id: 'corner', label: 'Stretcher-bar corner', src: localAsset('views/stretched-canvas-corner.jpg') },
            { id: 'texture', label: 'Canvas texture', src: localAsset('views/stretched-canvas-texture.jpg') },
            { id: 'white-edge', label: 'White 38 mm edge', src: localAsset('views/stretched-canvas-white-edge.jpg') },
            { id: 'image-wrap', label: 'Image-wrap edge', src: localAsset('views/stretched-canvas-image-wrap.jpg') },
            { id: 'mirror-wrap', label: 'Mirror-wrap edge', src: localAsset('views/stretched-canvas-mirror-wrap.jpg') },
            { id: 'black-wrap', label: 'Black-wrap edge', src: localAsset('views/stretched-canvas-black-wrap.jpg') },
            { id: 'white-wrap', label: 'White-wrap edge', src: localAsset('views/stretched-canvas-white-wrap.jpg') },
            { id: 'blank-mockup', label: 'Blank canvas mockup', src: localAsset('views/stretched-canvas-blank.jpg') },
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
            ['File guidance', 'JPG or PDF · 300 dpi'], ['Colour profile', 'Standard cotton canvas · 400 gsm'],
            ['Fulfilment', 'Global print-on-demand · nearest print lab'], ['Packaging', 'White-label · double-wall corrugated box in GB/EU/US/AU'],
            ['Eco credentials', 'Vegan-friendly; local fulfilment reduces carbon'],
        ],
    },
};

export const PRODIGI_PRODUCT_SOURCES = Object.values(PRODIGI_PRESENTATION).map(({ page }) => page);
