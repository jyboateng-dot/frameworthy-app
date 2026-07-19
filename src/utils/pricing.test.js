import { describe, it, expect } from 'vitest';
import { calculateSubtotal, resolvePromoCode, calculatePromoDiscount, calculateFinalTotal } from './pricing';

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
