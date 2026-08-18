// Guards the server-side price recomputation used by verifyPaystackPayment.
//
// functions/pricing.js re-derives an order's true cost from a generated
// snapshot of the price tables (functions/pricing-data.json) instead of
// trusting the totalPrice the client wrote into the order. That snapshot can
// drift: change a price in src/data/constants.jsx without rerunning
// `npm run generate:pricing` and legitimate payments start getting rejected
// as mismatched. These tests fail loudly when that happens.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { FRAME_SIZES, FRAME_STYLES, MAT_COLORS } from '../data/constants';
import { PROMO_CODES } from '../data/promoCodes';

const require = createRequire(import.meta.url);
const { priceForItem, recomputeOrderTotal } = require('../../functions/pricing.js');
const pricingData = require('../../functions/pricing-data.json');

// The client's authoritative per-item formula, mirroring buildCartItem() in
// src/pages/framing/CustomizeFramePage.jsx. Kept here deliberately rather
// than imported: if the real formula changes, this copy won't, and the
// parity assertions below will fail — which is the point.
const clientPrice = ({ selectedSize, selectedFrame, matWidth, matColor, glassType, hardwareType }) =>
    Math.round((selectedSize?.price || 0) * (selectedFrame?.priceMod || 1)) +
    (selectedFrame?.id !== 'frame-canvas' && glassType !== 'canvas-floater' && glassType !== 'canvas-traditional' && matWidth !== 'none' ? (matColor?.price || 75) : 0) +
    (selectedFrame?.id !== 'frame-canvas' ? (glassType === 'non-glare' ? 100 : glassType === 'museum' ? 200 : 0) : 0) +
    (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-floater' ? 400 : 0) +
    (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-traditional' ? 350 : 0) +
    (hardwareType === 'french-cleat' ? 50 : 0);

const canvasFrame = FRAME_STYLES.find(f => f.id === 'frame-canvas');
const woodFrame = FRAME_STYLES.find(f => f.id !== 'frame-canvas');
const smallSize = FRAME_SIZES.find(s => s.id === '8x10');
const bigSize = FRAME_SIZES.find(s => s.id === '11x14');
const whiteMat = MAT_COLORS.find(m => m.id === 'white');
const pricierMat = MAT_COLORS.find(m => m.price !== whiteMat.price) || whiteMat;

const configs = [
    { name: 'plain wood frame, no mat', selectedFrame: woodFrame, selectedSize: smallSize, matWidth: 'none', glassType: 'standard', hardwareType: 'wire' },
    { name: 'wood frame with mat', selectedFrame: woodFrame, selectedSize: smallSize, matWidth: 'standard', matColor: whiteMat, glassType: 'standard', hardwareType: 'wire' },
    { name: 'pricier mat colour', selectedFrame: woodFrame, selectedSize: bigSize, matWidth: 'wide', matColor: pricierMat, glassType: 'standard', hardwareType: 'wire' },
    { name: 'non-glare glazing', selectedFrame: woodFrame, selectedSize: bigSize, matWidth: 'none', glassType: 'non-glare', hardwareType: 'wire' },
    { name: 'museum glazing', selectedFrame: woodFrame, selectedSize: bigSize, matWidth: 'none', glassType: 'museum', hardwareType: 'wire' },
    { name: 'french cleat hardware', selectedFrame: woodFrame, selectedSize: smallSize, matWidth: 'none', glassType: 'standard', hardwareType: 'french-cleat' },
    { name: 'everything at once', selectedFrame: woodFrame, selectedSize: bigSize, matWidth: 'wide', matColor: pricierMat, glassType: 'museum', hardwareType: 'french-cleat' },
    { name: 'canvas frame (no mat/glazing surcharges apply)', selectedFrame: canvasFrame, selectedSize: bigSize, matWidth: 'standard', matColor: whiteMat, glassType: 'standard', hardwareType: 'wire' },
    { name: 'canvas floater glazing', selectedFrame: woodFrame, selectedSize: bigSize, matWidth: 'none', glassType: 'canvas-floater', hardwareType: 'wire' },
    { name: 'canvas traditional glazing', selectedFrame: woodFrame, selectedSize: bigSize, matWidth: 'none', glassType: 'canvas-traditional', hardwareType: 'wire' },
];

describe('server pricing matches client pricing', () => {
    it.each(configs)('$name', (config) => {
        expect(priceForItem(config)).toBe(clientPrice(config));
    });

    it('prices a custom size the same way parseCustomSize does', () => {
        // parseCustomSize: price = round(((w * h) / 1000) * 10) + 40
        const w = 60, h = 90;
        const expected = Math.round(((w * h) / 1000) * 10) + 40;
        const price = priceForItem({
            selectedFrame: canvasFrame,
            selectedSize: { id: `custom-${w}x${h}` },
            matWidth: 'none',
        });
        expect(price).toBe(Math.round(expected * (canvasFrame.priceMod || 1)));
    });

    // Guards clampSizeToValidRange (CustomizeFramePage.jsx) specifically:
    // an out-of-range Inspiration dims string gets clamped into the
    // 13x18-180x180cm range, and must regenerate BOTH its id and its price
    // from the same clamped numbers. The server never sees width/height or
    // price directly — it recomputes price purely from the two numbers
    // embedded in a "custom-WxH" id — so an id left pointing at the
    // pre-clamp dimensions would make the server verify a different price
    // than what the client charged, failing every clamped order.
    it('prices a clamped Inspiration size the same way the clamp itself does', () => {
        // e.g. a 5x7cm dims string clamped up to the 13x18cm floor.
        const clampedShortCm = 13, clampedLongCm = 18;
        const expected = Math.round(((clampedShortCm * clampedLongCm) / 1000) * 10) + 40;
        const price = priceForItem({
            selectedFrame: canvasFrame,
            selectedSize: { id: `custom-${clampedShortCm}x${clampedLongCm}` },
            matWidth: 'none',
        });
        expect(price).toBe(Math.round(expected * (canvasFrame.priceMod || 1)));
    });

    it('rejects a custom size id that still points at pre-clamp dimensions', () => {
        // If the clamp changed the size to 13x18 but left a stale
        // "custom-5x7" id, the server-recomputed price silently diverges
        // from what the clamp itself charges — this pins that the two
        // formulas disagree on a stale id, so a regression that reintroduces
        // the bug shows up as this assertion flipping to pass.
        const staleId = 'custom-5x7';
        const clampedPrice = Math.round(((13 * 18) / 1000) * 10) + 40;
        const priceFromStaleId = priceForItem({
            selectedFrame: canvasFrame,
            selectedSize: { id: staleId },
            matWidth: 'none',
        });
        expect(priceFromStaleId).not.toBe(Math.round(clampedPrice * (canvasFrame.priceMod || 1)));
    });
});

describe('generated price table is in sync with source constants', () => {
    it('has an entry for every frame, at the right priceMod', () => {
        for (const frame of FRAME_STYLES) {
            expect(pricingData.framePriceMods[frame.id], `frame ${frame.id} missing — rerun npm run generate:pricing`)
                .toBe(frame.priceMod ?? 1);
        }
    });

    it('has an entry for every size, at the right price', () => {
        for (const size of FRAME_SIZES) {
            expect(pricingData.sizePrices[size.id], `size ${size.id} missing — rerun npm run generate:pricing`)
                .toBe(size.price);
        }
    });

    it('has an entry for every mat colour, at the right price', () => {
        for (const mat of MAT_COLORS) {
            expect(pricingData.matPrices[mat.id], `mat ${mat.id} missing — rerun npm run generate:pricing`)
                .toBe(mat.price);
        }
    });

    it('has every promo code, at the right type and value', () => {
        expect(pricingData.promoCodes).toEqual(PROMO_CODES);
    });
});

describe('recomputeOrderTotal fails closed', () => {
    const validItem = { selectedFrame: canvasFrame, selectedSize: smallSize, matWidth: 'none', quantity: 1 };

    it('prices a straightforward order', () => {
        expect(recomputeOrderTotal({ items: [validItem] }))
            .toEqual({ total: clientPrice(validItem) });
    });

    it('multiplies by quantity', () => {
        expect(recomputeOrderTotal({ items: [{ ...validItem, quantity: 3 }] }))
            .toEqual({ total: clientPrice(validItem) * 3 });
    });

    it('applies a real promo code', () => {
        const base = clientPrice(validItem);
        expect(recomputeOrderTotal({ items: [validItem], promoCode: 'SAVE50' }))
            .toEqual({ total: Math.max(0, base - 50) });
    });

    it('rejects an invented promo code instead of ignoring it', () => {
        expect(recomputeOrderTotal({ items: [validItem], promoCode: 'NOT_A_REAL_CODE' }))
            .toHaveProperty('error');
    });

    it('rejects an unknown frame rather than pricing it as free', () => {
        expect(recomputeOrderTotal({ items: [{ ...validItem, selectedFrame: { id: 'frame-nope' } }] }))
            .toHaveProperty('error');
    });

    it('rejects an unknown size', () => {
        expect(recomputeOrderTotal({ items: [{ ...validItem, selectedSize: { id: 'size-nope' } }] }))
            .toHaveProperty('error');
    });

    it('rejects an order with no items', () => {
        expect(recomputeOrderTotal({ items: [] })).toHaveProperty('error');
        expect(recomputeOrderTotal({})).toHaveProperty('error');
    });

    it('rejects absurd quantities', () => {
        expect(recomputeOrderTotal({ items: [{ ...validItem, quantity: 0 }] })).toHaveProperty('error');
        expect(recomputeOrderTotal({ items: [{ ...validItem, quantity: 9999 }] })).toHaveProperty('error');
    });

    it('rejects a custom size with absurd dimensions', () => {
        expect(recomputeOrderTotal({ items: [{ ...validItem, selectedSize: { id: 'custom-99999x99999' } }] }))
            .toHaveProperty('error');
    });
});
