const crypto = require('crypto');

const PRODIGI_BASE_URLS = {
    sandbox: 'https://api.sandbox.prodigi.com',
    live: 'https://api.prodigi.com',
};

const SHIPPING_METHODS = new Set(['Budget', 'Standard', 'StandardPlus', 'Express', 'Overnight']);
const MAX_ITEMS = 25;

const cleanCode = (value, length, field) => {
    const code = String(value || '').trim().toUpperCase();
    if (!new RegExp(`^[A-Z]{${length}}$`).test(code)) throw new Error(`Invalid ${field}`);
    return code;
};

const cleanText = (value, field, maxLength = 160) => {
    const text = String(value || '').trim();
    if (!text || text.length > maxLength) throw new Error(`Invalid ${field}`);
    return text;
};

const cleanUrl = (value, field = 'asset URL') => {
    let url;
    try { url = new URL(String(value || '')); } catch { throw new Error(`Invalid ${field}`); }
    if (url.protocol !== 'https:') throw new Error(`${field} must use HTTPS`);
    return url.toString();
};

const normaliseAttributes = (attributes = {}) => {
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return {};
    return Object.fromEntries(Object.entries(attributes)
        .filter(([key, value]) => /^[a-z][a-zA-Z0-9]{0,39}$/.test(key) && value !== '' && value != null)
        .slice(0, 12)
        .map(([key, value]) => [key, cleanText(value, `attribute ${key}`, 100)]));
};

const normaliseQuoteItems = (items) => {
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
        throw new Error(`Quote must contain between 1 and ${MAX_ITEMS} items`);
    }
    return items.map((item) => ({
        sku: cleanText(item?.sku, 'SKU', 100).toUpperCase(),
        copies: Number.isInteger(Number(item?.copies)) && Number(item.copies) >= 1 && Number(item.copies) <= 100
            ? Number(item.copies)
            : 1,
        attributes: normaliseAttributes(item?.attributes),
        assets: [{ printArea: 'default' }],
    }));
};

const buildQuotePayload = (input) => {
    const payload = {
        destinationCountryCode: cleanCode(input?.destinationCountryCode, 2, 'destination country code'),
        items: normaliseQuoteItems(input?.items),
    };
    if (input?.currencyCode) payload.currencyCode = cleanCode(input.currencyCode, 3, 'currency code');
    if (input?.shippingMethod) {
        const shippingMethod = String(input.shippingMethod).trim();
        const canonical = [...SHIPPING_METHODS].find((item) => item.toLowerCase() === shippingMethod.toLowerCase());
        if (!canonical) throw new Error('Invalid shipping method');
        payload.shippingMethod = canonical;
    }
    return payload;
};

const buildRecipient = (recipient) => ({
    name: cleanText(recipient?.name, 'recipient name'),
    email: recipient?.email ? cleanText(recipient.email, 'recipient email', 254) : undefined,
    phoneNumber: recipient?.phoneNumber ? cleanText(recipient.phoneNumber, 'recipient phone', 40) : undefined,
    address: {
        line1: cleanText(recipient?.address?.line1, 'address line 1'),
        line2: recipient?.address?.line2 ? cleanText(recipient.address.line2, 'address line 2') : undefined,
        postalOrZipCode: cleanText(recipient?.address?.postalOrZipCode, 'postal or ZIP code', 32),
        countryCode: cleanCode(recipient?.address?.countryCode, 2, 'country code'),
        townOrCity: cleanText(recipient?.address?.townOrCity, 'town or city'),
        stateOrCounty: recipient?.address?.stateOrCounty ? cleanText(recipient.address.stateOrCounty, 'state or county') : undefined,
    },
});

const buildOrderPayload = ({ merchantReference, shippingMethod, recipient, items, callbackUrl }) => {
    const quote = buildQuotePayload({ destinationCountryCode: recipient?.address?.countryCode, shippingMethod, items });
    const orderItems = quote.items.map((quoteItem, index) => {
        const source = items[index];
        return {
            sku: quoteItem.sku,
            copies: quoteItem.copies,
            attributes: quoteItem.attributes,
            assets: [{
                printArea: 'default',
                url: cleanUrl(source?.assetUrl),
                sizing: ['fillPrintArea', 'fitPrintArea', 'stretchToPrintArea'].includes(source?.sizing)
                    ? source.sizing
                    : 'fillPrintArea',
            }],
        };
    });
    const payload = {
        merchantReference: cleanText(merchantReference, 'merchant reference', 100),
        idempotencyKey: crypto.createHash('sha256').update(String(merchantReference)).digest('hex'),
        shippingMethod: quote.shippingMethod || 'Standard',
        recipient: buildRecipient(recipient),
        items: orderItems,
        metadata: { source: 'FrameWorthy', frameworthyOrderId: String(merchantReference) },
    };
    if (callbackUrl) payload.callbackUrl = cleanUrl(callbackUrl, 'callback URL');
    return payload;
};

const prodigiRequest = async ({ apiKey, environment = 'sandbox', path, method = 'GET', body, fetchImpl = fetch }) => {
    if (!apiKey) throw new Error('Prodigi API key is not configured');
    const baseUrl = PRODIGI_BASE_URLS[environment];
    if (!baseUrl) throw new Error('Prodigi environment must be sandbox or live');
    const response = await fetchImpl(`${baseUrl}/v4.0/${String(path).replace(/^\/+/, '')}`, {
        method,
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
        const error = new Error(data?.message || data?.outcome || `Prodigi request failed (${response.status})`);
        error.status = response.status;
        error.details = data;
        throw error;
    }
    return data;
};

const createQuote = ({ apiKey, environment, input, fetchImpl }) => prodigiRequest({
    apiKey, environment, path: 'quotes', method: 'POST', body: buildQuotePayload(input), fetchImpl,
});

const createOrder = ({ apiKey, environment, input, fetchImpl }) => prodigiRequest({
    apiKey, environment, path: 'orders', method: 'POST', body: buildOrderPayload(input), fetchImpl,
});

const DEFAULT_MARKUP_PERCENT = 40;

const moneyValue = (cost) => {
    const amount = Number(cost?.amount);
    const currency = String(cost?.currency || '').toUpperCase();
    return Number.isFinite(amount) && /^[A-Z]{3}$/.test(currency) ? { amount, currency } : null;
};

const summariseQuotes = (result, { markupPercent = DEFAULT_MARKUP_PERCENT } = {}) => (Array.isArray(result?.quotes) ? result.quotes : []).map((quote) => {
    const rawItems = moneyValue(quote.costSummary?.items);
    const shipping = moneyValue(quote.costSummary?.shipping);
    const tax = moneyValue(quote.costSummary?.totalTax);
    const rawTotal = moneyValue(quote.costSummary?.totalCost);

    let items = rawItems;
    let total = rawTotal;

    if (rawItems && Number.isFinite(rawItems.amount) && markupPercent > 0) {
        // Apply hidden margin markup to the frame/print only (exact pence rounding)
        const markedUpAmount = Math.round(rawItems.amount * (1 + Number(markupPercent) / 100) * 100) / 100;
        items = { amount: markedUpAmount, currency: rawItems.currency };

        // Shipping is passed through at carrier cost; customer total is recomputed
        const shippingAmount = shipping?.amount || 0;
        const taxAmount = tax?.amount || 0;
        const newTotalAmount = Math.round((markedUpAmount + shippingAmount + taxAmount) * 100) / 100;
        total = { amount: newTotalAmount, currency: rawTotal?.currency || rawItems.currency };
    }

    return {
        shippingMethod: quote.shipmentMethod,
        items,
        shipping,
        tax,
        total,
        shipments: (quote.shipments || []).map((shipment) => ({
            carrier: shipment.carrier?.name || shipment.carrier?.service || null,
            service: shipment.carrier?.service || null,
            fulfilmentCountry: shipment.fulfillmentLocation?.countryCode || null,
        })),
    };
});

const base64Url = (value) => Buffer.from(value).toString('base64url');

const createRetailQuote = ({ quote, input, signingKey, exchangeRates = {}, markupPercent = DEFAULT_MARKUP_PERCENT, ttlSeconds = 86400 }) => {
    const total = moneyValue(quote?.costSummary?.totalCost);
    const rawItems = moneyValue(quote?.costSummary?.items) || total;
    if (!total) return null;

    // Item markup in native currency (e.g. GBP)
    const markedUpItemsAmount = rawItems && Number.isFinite(rawItems.amount)
        ? Math.round(rawItems.amount * (1 + Number(markupPercent || 0) / 100) * 100) / 100
        : null;
    const shippingAmount = Number(quote?.costSummary?.shipping?.amount || 0);
    const taxAmount = Number(quote?.costSummary?.totalTax?.amount || 0);
    const retailTotalGbp = markedUpItemsAmount !== null
        ? Math.round((markedUpItemsAmount + shippingAmount + taxAmount) * 100) / 100
        : null;

    const rate = Number(exchangeRates[total.currency]);
    const hasExchangeRate = Number.isFinite(rate) && rate > 0;
    const supplierGhs = hasExchangeRate ? total.amount * rate : null;
    const retailTotalGhs = hasExchangeRate
        ? Math.ceil(((markedUpItemsAmount || total.amount) * rate) + (shippingAmount * rate) + (taxAmount * rate))
        : null;

    const payload = {
        v: 1,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
        sku: input.items[0].sku,
        copies: input.items[0].copies,
        attributes: input.items[0].attributes,
        destinationCountryCode: input.destinationCountryCode,
        shippingMethod: quote.shipmentMethod,
        supplierTotal: total,
        retailTotalGhs,
        retailTotalGbp,
        retailItemGbp: markedUpItemsAmount,
    };
    const encoded = base64Url(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', signingKey).update(encoded).digest('base64url');
    return {
        supplierGhs: supplierGhs ? Math.round(supplierGhs * 100) / 100 : null,
        markupPercent: Number(markupPercent || 0),
        totalGhs: retailTotalGhs,
        totalGbp: retailTotalGbp,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        token: `${encoded}.${signature}`,
    };
};

const verifyRetailQuoteToken = (token, signingKey) => {
    const [encoded, suppliedSignature, ...extra] = String(token || '').split('.');
    if (!encoded || !suppliedSignature || extra.length) throw new Error('Invalid Prodigi quote token');
    const expectedSignature = crypto.createHmac('sha256', signingKey).update(encoded).digest('base64url');
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        throw new Error('Invalid Prodigi quote signature');
    }
    let payload;
    try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
    catch { throw new Error('Invalid Prodigi quote payload'); }
    if (payload.v !== 1 || !payload.sku || (!Number.isFinite(payload.retailTotalGhs) && !Number.isFinite(payload.retailTotalGbp))) {
        throw new Error('Invalid Prodigi quote payload');
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Prodigi quote has expired');
    return payload;
};

module.exports = {
    PRODIGI_BASE_URLS,
    buildQuotePayload,
    buildOrderPayload,
    prodigiRequest,
    createQuote,
    createOrder,
    summariseQuotes,
    createRetailQuote,
    verifyRetailQuoteToken,
};
