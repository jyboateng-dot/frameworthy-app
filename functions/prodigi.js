const crypto = require('crypto');
const pricingPolicy = require('./pricing-policy.json');

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

const FLOAT_SIZE_TO_BASE_SUFFIX = {
    '20X20': '8X8', '20X30': '8X12', '25X50': '10X20', '28X35': '11X14',
    '29X42': 'A3', '30X30': '12X12', '30X40': '12X16', '30X45': '12X18',
    '40X40': '16X16', '40X50': '16X20', '40X60': '16X24', '40X80': '16X32',
    '45X60': '18X24', '50X50': '20X20', A2: 'A2', A3: 'A3', A4: 'A4',
};

const expectedBaseSku = (sku) => {
    const value = String(sku || '').toUpperCase();
    const classic = value.match(/^GLOBAL-CFPM?-MOTH-(.+)$/) || value.match(/^GLOBAL-CFPM-(.+)$/) || value.match(/^GLOBAL-CFP-(.+)$/);
    if (classic) return `GLOBAL-CFP-${classic[1]}`;
    const boxMounted = value.match(/^GLOBAL-BOXM-MOTH-(.+)$/) || value.match(/^GLOBAL-BOXM-(.+)$/);
    if (boxMounted) {
        const metricSize = boxMounted[1].match(/^(\d{3,})X(\d{3,})$/);
        const suffix = metricSize
            ? metricSize.slice(1).map((part) => Math.round(Number(part) / 25.4)).join('X')
            : boxMounted[1];
        return `GLOBAL-BOX-${suffix}`;
    }
    const box = value.match(/^GLOBAL-BOX-MOTH-(.+)$/) || value.match(/^GLOBAL-BOX-(.+)$/);
    if (box) return `GLOBAL-BOX-${box[1]}`;
    const classicFloat = value.match(/^FRA-CLA-EMA-(?:NM|MOUNT2)-GLA-(.+)$/);
    if (classicFloat) return `GLOBAL-CFP-${FLOAT_SIZE_TO_BASE_SUFFIX[classicFloat[1]] || classicFloat[1]}`;
    const boxFloat = value.match(/^FRA-BOX-EMA-(?:NM|MOUNT2)-GLA-(.+)$/);
    if (boxFloat) return `GLOBAL-BOX-${FLOAT_SIZE_TO_BASE_SUFFIX[boxFloat[1]] || boxFloat[1]}`;
    return value;
};

const isConfigurableFrameSku = (sku) => /^(?:GLOBAL-CFP|GLOBAL-BOX|FRA-CLA-EMA|FRA-BOX-EMA)/.test(String(sku || '').toUpperCase());

const buildBaseQuotePayload = (input, selectedInput = buildQuotePayload(input)) => {
    const baseItem = input?.baseItem || selectedInput.items[0];
    const baseInput = buildQuotePayload({
        destinationCountryCode: selectedInput.destinationCountryCode,
        currencyCode: selectedInput.currencyCode,
        shippingMethod: selectedInput.shippingMethod,
        items: [baseItem],
    });
    const selected = selectedInput.items[0];
    const base = baseInput.items[0];
    const usesSelectedAsBase = base.sku === selected.sku && JSON.stringify(base.attributes) === JSON.stringify(selected.attributes);
    if (selectedInput.items.length !== 1 || base.copies !== selected.copies
        || (base.sku !== expectedBaseSku(selected.sku) && !usesSelectedAsBase)) {
        throw new Error('Invalid base frame configuration');
    }
    if (isConfigurableFrameSku(selected.sku) && !usesSelectedAsBase) {
        if (String(base.attributes.color || '').toLowerCase() !== String(selected.attributes.color || '').toLowerCase()
            || String(base.attributes.glaze || '').toLowerCase() !== 'acrylic / perspex'
            || !/^no mount/i.test(base.attributes.mount || '')) {
            throw new Error('Invalid base frame attributes');
        }
    } else {
        const { wrap: selectedWrap, ...selectedAttributes } = selected.attributes;
        const { wrap: baseWrap, ...baseAttributes } = base.attributes;
        const sameAttributes = JSON.stringify(baseAttributes) === JSON.stringify(selectedAttributes);
        const validWrapBaseline = sameAttributes && baseWrap === 'ImageWrap' && Boolean(selectedWrap);
        if (JSON.stringify(base.attributes) !== JSON.stringify(selected.attributes) && !validWrapBaseline) {
            throw new Error('Invalid base product attributes');
        }
    }
    return baseInput;
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

const moneyValue = (cost) => {
    const amount = Number(cost?.amount);
    const currency = String(cost?.currency || '').toUpperCase();
    return Number.isFinite(amount) && /^[A-Z]{3}$/.test(currency) ? { amount, currency } : null;
};

const summariseQuotes = (result) => (Array.isArray(result?.quotes) ? result.quotes : []).map((quote) => ({
    shippingMethod: quote.shipmentMethod,
    items: moneyValue(quote.costSummary?.items),
    shipping: moneyValue(quote.costSummary?.shipping),
    tax: moneyValue(quote.costSummary?.totalTax),
    total: moneyValue(quote.costSummary?.totalCost),
    shipments: (quote.shipments || []).map((shipment) => ({
        carrier: shipment.carrier?.name || shipment.carrier?.service || null,
        service: shipment.carrier?.service || null,
        fulfilmentCountry: shipment.fulfillmentLocation?.countryCode || null,
    })),
}));

const base64Url = (value) => Buffer.from(value).toString('base64url');

const createRetailQuote = ({ quote, baseQuote = quote, input, signingKey, exchangeRates = {}, grossMarginPercent = pricingPolicy.frameGrossMarginPercent, ttlSeconds = 86400 }) => {
    const total = moneyValue(quote?.costSummary?.totalCost);
    const configuredItems = moneyValue(quote?.costSummary?.items) || total;
    const baseItems = moneyValue(baseQuote?.costSummary?.items) || moneyValue(baseQuote?.costSummary?.totalCost);
    const shipping = moneyValue(quote?.costSummary?.shipping);
    const tax = moneyValue(quote?.costSummary?.totalTax);
    const margin = Number(grossMarginPercent);
    if (!total || !configuredItems || !baseItems || configuredItems.currency !== baseItems.currency
        || !Number.isFinite(margin) || margin < 0 || margin >= 100) return null;
    const baseFrameRetail = baseItems.amount / (1 - margin / 100);
    const customizationCost = Math.max(0, configuredItems.amount - baseItems.amount);
    const retailItemsAmount = Math.round((baseFrameRetail + customizationCost) * 100) / 100;
    const retailTotalAmount = Math.round((retailItemsAmount + Number(shipping?.amount || 0) + Number(tax?.amount || 0)) * 100) / 100;
    const rate = Number(exchangeRates[total.currency]);
    const hasExchangeRate = Number.isFinite(rate) && rate > 0;
    const supplierGhs = hasExchangeRate ? total.amount * rate : null;
    const retailTotalGhs = hasExchangeRate ? Math.ceil(retailTotalAmount * rate) : null;
    const payload = {
        v: 2,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
        sku: input.items[0].sku,
        copies: input.items[0].copies,
        attributes: input.items[0].attributes,
        destinationCountryCode: input.destinationCountryCode,
        shippingMethod: quote.shipmentMethod,
        supplierTotal: total,
        supplierBaseFrame: baseItems,
        retailItemGbp: configuredItems.currency === 'GBP' ? retailItemsAmount : null,
        retailTotalGbp: total.currency === 'GBP' ? retailTotalAmount : null,
        retailTotalGhs,
    };
    const encoded = base64Url(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', signingKey).update(encoded).digest('base64url');
    return {
        supplierGhs: supplierGhs === null ? null : Math.round(supplierGhs * 100) / 100,
        grossMarginPercent: margin,
        frame: { amount: Math.round(baseFrameRetail * 100) / 100, currency: baseItems.currency },
        customizations: { amount: Math.round(customizationCost * 100) / 100, currency: configuredItems.currency },
        items: { amount: retailItemsAmount, currency: configuredItems.currency },
        total: { amount: retailTotalAmount, currency: total.currency },
        totalGhs: retailTotalGhs,
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
    const hasRetailTotal = Number.isFinite(payload.retailTotalGhs) || Number.isFinite(payload.retailTotalGbp);
    if (![1, 2].includes(payload.v) || !payload.sku || !hasRetailTotal) throw new Error('Invalid Prodigi quote payload');
    if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Prodigi quote has expired');
    return payload;
};

module.exports = {
    PRODIGI_BASE_URLS,
    buildQuotePayload,
    buildBaseQuotePayload,
    buildOrderPayload,
    prodigiRequest,
    createQuote,
    createOrder,
    summariseQuotes,
    createRetailQuote,
    verifyRetailQuoteToken,
};
