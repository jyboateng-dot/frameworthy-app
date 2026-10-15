import { describe, expect, it, vi } from 'vitest';
import { quoteCheckoutDestination } from './checkoutDelivery';

const items = [{ id: 'a', prodigi: { sku: 'TEST-SKU', destinationCountryCode: 'GB' } }, { id: 'b', prodigi: { sku: 'TEST-SKU', destinationCountryCode: 'GB' } }];
const resolveProduct = () => ({ sku: 'TEST-SKU' });
const goodQuote = { quotes: [{ shippingMethod: 'Standard', total: { amount: 40, currency: 'GBP' }, retail: { token: 'new-token' } }] };

describe('checkout destination quotes', () => {
    it('refreshes every selected item with the new destination and quote', async () => {
        const updates = await quoteCheckoutDestination(items, 'JE', { resolveProduct, quoteProduct: vi.fn().mockResolvedValue(goodQuote) });
        expect(updates).toHaveLength(2);
        expect(updates[0]).toMatchObject({ id: 'a', totalPrice: 40, prodigi: { destinationCountryCode: 'JE', quoteToken: 'new-token', quoteCurrency: 'GBP' } });
        expect(items[0].prodigi.destinationCountryCode).toBe('GB');
    });
    it('rejects the whole update if any destination quote fails', async () => {
        const quoteProduct = vi.fn().mockResolvedValueOnce(goodQuote).mockRejectedValueOnce(new Error('unavailable'));
        await expect(quoteCheckoutDestination(items, 'JE', { resolveProduct, quoteProduct })).rejects.toThrow('unavailable');
        expect(items.every(item => item.prodigi.destinationCountryCode === 'GB')).toBe(true);
    });
    it('never substitutes an unavailable SKU or accepts a non-GBP quote', async () => {
        await expect(quoteCheckoutDestination(items, 'JE', { resolveProduct: () => null })).rejects.toThrow('unavailable');
        await expect(quoteCheckoutDestination(items, 'JE', { resolveProduct, quoteProduct: vi.fn().mockResolvedValue({ quotes: [{ total: { amount: 20, currency: 'EUR' } }] }) })).rejects.toThrow('unavailable');
    });
});
