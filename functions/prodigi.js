// Prodigi (print-and-frame fulfilment) API client.
//
// Everything that talks to Prodigi lives here so index.js only wires it to
// callables. The API key is passed in by the caller (it comes from Secret
// Manager via defineSecret in index.js) and is never sent to the client.
//
// API reference: https://www.prodigi.com/print-api/docs/reference/

// Sandbox until real orders should reach Prodigi's printers. Sandbox orders
// are accepted and progress through statuses but are never printed or billed.
// Switch to 'live' only together with a live PRODIGI_API_KEY.
const PRODIGI_ENVIRONMENT = 'sandbox';
const PRODIGI_BASE_URLS = {
    sandbox: 'https://api.sandbox.prodigi.com/v4.0',
    live: 'https://api.prodigi.com/v4.0',
};

// FrameWorthy's retail price = Prodigi item cost × markup + Prodigi shipping
// at cost, rounded up to the whole pound. Change here to reprice everything.
const RETAIL_MARKUP = 1.8;

// Prodigi bills in GBP for the UK and Jersey; quoting in the billing
// currency keeps supplier cost and retail price in the same unit.
const QUOTE_CURRENCY = 'GBP';
const DESTINATIONS = ['GB', 'JE'];
const SHIPPING_METHODS = ['Budget', 'Standard', 'Express', 'Overnight'];
const MAX_ITEMS = 10;
const MAX_COPIES = 10;

// Product attributes Prodigi accepts on wall-art SKUs. Prodigi validates the
// values against the SKU itself; this only keeps arbitrary keys out.
const ATTRIBUTE_KEYS = ['color', 'mount', 'mountColor', 'glaze', 'paperType', 'wrap', 'edge', 'style'];

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,63}$/i;

class ProdigiError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

const baseUrl = () => PRODIGI_BASE_URLS[PRODIGI_ENVIRONMENT];

// Validates one client-supplied item and returns the Prodigi item shape.
// Throws ProdigiError('invalid-argument') rather than passing junk upstream.
function normalizeItem(item) {
    const sku = typeof item?.sku === 'string' ? item.sku.trim() : '';
    if (!SKU_PATTERN.test(sku)) {
        throw new ProdigiError('invalid-argument', 'Each item needs a valid Prodigi SKU');
    }
    const copies = item.copies === undefined ? 1 : Number(item.copies);
    if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) {
        throw new ProdigiError('invalid-argument', `copies must be between 1 and ${MAX_COPIES}`);
    }
    const attributes = {};
    for (const [key, value] of Object.entries(item.attributes || {})) {
        if (!ATTRIBUTE_KEYS.includes(key)) {
            throw new ProdigiError('invalid-argument', `Unsupported attribute: ${key}`);
        }
        if (typeof value !== 'string' || !value.trim() || value.length > 40) {
            throw new ProdigiError('invalid-argument', `Invalid value for attribute ${key}`);
        }
        attributes[key] = value.trim();
    }
    return { sku, copies, attributes };
}

function normalizeQuoteRequest({ items, destinationCountryCode, shippingMethod = 'Standard' } = {}) {
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
        throw new ProdigiError('invalid-argument', `items must be a list of 1 to ${MAX_ITEMS} products`);
    }
    if (!DESTINATIONS.includes(destinationCountryCode)) {
        throw new ProdigiError('invalid-argument', `destinationCountryCode must be one of ${DESTINATIONS.join(', ')}`);
    }
    if (!SHIPPING_METHODS.includes(shippingMethod)) {
        throw new ProdigiError('invalid-argument', `shippingMethod must be one of ${SHIPPING_METHODS.join(', ')}`);
    }
    return { items: items.map(normalizeItem), destinationCountryCode, shippingMethod };
}

async function prodigiRequest(apiKey, path, body) {
    let response;
    try {
        response = await fetch(`${baseUrl()}${path}`, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
        });
    } catch (err) {
        throw new ProdigiError('unavailable', 'Could not reach Prodigi', { cause: err.message });
    }
    let result;
    try {
        result = await response.json();
    } catch {
        throw new ProdigiError('unavailable', 'Prodigi returned an unreadable response', { status: response.status });
    }
    if (!response.ok) {
        // 4xx means Prodigi rejected what we sent (bad SKU, attribute,
        // address); anything else is on their side.
        const code = response.status >= 400 && response.status < 500 ? 'failed-precondition' : 'unavailable';
        throw new ProdigiError(code, 'Prodigi rejected the request', { status: response.status, outcome: result?.outcome, failures: result?.failures });
    }
    return result;
}

const money = (value) => {
    const number = Number(value?.amount);
    return Number.isFinite(number) ? number : null;
};

// Rounded to pennies before the ceiling so float noise (10 × 1.8 =
// 18.000000000000004) can't add a pound.
const retailPrice = (itemsCost, shippingCost) =>
    Math.ceil(Math.round((itemsCost * RETAIL_MARKUP + shippingCost) * 100) / 100);

// Live quote for a set of Prodigi items to the UK or Jersey. Returns the
// supplier cost (for logging and order records) and FrameWorthy's retail
// price, both in GBP.
async function getQuote(apiKey, request) {
    const { items, destinationCountryCode, shippingMethod } = normalizeQuoteRequest(request);
    const result = await prodigiRequest(apiKey, '/quotes', {
        shippingMethod,
        destinationCountryCode,
        currencyCode: QUOTE_CURRENCY,
        items: items.map(({ sku, copies, attributes }) => ({
            sku, copies, attributes, assets: [{ printArea: 'default' }],
        })),
    });
    const quote = result?.quotes?.find((entry) => entry.shipmentMethod === shippingMethod) || result?.quotes?.[0];
    const itemsCost = money(quote?.costSummary?.items);
    const shippingCost = money(quote?.costSummary?.shipping);
    const currencies = [quote?.costSummary?.items?.currency, quote?.costSummary?.shipping?.currency];
    if (result?.outcome !== 'Created' || itemsCost === null || shippingCost === null) {
        throw new ProdigiError('failed-precondition', 'Prodigi could not quote these items', { outcome: result?.outcome, issues: result?.issues });
    }
    if (currencies.some((currency) => currency !== QUOTE_CURRENCY)) {
        throw new ProdigiError('failed-precondition', 'Prodigi quoted in an unexpected currency', { currencies });
    }
    return {
        currency: QUOTE_CURRENCY,
        destinationCountryCode,
        shippingMethod,
        supplier: { items: itemsCost, shipping: shippingCost, total: itemsCost + shippingCost },
        retail: { total: retailPrice(itemsCost, shippingCost) },
    };
}

const requiredString = (value, field, max = 100) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
        throw new ProdigiError('invalid-argument', `${field} is required`);
    }
    return value.trim();
};

const optionalString = (value, max = 100) =>
    (typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined);

// Places a Prodigi order for an already-paid FrameWorthy order. The
// FrameWorthy order id doubles as Prodigi's idempotencyKey, so retrying after
// a timeout returns the existing Prodigi order instead of printing twice.
async function createOrder(apiKey, { orderId, shippingMethod = 'Standard', recipient, items }) {
    const merchantReference = requiredString(orderId, 'orderId');
    if (!SHIPPING_METHODS.includes(shippingMethod)) {
        throw new ProdigiError('invalid-argument', 'Invalid shippingMethod');
    }
    const address = recipient?.address || {};
    const countryCode = address.countryCode;
    if (!DESTINATIONS.includes(countryCode)) {
        throw new ProdigiError('invalid-argument', `Prodigi orders currently ship to ${DESTINATIONS.join(', ')} only`);
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
        throw new ProdigiError('invalid-argument', 'Order has no Prodigi items');
    }
    const orderItems = items.map((item, index) => {
        const { sku, copies, attributes } = normalizeItem(item);
        const url = requiredString(item.imageUrl, 'imageUrl', 2048);
        if (!/^https:\/\//.test(url)) {
            throw new ProdigiError('invalid-argument', 'imageUrl must be a public https URL');
        }
        return {
            merchantReference: `${merchantReference}-${index + 1}`,
            sku, copies, attributes,
            sizing: 'fillPrintArea',
            assets: [{ printArea: 'default', url }],
        };
    });
    const result = await prodigiRequest(apiKey, '/orders', {
        merchantReference,
        idempotencyKey: merchantReference,
        shippingMethod,
        recipient: {
            name: requiredString(recipient?.name, 'recipient.name'),
            email: optionalString(recipient?.email, 254),
            phoneNumber: optionalString(recipient?.phoneNumber, 40),
            address: {
                line1: requiredString(address.line1, 'address.line1'),
                line2: optionalString(address.line2),
                postalOrZipCode: requiredString(address.postalOrZipCode, 'address.postalOrZipCode', 20),
                countryCode,
                townOrCity: requiredString(address.townOrCity, 'address.townOrCity'),
                stateOrCounty: optionalString(address.stateOrCounty),
            },
        },
        items: orderItems,
    });
    if (!['Created', 'CreatedWithIssues', 'AlreadyExists'].includes(result?.outcome) || !result?.order?.id) {
        throw new ProdigiError('failed-precondition', 'Prodigi did not create the order', { outcome: result?.outcome });
    }
    return {
        prodigiOrderId: result.order.id,
        outcome: result.outcome,
        status: result.order.status?.stage || null,
        environment: PRODIGI_ENVIRONMENT,
    };
}

module.exports = {
    getQuote,
    createOrder,
    normalizeQuoteRequest,
    retailPrice,
    ProdigiError,
    PRODIGI_ENVIRONMENT,
    RETAIL_MARKUP,
};
