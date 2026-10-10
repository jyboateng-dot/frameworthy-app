import { describe, it, expect, beforeEach, vi } from 'vitest';
import admin from 'firebase-admin';
import { getProdigiQuote, verifyPaystackPayment } from '../index.js';
import { createRequire } from 'node:module';
import { clearFirestore } from './helpers.js';

// The same module instance index.js requires, so resetRateCache reaches it.
const prodigi = createRequire(import.meta.url)('../prodigi.js');

const originalFetch = global.fetch;

const fxResponse = (rate = 16) => ({ ok: true, json: async () => ({ result: 'success', rates: { GHS: rate } }) });

// Routes Prodigi calls to `respond` and the exchange-rate feed to `fx`.
const mockProdigiFetch = (respond, fx = () => fxResponse()) => vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
    if (String(url).includes('prodigi.com')) return respond(url, opts);
    if (String(url).includes('open.er-api.com')) return fx(url, opts);
    return originalFetch(url, opts);
});

const prodigiCalls = (spy) => spy.mock.calls.filter(([url]) => String(url).includes('prodigi.com'));

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const quoteResponse = (items = '21.00', shipping = '7.85', currency = 'GBP') => jsonResponse(200, {
    outcome: 'Created',
    quotes: [{
        shipmentMethod: 'Standard',
        costSummary: { items: { amount: items, currency }, shipping: { amount: shipping, currency } },
    }],
});

const boxA5 = { sku: 'GLOBAL-BOX-A5', attributes: { color: 'black' } };

const recipient = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    address: { line1: '1 Bath Street', postalOrZipCode: 'JE2 4ST', countryCode: 'JE', townOrCity: 'St Helier' },
};

const db = () => admin.firestore();

beforeEach(async () => {
    await clearFirestore();
    vi.restoreAllMocks();
    prodigi.resetRateCache();
});

describe('prodigi.getQuote', () => {
    it('quotes in GBP against the sandbox and applies the retail markup', async () => {
        const fetchSpy = mockProdigiFetch(() => quoteResponse());
        const quote = await prodigi.getQuote('key', { items: [boxA5], destinationCountryCode: 'JE' });

        const [url, opts] = fetchSpy.mock.calls[0];
        expect(url).toBe('https://api.sandbox.prodigi.com/v4.0/quotes');
        expect(opts.headers['X-API-Key']).toBe('key');
        expect(JSON.parse(opts.body)).toEqual({
            shippingMethod: 'Standard',
            destinationCountryCode: 'JE',
            currencyCode: 'GBP',
            items: [{ sku: 'GLOBAL-BOX-A5', copies: 1, attributes: { color: 'black' }, assets: [{ printArea: 'default' }] }],
        });
        expect(quote.supplier).toEqual({ items: 21, shipping: 7.85, total: 28.85 });
        // ceil(21 × 1.8 + 7.85) = ceil(45.65)
        expect(quote.retail.total).toBe(46);
    });

    it.each([
        ['no items', { items: [], destinationCountryCode: 'GB' }],
        ['an unsupported destination', { items: [boxA5], destinationCountryCode: 'US' }],
        ['a malformed SKU', { items: [{ sku: 'bad sku!' }], destinationCountryCode: 'GB' }],
        ['too many copies', { items: [{ ...boxA5, copies: 11 }], destinationCountryCode: 'GB' }],
        ['an unknown attribute', { items: [{ sku: 'GLOBAL-BOX-A5', attributes: { price: '0' } }], destinationCountryCode: 'GB' }],
    ])('rejects %s without calling Prodigi', async (_name, request) => {
        const fetchSpy = mockProdigiFetch(() => quoteResponse());
        await expect(prodigi.getQuote('key', request)).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fails when Prodigi quotes in another currency', async () => {
        mockProdigiFetch(() => quoteResponse('21.00', '7.85', 'EUR'));
        await expect(prodigi.getQuote('key', { items: [boxA5], destinationCountryCode: 'GB' }))
            .rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('maps a Prodigi 4xx to failed-precondition and a 5xx to unavailable', async () => {
        mockProdigiFetch(() => jsonResponse(400, { outcome: 'ValidationFailed' }));
        await expect(prodigi.getQuote('key', { items: [boxA5], destinationCountryCode: 'GB' }))
            .rejects.toMatchObject({ code: 'failed-precondition' });

        vi.restoreAllMocks();
        mockProdigiFetch(() => jsonResponse(503, {}));
        await expect(prodigi.getQuote('key', { items: [boxA5], destinationCountryCode: 'GB' }))
            .rejects.toMatchObject({ code: 'unavailable' });
    });
});

describe('prodigi.retailPrice', () => {
    it('does not round a whole-pound price up by float noise', () => {
        expect(prodigi.retailPrice(10, 0)).toBe(18);
    });
});

describe('prodigi.createOrder', () => {
    it('sends the order with the FrameWorthy order id as idempotency key', async () => {
        const fetchSpy = mockProdigiFetch(() => jsonResponse(200, { outcome: 'Created', order: { id: 'ord_123', status: { stage: 'InProgress' } } }));
        const result = await prodigi.createOrder('key', {
            orderId: 'fw-1',
            recipient,
            items: [{ ...boxA5, imageUrl: 'https://ik.imagekit.io/frameworthy/art.jpg' }],
        });

        const [url, opts] = fetchSpy.mock.calls[0];
        expect(url).toBe('https://api.sandbox.prodigi.com/v4.0/orders');
        const body = JSON.parse(opts.body);
        expect(body).toMatchObject({ merchantReference: 'fw-1', idempotencyKey: 'fw-1', shippingMethod: 'Standard' });
        expect(body.recipient.address.countryCode).toBe('JE');
        expect(body.items[0]).toEqual({
            merchantReference: 'fw-1-1',
            sku: 'GLOBAL-BOX-A5',
            copies: 1,
            attributes: { color: 'black' },
            sizing: 'fillPrintArea',
            assets: [{ printArea: 'default', url: 'https://ik.imagekit.io/frameworthy/art.jpg' }],
        });
        expect(result).toEqual({ prodigiOrderId: 'ord_123', outcome: 'Created', status: 'InProgress', environment: 'sandbox' });
    });

    it('treats AlreadyExists as success so retries never double-print', async () => {
        mockProdigiFetch(() => jsonResponse(200, { outcome: 'AlreadyExists', order: { id: 'ord_123' } }));
        const result = await prodigi.createOrder('key', {
            orderId: 'fw-1', recipient, items: [{ ...boxA5, imageUrl: 'https://example.com/a.jpg' }],
        });
        expect(result.prodigiOrderId).toBe('ord_123');
    });

    it.each([
        ['a non-https image', { orderId: 'fw-1', recipient, items: [{ ...boxA5, imageUrl: 'http://example.com/a.jpg' }] }],
        ['a destination Prodigi is not set up for', { orderId: 'fw-1', recipient: { ...recipient, address: { ...recipient.address, countryCode: 'GH' } }, items: [{ ...boxA5, imageUrl: 'https://example.com/a.jpg' }] }],
        ['a missing recipient name', { orderId: 'fw-1', recipient: { ...recipient, name: '' }, items: [{ ...boxA5, imageUrl: 'https://example.com/a.jpg' }] }],
    ])('rejects %s without calling Prodigi', async (_name, order) => {
        const fetchSpy = mockProdigiFetch(() => jsonResponse(200, {}));
        await expect(prodigi.createOrder('key', order)).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('getProdigiQuote', () => {
    it('stores the quote and returns only the GHS retail total', async () => {
        const fetchSpy = mockProdigiFetch(() => quoteResponse());
        const result = await getProdigiQuote.run({ data: { items: [boxA5], destinationCountryCode: 'GB' } });

        // £46 retail × 16 GHS/GBP × 1.04 buffer = 765.44 → 766
        expect(result).toMatchObject({ currency: 'GHS', destinationCountryCode: 'GB', total: 766 });
        expect(result).not.toHaveProperty('supplier');
        expect(prodigiCalls(fetchSpy)[0][1].headers['X-API-Key']).toBe('test-prodigi-api-key');

        const stored = (await db().collection('prodigiQuotes').doc(result.quoteId).get()).data();
        expect(stored).toMatchObject({
            sku: 'GLOBAL-BOX-A5', attributes: { color: 'black' }, destinationCountryCode: 'GB',
            supplierGbp: { items: 21, shipping: 7.85, total: 28.85 }, retailGbp: 46, gbpToGhsRate: 16, totalGhs: 766,
        });
        expect(stored.expiresAt.toMillis()).toBe(result.expiresAt);
    });

    it.each([
        ['no items', { items: [], destinationCountryCode: 'GB' }],
        ['two items', { items: [boxA5, boxA5], destinationCountryCode: 'GB' }],
        ['two copies', { items: [{ ...boxA5, copies: 2 }], destinationCountryCode: 'GB' }],
        ['an unsupported destination', { items: [boxA5], destinationCountryCode: 'GH' }],
    ])('rejects %s', async (_name, data) => {
        mockProdigiFetch(() => quoteResponse());
        await expect(getProdigiQuote.run({ data })).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it.each([
        ['is down', () => { throw new Error('ECONNRESET'); }],
        ['returns a nonsense rate', () => fxResponse(0.01)],
    ])('fails closed when the exchange-rate feed %s', async (_name, fx) => {
        mockProdigiFetch(() => quoteResponse(), fx);
        await expect(getProdigiQuote.run({ data: { items: [boxA5], destinationCountryCode: 'GB' } }))
            .rejects.toMatchObject({ code: 'unavailable' });
        expect((await db().collection('prodigiQuotes').get()).size).toBe(0);
    });
});

const paystackSuccess = (amount) => ({
    ok: true,
    json: async () => ({ status: true, data: { status: 'success', amount, currency: 'GHS' } }),
});

const prodigiCreated = () => jsonResponse(200, { outcome: 'Created', order: { id: 'ord_123', status: { stage: 'InProgress' } } });

// Routes Paystack, Prodigi and nothing else.
const mockPaymentAndProdigi = ({ amount, prodigiRespond = prodigiCreated }) => vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
    if (String(url).includes('api.paystack.co')) return paystackSuccess(amount);
    if (String(url).includes('prodigi.com')) return prodigiRespond(url, opts);
    return originalFetch(url, opts);
});

const seedQuote = (id, overrides = {}) => db().collection('prodigiQuotes').doc(id).set({
    sku: 'GLOBAL-BOX-A5',
    attributes: { color: 'black' },
    destinationCountryCode: 'JE',
    totalGhs: 766,
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60_000),
    ...overrides,
});

const prodigiItem = (overrides = {}) => ({
    selectedFrame: { id: 'prodigi-box-black' },
    selectedSize: { id: 'a5' },
    prodigiQuoteId: 'q1',
    quantity: 1,
    image: 'https://ik.imagekit.io/frameworthy/art.jpg',
    ...overrides,
});

const seedProdigiOrder = (id, overrides = {}) => db().collection('orders').doc(id).set({
    userId: 'alice',
    customerName: 'Jane Doe',
    userEmail: 'jane@example.com',
    shippingAddress: { address: '1 Bath Street', city: 'St Helier', postcode: 'JE2 4ST', countryCode: 'JE', phone: '+44 7700 900000' },
    totalPrice: 766,
    currency: 'GHS',
    paymentStatus: 'pending',
    createdAt: admin.firestore.Timestamp.now(),
    items: [prodigiItem()],
    ...overrides,
});

const orderData = async (id) => (await db().collection('orders').doc(id).get()).data();

describe('paying for a Prodigi order', () => {
    it('verifies the price from the stored quote and sends the order to Prodigi', async () => {
        await seedQuote('q1');
        await seedProdigiOrder('o1', { items: [prodigiItem({ quantity: 2 })], totalPrice: 1532 });
        const fetchSpy = mockPaymentAndProdigi({ amount: 153200 });

        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'o1' } })).resolves.toMatchObject({ success: true });

        const body = JSON.parse(prodigiCalls(fetchSpy)[0][1].body);
        expect(body).toMatchObject({ merchantReference: 'o1', idempotencyKey: 'o1' });
        expect(body.recipient.address).toMatchObject({ line1: '1 Bath Street', townOrCity: 'St Helier', postalOrZipCode: 'JE2 4ST', countryCode: 'JE' });
        expect(body.items[0]).toMatchObject({ sku: 'GLOBAL-BOX-A5', copies: 2, attributes: { color: 'black' } });

        const order = await orderData('o1');
        expect(order.paymentStatus).toBe('paid');
        expect(order.prodigi).toMatchObject({ status: 'submitted', orderId: 'ord_123', environment: 'sandbox' });
    });

    it('uses the quoted SKU even if the order item claims another', async () => {
        await seedQuote('q1');
        await seedProdigiOrder('o1', { items: [prodigiItem({ prodigiSku: 'GLOBAL-BOX-60X80' })] });
        const fetchSpy = mockPaymentAndProdigi({ amount: 76600 });
        await verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'o1' } });
        expect(JSON.parse(prodigiCalls(fetchSpy)[0][1].body).items[0].sku).toBe('GLOBAL-BOX-A5');
    });

    it.each([
        ['an expired quote', () => seedQuote('q1', { expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 60_000) }), {}],
        ['a quote for another country', () => seedQuote('q1', { destinationCountryCode: 'GB' }), {}],
        ['a missing quote', async () => {}, {}],
        ['a mix of Prodigi and local frames', () => seedQuote('q1'), { items: [prodigiItem(), { selectedFrame: { id: 'frame-canvas' }, selectedSize: { id: 'custom-60x100' }, matWidth: 'none', quantity: 1 }] }],
    ])('refuses to mark paid with %s, and sends nothing to Prodigi', async (_name, seed, overrides) => {
        await seed();
        await seedProdigiOrder('o1', overrides);
        const fetchSpy = mockPaymentAndProdigi({ amount: 76600 });
        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'o1' } }))
            .rejects.toMatchObject({ code: 'failed-precondition' });
        expect(prodigiCalls(fetchSpy)).toHaveLength(0);
        expect((await orderData('o1')).paymentStatus).toBe('pending');
    });

    it('rejects a payment below the quoted price', async () => {
        await seedQuote('q1');
        await seedProdigiOrder('o1', { totalPrice: 1 });
        mockPaymentAndProdigi({ amount: 100 });
        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'o1' } }))
            .rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('still confirms payment when Prodigi is down, and marks the order for retry', async () => {
        await seedQuote('q1');
        await seedProdigiOrder('o1');
        mockPaymentAndProdigi({ amount: 76600, prodigiRespond: () => jsonResponse(503, {}) });
        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'o1' } })).resolves.toMatchObject({ success: true });
        const order = await orderData('o1');
        expect(order.paymentStatus).toBe('paid');
        expect(order.prodigi.status).toBe('retry');
    });

    it('marks the order failed when Prodigi rejects it', async () => {
        await seedQuote('q1');
        await seedProdigiOrder('o1', { items: [prodigiItem({ image: 'data:image/png;base64,AAAA' })] });
        mockPaymentAndProdigi({ amount: 76600 });
        await verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'o1' } });
        expect((await orderData('o1')).prodigi).toMatchObject({ status: 'failed', error: 'imageUrl must be a public https URL' });
    });
});
