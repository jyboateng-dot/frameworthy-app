import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
    buildQuotePayload,
    buildOrderPayload,
    createQuote,
    createRetailQuote,
    verifyRetailQuoteToken,
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
});
