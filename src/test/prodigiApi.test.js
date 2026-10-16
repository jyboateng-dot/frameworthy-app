import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
    buildQuotePayload,
    buildOrderPayload,
    createQuote,
    createRetailQuote,
    verifyRetailQuoteToken,
    summariseQuotes,
} = require('../../functions/prodigi.js');

const item = { sku: 'GLOBAL-CAN-10X10', copies: 1, attributes: { wrap: 'ImageWrap' } };

describe('Prodigi API integration', () => {
    it('builds a constrained v4 quote request', () => {
        expect(buildQuotePayload({ destinationCountryCode: 'gb', shippingMethod: 'standard', items: [item] }))
            .toEqual({
                destinationCountryCode: 'GB',
                shippingMethod: 'Standard',
                items: [{ ...item, assets: [{ printArea: 'default' }] }],
            });
    });

    it('keeps the key server-side and calls the sandbox by default', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ outcome: 'Created', quotes: [] }),
        });
        await createQuote({ apiKey: 'sandbox-secret', environment: 'sandbox', input: { destinationCountryCode: 'GB', items: [item] }, fetchImpl });
        expect(fetchImpl).toHaveBeenCalledWith('https://api.sandbox.prodigi.com/v4.0/quotes', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'X-API-Key': 'sandbox-secret' }),
        }));
    });

    it('creates an idempotent order with an HTTPS print asset', () => {
        const payload = buildOrderPayload({
            merchantReference: 'firestore-order-123',
            shippingMethod: 'Standard',
            recipient: {
                name: 'Test Customer', email: 'test@example.com', phoneNumber: '+44123456789',
                address: { line1: '1 Test Road', postalOrZipCode: 'SW1A 1AA', countryCode: 'GB', townOrCity: 'London' },
            },
            items: [{ ...item, assetUrl: 'https://images.example.com/print.jpg' }],
        });
        expect(payload.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
        expect(payload.items[0].assets[0]).toMatchObject({ printArea: 'default', sizing: 'fillPrintArea' });
    });

    it('translates full user customization into Prodigi order payload accurately', () => {
        const customizedItem = {
            sku: 'GLOBAL-CFPM-16X20',
            copies: 1,
            attributes: {
                frame: 'Classic',
                color: 'natural',
                glaze: 'Float glass',
                mount: '2.4mm',
                mountColor: 'Snow white',
                paperType: 'EMA',
                substrateWeight: '200gsm',
            },
            assetUrl: 'https://storage.googleapis.com/bucket/frame-print.jpg',
            sizing: 'fillPrintArea',
        };
        const payload = buildOrderPayload({
            merchantReference: 'order-cust-456',
            shippingMethod: 'Standard',
            recipient: {
                name: 'Jeremy Boateng', email: 'jeremy@example.com', phoneNumber: '+447797789598',
                address: { line1: 'Liberty Wharf Apartments', line2: 'Esplanade', postalOrZipCode: 'JE2 3AS', countryCode: 'JE', townOrCity: 'Jersey' },
            },
            items: [customizedItem],
        });
        expect(payload.items[0]).toEqual({
            sku: 'GLOBAL-CFPM-16X20',
            copies: 1,
            attributes: {
                frame: 'Classic',
                color: 'natural',
                glaze: 'Float glass',
                mount: '2.4mm',
                mountColor: 'Snow white',
                paperType: 'EMA',
                substrateWeight: '200gsm',
            },
            assets: [{
                printArea: 'default',
                url: 'https://storage.googleapis.com/bucket/frame-print.jpg',
                sizing: 'fillPrintArea',
            }],
        });
        expect(payload.recipient.address.countryCode).toBe('JE');
    });

    it('signs retail GHS totals and rejects token tampering', () => {
        const retail = createRetailQuote({
            quote: { shipmentMethod: 'Standard', costSummary: { totalCost: { amount: '10.00', currency: 'GBP' } } },
            input: { destinationCountryCode: 'GB', items: [item] },
            signingKey: 'test-secret', exchangeRates: { GBP: 20 }, markupPercent: 25,
        });
        expect(retail.totalGhs).toBe(250);
        expect(verifyRetailQuoteToken(retail.token, 'test-secret')).toMatchObject({ sku: item.sku, retailTotalGhs: 250 });
        expect(() => verifyRetailQuoteToken(`${retail.token}x`, 'test-secret')).toThrow(/signature/i);
    });

    it('applies hidden 40% margin markup to frame/print only and keeps shipping at carrier cost', () => {
        const rawResult = {
            outcome: 'Created',
            quotes: [
                {
                    shipmentMethod: 'Standard',
                    costSummary: {
                        items: { amount: '50.00', currency: 'GBP' },
                        shipping: { amount: '7.00', currency: 'GBP' },
                        totalTax: { amount: '10.00', currency: 'GBP' },
                        totalCost: { amount: '67.00', currency: 'GBP' },
                    },
                    shipments: [{ carrier: { name: 'Royal Mail', service: 'Tracked 48' }, fulfillmentLocation: { countryCode: 'GB' } }],
                },
            ],
        };

        const summaries = summariseQuotes(rawResult); // uses default 40% markup
        expect(summaries).toHaveLength(1);
        const quote = summaries[0];

        // 50.00 * 1.40 = 70.00
        expect(quote.items).toEqual({ amount: 70, currency: 'GBP' });
        // Shipping is untouched at carrier cost
        expect(quote.shipping).toEqual({ amount: 7, currency: 'GBP' });
        // Tax is untouched
        expect(quote.tax).toEqual({ amount: 10, currency: 'GBP' });
        // Total is recomputed: 70 + 7 + 10 = 87
        expect(quote.total).toEqual({ amount: 87, currency: 'GBP' });
    });

    it('rounds marked-up prices to exact pence without floating-point artifacts', () => {
        const rawResult = {
            quotes: [
                {
                    shipmentMethod: 'Standard',
                    costSummary: {
                        items: { amount: '47.33', currency: 'GBP' },
                        shipping: { amount: '6.45', currency: 'GBP' },
                        totalTax: { amount: '0.00', currency: 'GBP' },
                        totalCost: { amount: '53.78', currency: 'GBP' },
                    },
                },
            ],
        };

        // 47.33 * 1.40 = 66.262 -> 66.26
        // Total = 66.26 + 6.45 = 72.71
        const summaries = summariseQuotes(rawResult, { markupPercent: 40 });
        expect(summaries[0].items.amount).toBe(66.26);
        expect(summaries[0].shipping.amount).toBe(6.45);
        expect(summaries[0].total.amount).toBe(72.71);
    });
});
