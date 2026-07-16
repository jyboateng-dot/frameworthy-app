// Promo codes are matched case-insensitively (checkout uppercases input
// before lookup). type 'percent' discounts a % of the subtotal, 'fixed'
// discounts a flat GHS amount (capped at the subtotal so a total can't go
// negative).
export const PROMO_CODES = {
    WELCOME10: { type: 'percent', value: 10, description: '10% off your first order' },
    FRAME20: { type: 'percent', value: 20, description: '20% off — Special Offer' },
    FRIEND15: { type: 'percent', value: 15, description: '15% off — Referral discount' },
    SAVE50: { type: 'fixed', value: 50, description: 'GHS 50 off' },
};
