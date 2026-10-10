import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const getProdigiQuoteCallable = httpsCallable(functions, 'getProdigiQuote');

// Live GHS price for one copy of a Prodigi SKU shipped to the UK or Jersey.
// Resolves to { quoteId, currency, destinationCountryCode, total, expiresAt }.
export async function getProdigiQuote({ sku, attributes, destinationCountryCode }) {
    const result = await getProdigiQuoteCallable({ items: [{ sku, attributes, copies: 1 }], destinationCountryCode });
    return result.data;
}

export const PRODIGI_DESTINATIONS = [
    { code: 'GB', label: 'United Kingdom' },
    { code: 'JE', label: 'Jersey' },
];

// A quote backs an order only until it expires; checkout asks for a fresh
// one when less than this much time is left.
export const PRODIGI_QUOTE_MIN_REMAINING_MS = 60 * 60 * 1000;

export const isProdigiCartItem = (item) => Boolean(item?.prodigiQuoteId || item?.selectedFrame?.prodigiProduct);
