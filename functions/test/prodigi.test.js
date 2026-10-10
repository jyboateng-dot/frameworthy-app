import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getProdigiQuote } from '../index.js';
import prodigi from '../prodigi.js';

const originalFetch = global.fetch;

const mockProdigiFetch = (respond) => vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
    if (String(url).includes('prodigi.com')) return respond(url, opts);
    return originalFetch(url, opts);
});

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

beforeEach(() => {
    vi.restoreAllMocks();
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
    it('returns only the retail total, never the supplier cost', async () => {
        const fetchSpy = mockProdigiFetch(() => quoteResponse());
        const result = await getProdigiQuote.run({ data: { items: [boxA5], destinationCountryCode: 'GB' } });
        expect(result).toEqual({ currency: 'GBP', destinationCountryCode: 'GB', shippingMethod: 'Standard', total: 46 });
        expect(fetchSpy.mock.calls[0][1].headers['X-API-Key']).toBe('test-prodigi-api-key');
    });

    it('surfaces validation errors as invalid-argument', async () => {
        await expect(getProdigiQuote.run({ data: { items: [], destinationCountryCode: 'GB' } }))
            .rejects.toMatchObject({ code: 'invalid-argument' });
    });
});
