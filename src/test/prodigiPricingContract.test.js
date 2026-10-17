import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import prodigiCatalog from '../data/prodigiCatalog.json';
import { prodigiAttributesForProduct } from '../services/prodigi';
import { prodigiBaseProductForProduct } from '../utils/prodigiFlow';

const require = createRequire(import.meta.url);
const { buildBaseQuotePayload, buildQuotePayload } = require('../../functions/prodigi.js');

describe('customer pricing contract', () => {
    it('resolves every imported GB/JE configuration to a server-approved base product', () => {
        for (const product of prodigiCatalog.products) {
            const destinationCountryCode = product.markets?.GB ? 'GB' : product.markets?.JE ? 'JE' : null;
            if (!destinationCountryCode) continue;
            const baseProduct = prodigiBaseProductForProduct(product, destinationCountryCode);
            const selected = buildQuotePayload({
                destinationCountryCode,
                items: [{ sku: product.sku, copies: 1, attributes: prodigiAttributesForProduct(product) }],
            });
            expect(() => buildBaseQuotePayload({
                destinationCountryCode,
                baseItem: { sku: baseProduct.sku, copies: 1, attributes: prodigiAttributesForProduct(baseProduct) },
            }, selected), `${product.family} · ${product.sku} → ${baseProduct.sku} · ${product.sizeCm}`).not.toThrow();
        }
    });
});
