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

