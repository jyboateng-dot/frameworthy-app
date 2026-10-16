import { describe, it, expect } from 'vitest';
import {
    calculateSubtotal,
    resolvePromoCode,
    calculatePromoDiscount,
    calculateFinalTotal,
    computeOrderCostBreakdown,
    computeItemCostBreakdown,
} from './pricing';

describe('calculateSubtotal', () => {
    it('returns 0 for an empty cart', () => {
        expect(calculateSubtotal([])).toBe(0);
    });

    it('sums unit price times quantity across items', () => {
        const items = [
            { totalPrice: 100, quantity: 2 },
            { totalPrice: 50, quantity: 1 },
        ];
        expect(calculateSubtotal(items)).toBe(250);
    });

    it('treats a missing quantity as 1', () => {
        expect(calculateSubtotal([{ totalPrice: 75 }])).toBe(75);
    });
});

describe('resolvePromoCode', () => {
    it('returns null when no code is entered', () => {
        expect(resolvePromoCode('')).toBeNull();
        expect(resolvePromoCode('   ')).toBeNull();
        expect(resolvePromoCode(undefined)).toBeNull();
    });

    it('returns null for an unknown code', () => {
        expect(resolvePromoCode('NOTREAL')).toBeNull();
    });

    it('is case-insensitive and trims whitespace', () => {
        expect(resolvePromoCode('  welcome10  ')).toEqual({
            code: 'WELCOME10',
            type: 'percent',
            value: 10,
            description: '10% off your first order',
        });
    });

    it('resolves a fixed-amount code', () => {
        expect(resolvePromoCode('SAVE50')).toEqual({
            code: 'SAVE50',
            type: 'fixed',
            value: 50,
            description: 'GHS 50 off',
        });
    });
});

describe('calculatePromoDiscount', () => {
    it('is 0 with no promo applied', () => {
        expect(calculatePromoDiscount(500, null)).toBe(0);
    });

    it('computes a percentage of the subtotal', () => {
        expect(calculatePromoDiscount(200, { type: 'percent', value: 20 })).toBe(40);
    });

    it('applies a fixed discount as-is when under the subtotal', () => {
        expect(calculatePromoDiscount(200, { type: 'fixed', value: 50 })).toBe(50);
    });

    it('caps a fixed discount at the subtotal so it cannot exceed the order', () => {
        expect(calculatePromoDiscount(30, { type: 'fixed', value: 50 })).toBe(30);
    });
});

describe('calculateFinalTotal', () => {
    it('subtracts the discount from the subtotal', () => {
        expect(calculateFinalTotal(200, 40)).toBe(160);
    });

    it('never goes negative', () => {
        expect(calculateFinalTotal(30, 50)).toBe(0);
    });
});

describe('end-to-end promo application', () => {
    it('WELCOME10 takes 10% off a multi-item subtotal', () => {
        const subtotal = calculateSubtotal([
            { totalPrice: 300, quantity: 1 },
            { totalPrice: 100, quantity: 2 },
        ]);
        expect(subtotal).toBe(500);

        const promo = resolvePromoCode('welcome10');
        const discount = calculatePromoDiscount(subtotal, promo);
        expect(discount).toBe(50);
        expect(calculateFinalTotal(subtotal, discount)).toBe(450);
    });

    it('a fixed discount larger than the subtotal clamps the total to 0, not negative', () => {
        const subtotal = calculateSubtotal([{ totalPrice: 20, quantity: 1 }]);
        const promo = resolvePromoCode('SAVE50');
        const discount = calculatePromoDiscount(subtotal, promo);
        expect(calculateFinalTotal(subtotal, discount)).toBe(0);
    });
});

describe('computeOrderCostBreakdown', () => {
    it('returns empty lines for empty items', () => {
        const breakdown = computeOrderCostBreakdown([], 'GHS');
        expect(breakdown.lines).toEqual([]);
        expect(breakdown.itemsSubtotal).toBe(0);
    });

    it('computes Ghana (GHS) delivery and tax breakdown correctly', () => {
        const items = [
            { totalPrice: 650, quantity: 1 },
            { totalPrice: 200, quantity: 2 },
        ];

        const breakdown = computeOrderCostBreakdown(items, 'GHS');
        expect(breakdown.isGbp).toBe(false);
        expect(breakdown.itemsSubtotal).toBe(1050);
        expect(breakdown.deliveryCost).toBe(0);
        expect(breakdown.taxCost).toBe(0);
        expect(breakdown.isPayOnDelivery).toBe(true);

        const subtotalLine = breakdown.lines.find(l => l.key === 'subtotal');
        expect(subtotalLine.amount).toBe(1050);

        const deliveryLine = breakdown.lines.find(l => l.key === 'delivery');
        expect(deliveryLine.badge).toBe('Pay on delivery');
        expect(deliveryLine.isPayOnDelivery).toBe(true);

        const taxLine = breakdown.lines.find(l => l.key === 'tax');
        expect(taxLine.badge).toBe('Included in price');
    });

    it('computes Prodigi (GBP) breakdown with itemized delivery and tax', () => {
        const items = [
            {
                currency: 'GBP',
                totalPrice: 95.50,
                quantity: 1,
                prodigi: {
                    quoteItemsGbp: 72.00,
                    quoteShippingGbp: 12.50,
                    quoteTaxGbp: 11.00,
                },
            },
        ];

        const breakdown = computeOrderCostBreakdown(items, 'GBP');
        expect(breakdown.isGbp).toBe(true);
        expect(breakdown.itemsSubtotal).toBe(72.00);
        expect(breakdown.deliveryCost).toBe(12.50);
        expect(breakdown.taxCost).toBe(11.00);

        // Items Subtotal + Delivery + Tax === Total
        const sum = breakdown.itemsSubtotal + breakdown.deliveryCost + breakdown.taxCost;
        expect(sum).toBe(95.50);
        expect(breakdown.totalCost).toBe(95.50);

        expect(breakdown.lines).toHaveLength(3);
        expect(breakdown.lines[0].key).toBe('subtotal');
        expect(breakdown.lines[0].amount).toBe(72.00);
        expect(breakdown.lines[1].key).toBe('delivery');
        expect(breakdown.lines[1].amount).toBe(12.50);
        expect(breakdown.lines[2].key).toBe('tax');
        expect(breakdown.lines[2].amount).toBe(11.00);
    });

    it('handles Prodigi (GBP) fallback gracefully when quote breakdowns are missing', () => {
        const items = [
            {
                currency: 'GBP',
                totalPrice: 85.00,
                quantity: 2,
            },
        ];

        const breakdown = computeOrderCostBreakdown(items, 'GBP');
        expect(breakdown.isGbp).toBe(true);
        expect(breakdown.itemsSubtotal).toBe(170.00);
        expect(breakdown.hasItemizedQuote).toBe(false);

        const deliveryLine = breakdown.lines.find(l => l.key === 'delivery');
        expect(deliveryLine.badge).toBe('Included');

        const taxLine = breakdown.lines.find(l => l.key === 'tax');
        expect(taxLine.badge).toBe('Included');
    });
});

describe('computeItemCostBreakdown', () => {
    it('returns empty array if item is null or undefined or GHS', () => {
        expect(computeItemCostBreakdown(null)).toEqual([]);
        expect(computeItemCostBreakdown({ currency: 'GHS', totalPrice: 200 })).toEqual([]);
    });

    it('breaks down a Prodigi item with itemized quotes', () => {
        const item = {
            currency: 'GBP',
            totalPrice: 65,
            prodigi: {
                quoteItemsGbp: 48,
                quoteShippingGbp: 9.5,
                quoteTaxGbp: 7.5,
            },
        };

        const parts = computeItemCostBreakdown(item);
        expect(parts).toEqual([
            { label: 'Item', amount: 48, currency: 'GBP' },
            { label: 'Delivery', amount: 9.5, currency: 'GBP' },
            { label: 'VAT', amount: 7.5, currency: 'GBP' },
        ]);
    });
});
