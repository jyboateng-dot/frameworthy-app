// Server-side price recomputation.
//
// Why this exists: verifyPaystackPayment used to check only that the amount
// paid matched `order.totalPrice` — but the client writes that field, so a
// tampered client could create an order claiming totalPrice: 1, pay GHS 1,
// and have it verified as fully paid. Nothing else validated it: firestore
// rules only enforce paymentStatus == 'pending' on create.
//
// So the price is recomputed here from the order's *configuration* (size id,
// frame id, mat colour id, glazing, hardware, quantity, promo code), using
// prices from pricing-data.json rather than any number the client supplied.
//
// pricing-data.json is generated from the client's own source of truth by
// `npm run generate:pricing` — rerun it whenever prices change, or verified
// payments will start failing on legitimate orders.

const data = require('./pricing-data.json');

// Mirrors parseCustomSize() in src/data/constants.jsx: custom sizes aren't in
// the price table, but their id encodes the centimetre dimensions and the
// price is a pure function of them, so it's reproducible without trusting
// the client's stated price.
const customSizePrice = (sizeId) => {
    const match = /^custom-(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(sizeId || '');
    if (!match) return null;
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    // Guard against absurd dimensions being used to fabricate a price.
    if (w > 500 || h > 500) return null;
    return Math.round(((w * h) / 1000) * 10) + 40;
};

const isProdigiItem = (item) => {
    const frameId = item?.selectedFrame?.id;
    return Boolean(item?.prodigiQuoteId) || (typeof frameId === 'string' && frameId.startsWith('prodigi-'));
};

// A Prodigi item's unit price is the GHS total of the quote it was added to
// the cart with (one copy, shipping included). The quote is looked up by the
// caller (it lives in Firestore) and must ship to the order's country.
const prodigiUnitPrice = (item, order, prodigiQuotes) => {
    const quote = prodigiQuotes?.[item?.prodigiQuoteId];
    if (!quote || !Number.isFinite(quote.totalGhs)) return null;
    if (quote.destinationCountryCode !== order?.shippingAddress?.countryCode) return null;
    return quote.totalGhs;
};

const sizePriceFor = (sizeId) => {
    if (sizeId && Object.prototype.hasOwnProperty.call(data.sizePrices, sizeId)) {
        return data.sizePrices[sizeId];
    }
    return customSizePrice(sizeId);
};

// Mirrors buildCartItem() in src/pages/framing/CustomizeFramePage.jsx — that
// is what actually sets item.totalPrice, so this must match it exactly.
// Returns null if the item references anything not in the price table, so the
// caller can fail closed rather than silently under-charging.
const priceForItem = (item) => {
    const frameId = item?.selectedFrame?.id;
    const sizeId = item?.selectedSize?.id;

    // Prodigi frames are priced from a stored Prodigi quote (see
    // prodigiUnitPrice below), not from this table. Their pricing-data.json
    // entries only exist to keep the table in sync with FRAME_STYLES.
    if (isProdigiItem(item)) return null;

    const sizePrice = sizePriceFor(sizeId);
    if (sizePrice === null || sizePrice === undefined) return null;

    const priceMod = Object.prototype.hasOwnProperty.call(data.framePriceMods, frameId)
        ? data.framePriceMods[frameId]
        : null;
    if (priceMod === null) return null;

    const glassType = item?.glassType;
    const matWidth = item?.matWidth;
    const hardwareType = item?.hardwareType;
    const isCanvasFrame = frameId === 'frame-canvas';
    const isCanvasGlazing = glassType === 'canvas-floater' || glassType === 'canvas-traditional';

    let total = Math.round(sizePrice * (priceMod || 1));

    if (!isCanvasFrame && !isCanvasGlazing && matWidth && matWidth !== 'none') {
        const matId = item?.matColor?.id;
        // Falls back to 75 exactly as the client does when a mat colour has
        // no price, rather than rejecting the order.
        const matPrice = Object.prototype.hasOwnProperty.call(data.matPrices, matId)
            ? data.matPrices[matId]
            : 75;
        total += matPrice;
    }

    if (!isCanvasFrame) {
        if (glassType === 'non-glare') total += 100;
        else if (glassType === 'museum') total += 200;
        if (glassType === 'canvas-floater') total += 400;
        else if (glassType === 'canvas-traditional') total += 350;
    }

    if (hardwareType === 'french-cleat') total += 50;

    return total;
};

// Mirrors calculatePromoDiscount() in src/utils/pricing.js, but resolves the
// code against the server's own table so a client can't invent a discount or
// inflate an existing one.
const discountFor = (promoCode, subtotal) => {
    if (!promoCode) return 0;
    const promo = data.promoCodes[String(promoCode).trim().toUpperCase()];
    if (!promo) return null; // unknown code — fail closed
    return promo.type === 'percent'
        ? subtotal * (promo.value / 100)
        : Math.min(promo.value, subtotal);
};

/**
 * Recomputes what an order should cost from its configuration alone.
 * `prodigiQuotes` maps quote id → stored quote for any Prodigi items.
 * @returns {{ total: number } | { error: string }}
 */
const recomputeOrderTotal = (order, { prodigiQuotes = {} } = {}) => {
    const items = Array.isArray(order?.items) ? order.items : null;
    if (!items || items.length === 0) return { error: 'Order has no items' };

    // Prodigi items ship from the UK and local frames from Ghana, so one
    // order (one delivery address) can't hold both. Checkout prevents this.
    const prodigiCount = items.filter(isProdigiItem).length;
    if (prodigiCount > 0 && prodigiCount < items.length) {
        return { error: 'Order mixes Prodigi and local items' };
    }

    let subtotal = 0;
    for (const item of items) {
        const unitPrice = isProdigiItem(item)
            ? prodigiUnitPrice(item, order, prodigiQuotes)
            : priceForItem(item);
        if (unitPrice === null) {
            return { error: `Unrecognised product configuration (frame=${item?.selectedFrame?.id}, size=${item?.selectedSize?.id})` };
        }
        // Only a missing quantity defaults to 1 — `Number(x) || 1` would also
        // silently turn an explicit 0 into 1, skipping the check below.
        const rawQuantity = item?.quantity === undefined || item?.quantity === null ? 1 : item.quantity;
        const quantity = Number(rawQuantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
            return { error: `Invalid quantity: ${item?.quantity}` };
        }
        subtotal += unitPrice * quantity;
    }

    const discount = discountFor(order?.promoCode, subtotal);
    if (discount === null) return { error: `Unknown promo code: ${order?.promoCode}` };

    return { total: Math.max(0, subtotal - discount) };
};

module.exports = { recomputeOrderTotal, priceForItem, discountFor, customSizePrice, isProdigiItem };
