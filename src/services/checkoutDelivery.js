import { getProdigiQuote } from './prodigi';
import { prodigiConfigurationFromSelection, resolveProdigiProduct } from '../utils/prodigiFlow';

export async function quoteCheckoutDestination(items, countryCode, { quoteProduct = getProdigiQuote, resolveProduct = resolveProdigiProduct } = {}) {
    if (!['GB', 'JE'].includes(countryCode)) throw new Error('Choose United Kingdom or Jersey for delivery.');
    const products = items.map(item => {
        const product = resolveProduct(item.selectedFrame, item.selectedSize, {
            ...prodigiConfigurationFromSelection(item.prodigi), destinationCountryCode: countryCode,
        });
        // Changing destination must never substitute the customer's product.
        if (!item.prodigi || !product || product.sku !== item.prodigi.sku) throw new Error('One of your items is unavailable for this destination. Please review it in your cart.');
        return product;
    });
    return Promise.all(items.map(async (item, index) => {
        const result = await quoteProduct({ product: products[index], destinationCountryCode: countryCode, shippingMethod: item.prodigi.shippingMethod || 'Standard' });
        const quote = result.quotes?.find(option => option.shippingMethod?.toLowerCase() === (item.prodigi.shippingMethod || 'Standard').toLowerCase()) || result.quotes?.[0];
        const amount = Number(quote?.total?.amount);
        if (quote?.total?.currency !== 'GBP' || !Number.isFinite(amount) || amount <= 0) throw new Error('Delivery pricing is unavailable. Your previous destination and quote are unchanged.');
        return {
            id: item.id,
            totalPrice: amount,
            prodigi: {
                ...item.prodigi,
                destinationCountryCode: countryCode,
                shippingMethod: quote.shippingMethod || 'Standard',
                quoteToken: quote.retail?.token || null,
                retailTotalGhs: quote.retail?.totalGhs || null,
                quoteTotalGbp: amount,
                quoteItemsGbp: Number(quote?.items?.amount) || null,
                quoteShippingGbp: Number(quote?.shipping?.amount) || null,
                quoteTaxGbp: Number(quote?.tax?.amount) || null,
                quoteCurrency: 'GBP',
                quoteExpiresAt: quote.retail?.expiresAt || null,
            },
        };
    }));
}
