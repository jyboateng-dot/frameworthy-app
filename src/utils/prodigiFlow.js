import prodigiCatalog from '../data/prodigiCatalog.json';
import { parseCustomSize } from '../data/constants';

const BOX_FAMILIES = ['box', 'box-mounted', 'box-float', 'box-mounted-float', 'box-motheye', 'box-mounted-motheye'];
const CLASSIC_FAMILIES = ['classic', 'classic-mounted', 'classic-float', 'classic-mounted-float', 'classic-motheye', 'classic-mounted-motheye'];

const sortedDimensions = (size) => [Number(size?.width || 0), Number(size?.height || 0)].sort((a, b) => a - b);

export const PRODIGI_MOUNT_BOARD_THICKNESS_MM = 2.4;
export const PRODIGI_MOUNT_COLORS = [
    { value: 'Snow white', label: 'Snow white', matColorId: 'white', hex: '#ffffff', light: true },
    { value: 'Off-white', label: 'Off-white', matColorId: 'ivory', hex: '#f5f2eb', light: true },
    { value: 'Black', label: 'Black', matColorId: 'black', hex: '#181818', light: false },
];

export const normaliseProdigiMountColor = (value) => {
    const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (compact === 'black') return 'Black';
    if (compact === 'offwhite' || compact === 'hayseed') return 'Off-white';
    return 'Snow white';
};

/**
 * Prodigi fixes the visible mount border from the selected glazing size.
 * `size` uses inches throughout the frame customizer, regardless of the
 * customer's current display unit.
 *
 * A small number of legacy/special products identify a 3-inch mount in the
 * SKU with `3M`; none are in the current GB/JE catalogue, but recognising the
 * marker keeps future imports honest instead of silently rendering them at
 * the standard width.
 */
export const prodigiMountWidthInForSize = (size, product = null) => {
    if (/(?:^|-)3M(?:-|$)/i.test(product?.sku || '')) return 3;
    if (!size) return 2;

    const [shortSideIn, longSideIn] = sortedDimensions(size);
    if (shortSideIn <= 10.08 && longSideIn <= 10.08) return 1;
    if (shortSideIn <= 11.08 && longSideIn <= 14.08) return 1.5;
    return 2;
};

/**
 * Returns Prodigi's exact physical mount width in millimetres (25mm, 38mm, 50mm, 75mm)
 * with no decimal places, matching the manufacturer specifications for UK/JE markets.
 */
export const prodigiMountWidthMmForSize = (size, product = null) => {
    const widthIn = prodigiMountWidthInForSize(size, product);
    if (widthIn === 1) return 25;
    if (widthIn === 1.5) return 38;
    if (widthIn === 2) return 50;
    if (widthIn === 3) return 75;
    return Math.round(widthIn * 25.4);
};

/**
 * Returns a cleanly formatted mount width label respecting the active unit
 * (e.g. "50 mm" or "2\"") with no decimal ambiguity.
 */
export const formatProdigiMountWidth = (size, product = null, unit = 'cm') => {
    const widthIn = prodigiMountWidthInForSize(size, product);
    if (!widthIn) return 'Custom';
    if (unit === 'cm') {
        return `${prodigiMountWidthMmForSize(size, product)} mm`;
    }
    return `${widthIn}"`;
};


const matchesSize = (product, size) => {
    const productInches = String(product?.sizeInches || '').replace(/\s+/g, '').toLowerCase();
    const selectedInches = String(size?.prodigiSizeInches || '').replace(/\s+/g, '').toLowerCase();
    if (productInches && selectedInches && productInches === selectedInches) return true;
    const parsed = parseCustomSize(product?.sizeCm);
    if (!parsed || !size) return false;
    const [productShort, productLong] = sortedDimensions(parsed);
    const [sizeShort, sizeLong] = sortedDimensions(size);
    return Math.abs(productShort - sizeShort) < 0.08 && Math.abs(productLong - sizeLong) < 0.08;
};

export const prodigiFamiliesForFrame = (frame, configuration = {}) => {
    const configurableFamilies = frame?.prodigiProduct === 'box'
        ? { base: 'box', mounted: 'box-mounted', float: 'box-float', mountedFloat: 'box-mounted-float', motheye: 'box-motheye', mountedMotheye: 'box-mounted-motheye' }
        : frame?.prodigiProduct === 'classic'
            ? { base: 'classic', mounted: 'classic-mounted', float: 'classic-float', mountedFloat: 'classic-mounted-float', motheye: 'classic-motheye', mountedMotheye: 'classic-mounted-motheye' }
            : null;
    if (!configurableFamilies) return frame?.prodigiProduct ? [frame.prodigiProduct] : [];
    const mounted = configuration.mounted === true;
    const motheye = configuration.glaze === 'Motheye';
    const floatGlass = configuration.glaze === 'Float glass';
    return [mounted
        ? (motheye ? configurableFamilies.mountedMotheye : floatGlass ? configurableFamilies.mountedFloat : configurableFamilies.mounted)
        : (motheye ? configurableFamilies.motheye : floatGlass ? configurableFamilies.float : configurableFamilies.base)];
};

export const prodigiProductsForFrame = (frame, configuration = null) => {
    if (!frame?.prodigiProduct) return [];
    const families = configuration
        ? prodigiFamiliesForFrame(frame, configuration)
        : frame.prodigiProduct === 'box' ? BOX_FAMILIES
            : frame.prodigiProduct === 'classic' ? CLASSIC_FAMILIES
                : [frame.prodigiProduct];
    return prodigiCatalog.products.filter((product) =>
        families.includes(product.family)
        && (!frame.prodigiColor || product.options.color === frame.prodigiColor)
        && (!configuration?.destinationCountryCode || Boolean(product.markets?.[configuration.destinationCountryCode])));
};

export const prodigiAvailableSizes = (frame, configuration = null) => {
    const seen = new Set();
    return prodigiProductsForFrame(frame, configuration)
        .filter((product) => !configuration?.wrap || product.options.wrap === configuration.wrap)
        .map((product) => ({ product, size: parseCustomSize(product.sizeCm) }))
        .filter(({ size }) => size)
        .sort((a, b) => (a.size.height - b.size.height) || (a.size.width - b.size.width))
        .filter(({ size }) => {
            const key = sortedDimensions(size).map((value) => value.toFixed(3)).join('x');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map(({ product, size }) => ({
            ...size,
            id: `prodigi-${product.sku}`,
            label: `${product.sizeInches} · ${product.sizeCm}`,
            prodigiSizeCm: product.sizeCm,
            prodigiSizeInches: product.sizeInches,
        }));
};

export const nearestProdigiSize = (sizes, currentSize) => {
    if (!sizes.length) return null;
    if (!currentSize) return sizes[Math.min(2, sizes.length - 1)];
    const [short, long] = sortedDimensions(currentSize);
    return [...sizes].sort((a, b) => {
        const [aShort, aLong] = sortedDimensions(a);
        const [bShort, bLong] = sortedDimensions(b);
        return (Math.abs(aShort - short) + Math.abs(aLong - long))
            - (Math.abs(bShort - short) + Math.abs(bLong - long));
    })[0];
};

export const prodigiWrapsForSelection = (frame, size, configuration = {}) => [
    ...new Set(prodigiProductsForFrame(frame, configuration)
        .filter((product) => matchesSize(product, size))
        .map((product) => product.options.wrap)
        .filter(Boolean)),
];

export const resolveProdigiProduct = (frame, size, configuration = {}) => {
    const candidates = prodigiProductsForFrame(frame, configuration).filter((product) => matchesSize(product, size));
    if (!candidates.length) return null;
    let product;
    if (configuration.wrap) {
        const exactWrap = candidates.find((product) => product.options.wrap === configuration.wrap);
        if (exactWrap) product = exactWrap;
    }
    product ||= candidates.find((product) => product.options.wrap === 'ImageWrap')
        || candidates.find((product) => product.options.paper === 'EMA')
        || candidates[0];

    if (configuration.mounted === true && ['box', 'classic'].includes(frame?.prodigiProduct)) {
        const mountColor = normaliseProdigiMountColor(configuration.mountColor || product.options.mountColor);
        return {
            ...product,
            id: `${product.id}::mountColor=${mountColor}`,
            options: { ...product.options, mountColor },
        };
    }
    return product;
};

const normalisedSizeLabel = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();

const FLOAT_SIZE_TO_BASE_SUFFIX = {
    '20X20': '8X8', '20X30': '8X12', '25X50': '10X20', '28X35': '11X14',
    '29X42': 'A3', '30X30': '12X12', '30X40': '12X16', '30X45': '12X18',
    '40X40': '16X16', '40X50': '16X20', '40X60': '16X24', '40X80': '16X32',
    '45X60': '18X24', '50X50': '20X20', A2: 'A2', A3: 'A3', A4: 'A4',
};

const expectedBaseSkuForProduct = (product) => {
    const sku = String(product?.sku || '').toUpperCase();
    const classic = sku.match(/^GLOBAL-CFPM?-MOTH-(.+)$/) || sku.match(/^GLOBAL-CFPM-(.+)$/) || sku.match(/^GLOBAL-CFP-(.+)$/);
    if (classic) return `GLOBAL-CFP-${classic[1]}`;
    const boxMounted = sku.match(/^GLOBAL-BOXM-MOTH-(.+)$/) || sku.match(/^GLOBAL-BOXM-(.+)$/);
    if (boxMounted) {
        const metricSize = boxMounted[1].match(/^(\d{3,})X(\d{3,})$/);
        const suffix = metricSize
            ? metricSize.slice(1).map((part) => Math.round(Number(part) / 25.4)).join('X')
            : boxMounted[1];
        return `GLOBAL-BOX-${suffix}`;
    }
    const box = sku.match(/^GLOBAL-BOX-MOTH-(.+)$/) || sku.match(/^GLOBAL-BOX-(.+)$/);
    if (box) return `GLOBAL-BOX-${box[1]}`;
    const classicFloat = sku.match(/^FRA-CLA-EMA-(?:NM|MOUNT2)-GLA-(.+)$/);
    if (classicFloat) return `GLOBAL-CFP-${FLOAT_SIZE_TO_BASE_SUFFIX[classicFloat[1]] || classicFloat[1]}`;
    const boxFloat = sku.match(/^FRA-BOX-EMA-(?:NM|MOUNT2)-GLA-(.+)$/);
    if (boxFloat) return `GLOBAL-BOX-${FLOAT_SIZE_TO_BASE_SUFFIX[boxFloat[1]] || boxFloat[1]}`;
    return sku;
};

const hasEquivalentPhysicalSize = (candidate, product) => {
    if (normalisedSizeLabel(candidate?.sizeInches) === normalisedSizeLabel(product?.sizeInches)) return true;
    const candidateSize = parseCustomSize(candidate?.sizeCm);
    const productSize = parseCustomSize(product?.sizeCm);
    if (!candidateSize || !productSize) return false;
    const [candidateShort, candidateLong] = sortedDimensions(candidateSize);
    const [productShort, productLong] = sortedDimensions(productSize);
    return Math.abs(candidateShort - productShort) <= 0.35 && Math.abs(candidateLong - productLong) <= 0.35;
};

export const prodigiBaseProductForProduct = (product, destinationCountryCode = 'GB') => {
    if (!product) return null;
    const baseFamily = CLASSIC_FAMILIES.includes(product.family)
        ? 'classic'
        : BOX_FAMILIES.includes(product.family) ? 'box' : product.family;
    const isStandardPrintFrame = product.family === baseFamily
        && String(product.options?.glaze || '').toLowerCase() === 'acrylic / perspex'
        && /^no mount/i.test(product.options?.mount || '')
        && product.options?.paper === 'EMA';
    const isStandardCanvas = product.family === baseFamily && product.options?.wrap === 'ImageWrap';
    if (isStandardPrintFrame || isStandardCanvas) return product;
    const expectedBaseSku = expectedBaseSkuForProduct(product);
    const exactSkuCandidates = prodigiCatalog.products.filter((candidate) =>
        candidate.sku === expectedBaseSku
        && candidate.family === baseFamily
        && (!product.options?.color || candidate.options?.color === product.options.color)
        && Boolean(candidate.markets?.[destinationCountryCode]));
    const exactSkuCandidate = exactSkuCandidates.find((candidate) =>
        baseFamily === 'classic' || baseFamily === 'box'
            ? String(candidate.options?.glaze || '').toLowerCase() === 'acrylic / perspex'
                && /^no mount/i.test(candidate.options?.mount || '')
            : candidate.options?.wrap === 'ImageWrap') || exactSkuCandidates[0];
    if (exactSkuCandidate) return exactSkuCandidate;
    const candidates = prodigiCatalog.products.filter((candidate) =>
        candidate.family === baseFamily
        && candidate.sku
        && hasEquivalentPhysicalSize(candidate, product)
        && (!product.options?.color || candidate.options?.color === product.options.color)
        && Boolean(candidate.markets?.[destinationCountryCode]));
    const exactCandidates = candidates.filter((candidate) =>
        normalisedSizeLabel(candidate.sizeInches) === normalisedSizeLabel(product.sizeInches));
    const preferredCandidates = exactCandidates.length ? exactCandidates : candidates;
    return preferredCandidates.find((candidate) => String(candidate.options?.glaze || '').toLowerCase() === 'acrylic / perspex'
            && /^no mount/i.test(candidate.options?.mount || '')
            && candidate.options?.paper === 'EMA')
        || preferredCandidates.find((candidate) => candidate.options?.wrap === 'ImageWrap')
        || preferredCandidates[0]
        || product;
};

export const resolveProdigiBaseProduct = (frame, size, configuration = {}) => {
    const product = resolveProdigiProduct(frame, size, configuration);
    return prodigiBaseProductForProduct(product, configuration.destinationCountryCode || 'GB');
};

export const prodigiConfigurationFromSelection = (selection) => ({
    mounted: Boolean(selection?.attributes?.mount && !/^no mount/i.test(selection.attributes.mount)),
    mountColor: normaliseProdigiMountColor(selection?.attributes?.mountColor),
    glaze: selection?.attributes?.glaze === 'Motheye'
        ? 'Motheye'
        : selection?.attributes?.glaze === 'Float glass' ? 'Float glass' : 'Acrylic / Perspex',
    wrap: selection?.attributes?.wrap || '',
    destinationCountryCode: selection?.destinationCountryCode || 'GB',
});

export const isProdigiConfigurationAvailable = (frame, size, configuration) =>
    Boolean(resolveProdigiProduct(frame, size, configuration));

export const prodigiHangingHardware = (frame, size) => {
    if (frame?.prodigiProduct === 'aluminium') {
        return {
            id: 'built-in-rear-hanger',
            label: 'Built-in rear hanger',
            description: 'Attached to the frame and ready for wall mounting.',
            included: true,
        };
    }

    if (frame?.prodigiProduct === 'classic' || frame?.prodigiProduct === 'box') {
        const [shortSide, longSide] = sortedDimensions(size);
        const usesCobraHook = shortSide <= (70 / 2.54) && longSide <= (100 / 2.54);
        return usesCobraHook ? {
            id: 'cobra-hook',
            label: 'Cobra hook',
            description: 'Attached to the frame for sizes up to 70 × 100 cm.',
            included: true,
        } : {
            id: 'sawtooth',
            label: 'Sawtooth hanger',
            description: 'Attached to the frame for sizes above 70 × 100 cm.',
            included: true,
        };
    }

    return {
        id: 'none',
        label: 'Not included',
        description: 'Choose hanging hardware and wall fixings suited to your wall.',
        included: false,
    };
};

