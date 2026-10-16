import { PROMO_CODES } from '../data/promoCodes';

// Sum of each checkout item's line total (unit price * quantity). Mirrors
// CartPage's own quantity accounting so the checkout subtotal never
// disagrees with what the cart displayed.
export const calculateSubtotal = (items) =>
    (items || []).reduce((sum, item) => sum + (item.totalPrice * (item.quantity || 1)), 0);

// Case-insensitive promo code lookup. Returns null for an unknown code so
// callers can distinguish "no code entered" from "invalid code" themselves.
export const resolvePromoCode = (input) => {
    const code = (input || '').trim().toUpperCase();
    if (!code) return null;
    const promo = PROMO_CODES[code];
    return promo ? { code, ...promo } : null;
};

// 'percent' discounts a % of the subtotal; 'fixed' discounts a flat GHS
// amount capped at the subtotal so a discount can never exceed the order.
export const calculatePromoDiscount = (subtotal, promo) => {
    if (!promo) return 0;
    return promo.type === 'percent'
        ? subtotal * (promo.value / 100)
        : Math.min(promo.value, subtotal);
};

export const calculateFinalTotal = (subtotal, discount) => Math.max(0, subtotal - discount);

/**
 * Computes the itemized buildup to the total cost:
 * - Items Subtotal
 * - Delivery / Shipping (Tracked Courier)
 * - Tax / VAT
 * - Total
 * Fulfills for United Kingdom & Jersey (GBP) via Prodigi live quote.
 */
export const computeOrderCostBreakdown = (items = [], currency = 'GBP') => {
    if (!items || items.length === 0) {
        return {
            itemsSubtotal: 0,
            deliveryCost: 0,
            taxCost: 0,
            isPayOnDelivery: false,
            hasItemizedQuote: false,
            isGbp: currency === 'GBP',
            lines: [],
        };
    }

    const isGbp = currency === 'GBP' || items.some(i => i.currency === 'GBP' || i.selectedFrame?.prodigiProduct);

    if (isGbp) {
        let itemsSubtotal = 0;
        let deliveryCost = 0;
        let taxCost = 0;
        let hasItemizedQuote = true;

        for (const item of items) {
            const qty = item.quantity || 1;
            const quoteItems = typeof item.prodigi?.quoteItemsGbp === 'number' ? item.prodigi.quoteItemsGbp : null;
            const quoteShipping = typeof item.prodigi?.quoteShippingGbp === 'number' ? item.prodigi.quoteShippingGbp : null;
            const quoteTax = typeof item.prodigi?.quoteTaxGbp === 'number' ? item.prodigi.quoteTaxGbp : 0;

            if (quoteItems !== null && quoteShipping !== null) {
                itemsSubtotal += quoteItems * qty;
                deliveryCost += quoteShipping * qty;
                taxCost += quoteTax * qty;
            } else {
                hasItemizedQuote = false;
                itemsSubtotal += (item.totalPrice || 0) * qty;
            }
        }

        const lines = [
            {
                key: 'subtotal',
                label: 'Items Subtotal',
                amount: itemsSubtotal,
            },
            {
                key: 'delivery',
                label: 'Tracked Delivery & Packaging',
                amount: hasItemizedQuote ? deliveryCost : 0,
                badge: hasItemizedQuote ? null : 'Included',
                description: 'Protective packaging & door-to-door courier',
            },
            {
                key: 'tax',
                label: 'VAT / Sales Tax',
                amount: hasItemizedQuote ? taxCost : 0,
                badge: hasItemizedQuote ? null : 'Included',
                description: 'Applicable standard destination tax',
            },
        ];

        const totalCost = itemsSubtotal + (hasItemizedQuote ? deliveryCost + taxCost : 0);

        return {
            lines,
            itemsSubtotal,
            deliveryCost: hasItemizedQuote ? deliveryCost : 0,
            taxCost: hasItemizedQuote ? taxCost : 0,
            totalCost,
            hasItemizedQuote,
            isPayOnDelivery: false,
            isGbp: true,
        };
    }

    // Ghana (GHS) Local Orders
    const itemsSubtotal = items.reduce((sum, item) => sum + ((item.totalPrice || 0) * (item.quantity || 1)), 0);

    const lines = [
        {
            key: 'subtotal',
            label: 'Items Subtotal',
            amount: itemsSubtotal,
        },
        {
            key: 'delivery',
            label: 'Delivery',
            amount: 0,
            badge: 'Pay on delivery',
            isPayOnDelivery: true,
            description: 'Paid directly to courier upon arrival',
        },
        {
            key: 'tax',
            label: 'Tax (VAT)',
            amount: 0,
            badge: 'Included in price',
            description: 'All local taxes are included in item price',
        },
    ];

    return {
        lines,
        itemsSubtotal,
        deliveryCost: 0,
        taxCost: 0,
        totalCost: itemsSubtotal,
        isPayOnDelivery: true,
        hasItemizedQuote: false,
        isGbp: false,
    };
};

/**
 * Computes an itemized breakdown for a single item (e.g. Prodigi itemized delivery & tax).
 */
export const computeItemCostBreakdown = (item) => {
    if (!item) return [];
    const isProdigi = Boolean(item.currency === 'GBP' || item.selectedFrame?.prodigiProduct || item.prodigi);

    if (isProdigi) {
        const quoteItems = typeof item.prodigi?.quoteItemsGbp === 'number' ? item.prodigi.quoteItemsGbp : null;
        const quoteShipping = typeof item.prodigi?.quoteShippingGbp === 'number' ? item.prodigi.quoteShippingGbp : null;
        const quoteTax = typeof item.prodigi?.quoteTaxGbp === 'number' ? item.prodigi.quoteTaxGbp : null;

        if (quoteItems !== null && quoteShipping !== null) {
            const list = [
                { label: 'Item', amount: quoteItems, currency: 'GBP' },
                { label: 'Delivery', amount: quoteShipping, currency: 'GBP' },
            ];
            if (quoteTax) list.push({ label: 'VAT', amount: quoteTax, currency: 'GBP' });
            return list;
        }
        return [
            { label: 'Item', amount: item.totalPrice, currency: 'GBP' },
            { label: 'Delivery & Tax', badge: 'Included in quote' },
        ];
    }

    return [];
};
