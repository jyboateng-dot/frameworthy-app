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
