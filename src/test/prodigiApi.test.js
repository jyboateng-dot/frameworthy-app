import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
    buildQuotePayload,
    buildBaseQuotePayload,
    buildOrderPayload,
    createQuote,
    createRetailQuote,
    verifyRetailQuoteToken,
    minimumDpiForSku,
    validatePrintQuality,
} = require('../../functions/prodigi.js');

const item = { sku: 'GLOBAL-CAN-10X10', copies: 1, attributes: { wrap: 'ImageWrap' } };

describe('Prodigi API integration', () => {
    it('enforces the paper and canvas quality floors before fulfilment', () => {
        expect(minimumDpiForSku('GLOBAL-CFP-8X10')).toBe(240);
        expect(minimumDpiForSku('GLOBAL-CAN-8X10')).toBe(150);
        const productionImage = 'https://images.example.com/print.jpg';
        const orderItem = {
            prodigi: { sku: 'GLOBAL-CFP-8X10' },
            productionImage,
            printQuality: {
                passed: true,
                effectiveDpi: 240,
                sourceWidthPx: 2400,
                sourceHeightPx: 3000,
                printWidthIn: 8,
                printHeightIn: 10,
                crop: { w: 1920, h: 2400 },
                outputWidthPx: 1920,
                outputHeightPx: 2400,
                assetUrl: productionImage,
            },
        };
        expect(validatePrintQuality(orderItem)).toBe(orderItem.printQuality);
        expect(() => validatePrintQuality({
            ...orderItem,
            printQuality: { ...orderItem.printQuality, effectiveDpi: 239 },
        })).toThrow(/240 DPI/);
        expect(() => validatePrintQuality({
            ...orderItem,
            printQuality: { ...orderItem.printQuality, assetUrl: 'https://images.example.com/other.jpg' },
        })).toThrow(/does not match/);
        expect(() => validatePrintQuality({
            ...orderItem,
            printQuality: { ...orderItem.printQuality, effectiveDpi: 300 },
        })).toThrow(/inconsistent/);
        expect(minimumDpiForSku('GLOBAL-FRA-SLIMCAN-16X20')).toBe(150);
        expect(minimumDpiForSku('ECO-FRA-CAN-16X20')).toBe(150);
    });

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

    it('puts a 50% gross margin on the base frame and passes upgrades, delivery and tax through', () => {
        const retail = createRetailQuote({
            quote: { shipmentMethod: 'Standard', costSummary: {
                items: { amount: '24.00', currency: 'GBP' },
                shipping: { amount: '7.85', currency: 'GBP' },
                totalTax: { amount: '5.97', currency: 'GBP' },
                totalCost: { amount: '37.82', currency: 'GBP' },
            } },
            baseQuote: { shipmentMethod: 'Standard', costSummary: { items: { amount: '22.00', currency: 'GBP' } } },
            input: { destinationCountryCode: 'GB', items: [item] },
            signingKey: 'test-secret', exchangeRates: { GBP: 20 },
        });
        expect(retail).toMatchObject({
            grossMarginPercent: 50,
            frame: { amount: 44, currency: 'GBP' },
            customizations: { amount: 2, currency: 'GBP' },
            items: { amount: 46, currency: 'GBP' },
            total: { amount: 59.82, currency: 'GBP' },
            totalGhs: 1197,
        });
        expect(verifyRetailQuoteToken(retail.token, 'test-secret')).toMatchObject({ sku: item.sku, retailTotalGbp: 59.82 });
        expect(() => verifyRetailQuoteToken(`${retail.token}x`, 'test-secret')).toThrow(/signature/i);
    });

    it('accepts only the matching uncustomized base SKU for a configurable frame', () => {
        const selected = buildQuotePayload({
            destinationCountryCode: 'GB',
            items: [{ sku: 'GLOBAL-CFPM-MOTH-8X10', copies: 1, attributes: { color: 'black', glaze: 'Motheye', mount: '2.4mm' } }],
        });
        expect(buildBaseQuotePayload({
            destinationCountryCode: 'GB',
            baseItem: { sku: 'GLOBAL-CFP-8X10', copies: 1, attributes: { color: 'black', glaze: 'Acrylic / Perspex', mount: 'No mount / Mat' } },
        }, selected).items[0].sku).toBe('GLOBAL-CFP-8X10');
        expect(() => buildBaseQuotePayload({
            destinationCountryCode: 'GB',
            baseItem: { sku: 'GLOBAL-CFP-A5', copies: 1, attributes: { color: 'black', glaze: 'Acrylic / Perspex', mount: 'No mount / Mat' } },
        }, selected)).toThrow(/base frame/i);
    });

    it('allows the standard image wrap as the base for other canvas edge finishes', () => {
        const selected = buildQuotePayload({
            destinationCountryCode: 'GB',
            items: [{ sku: 'GLOBAL-CAN-8X10', copies: 1, attributes: { wrap: 'MirrorWrap' } }],
        });
        const base = buildBaseQuotePayload({
            destinationCountryCode: 'GB',
            baseItem: { sku: 'GLOBAL-CAN-8X10', copies: 1, attributes: { wrap: 'ImageWrap' } },
        }, selected);
        expect(base.items[0].attributes.wrap).toBe('ImageWrap');
    });
});
