import { describe, it, expect, beforeEach, vi } from 'vitest';
import admin from 'firebase-admin';
import { verifyPaystackPayment } from '../index.js';
import { clearFirestore } from './helpers.js';

const originalFetch = global.fetch;

const mockPaystackFetch = (respond) => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
        if (String(url).includes('api.paystack.co')) return respond(url, opts);
        return originalFetch(url, opts);
    });
};

const paystackSuccess = (overrides = {}) => ({
    ok: true,
    json: async () => ({
        status: true,
        data: { status: 'success', amount: 10000, currency: 'GHS', ...overrides },
    }),
});

const db = () => admin.firestore();

// A canvas frame (priceMod 1.0) at custom-60x100 prices to exactly GHS 100
// server-side — matching the GHS 100 / 10000-pesewa amounts these tests use.
// The order total is now recomputed from this configuration rather than read
// from totalPrice, so every seeded order needs a priceable item.
const item100 = (overrides = {}) => ({
    selectedFrame: { id: 'frame-canvas' },
    selectedSize: { id: 'custom-60x100' },
    matWidth: 'none',
    quantity: 1,
    ...overrides,
});

const seedOrder = async (id, data) => {
    await db().collection('orders').doc(id).set({
        userId: 'alice',
        totalPrice: 100,
        currency: 'GHS',
        paymentStatus: 'pending',
        items: [item100()],
        ...data,
    });
};

beforeEach(async () => {
    await clearFirestore();
    vi.restoreAllMocks();
});

describe('verifyPaystackPayment', () => {
    it('rejects a call missing reference or orderId', async () => {
        await expect(verifyPaystackPayment.run({ data: { orderId: 'o1' } })).rejects.toMatchObject({ code: 'invalid-argument' });
        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects when the order does not exist', async () => {
        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'missing' } }))
            .rejects.toMatchObject({ code: 'not-found' });
    });

    it('marks a pending order paid on a successful, matching verification', async () => {
        await seedOrder('order1', { totalPrice: 100, currency: 'GHS' });
        mockPaystackFetch(async () => paystackSuccess());

        const result = await verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } });
        expect(result).toEqual({ success: true, alreadyVerified: false });

        const order = (await db().collection('orders').doc('order1').get()).data();
        expect(order.paymentStatus).toBe('paid');
        expect(order.paystackReference).toBe('ref1');

        const claim = (await db().collection('paystackReferences').doc('ref1').get()).data();
        expect(claim.orderId).toBe('order1');
    });

    it('is idempotent for an order already marked paid — does not call Paystack again', async () => {
        await seedOrder('order1', { paymentStatus: 'paid' });
        const fetchSpy = vi.spyOn(global, 'fetch');

        const result = await verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } });
        expect(result).toEqual({ success: true, alreadyVerified: true });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects when Paystack cannot be reached', async () => {
        await seedOrder('order1');
        vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
            if (String(url).includes('api.paystack.co')) throw new Error('network down');
            return originalFetch(url, opts);
        });

        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
            .rejects.toMatchObject({ code: 'unavailable' });
    });

    it('rejects when the Paystack response body is not valid JSON', async () => {
        await seedOrder('order1');
        mockPaystackFetch(async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }));

        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
            .rejects.toMatchObject({ code: 'unavailable' });
    });

    it('rejects when Paystack reports the transaction as not successful', async () => {
        await seedOrder('order1');
        mockPaystackFetch(async () => ({
            ok: true,
            json: async () => ({ status: true, data: { status: 'failed' } }),
        }));

        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
            .rejects.toMatchObject({ code: 'failed-precondition' });

        const order = (await db().collection('orders').doc('order1').get()).data();
        expect(order.paymentStatus).toBe('pending');
    });

    it('rejects when the verified amount does not match the order total (tamper guard)', async () => {
        await seedOrder('order1', { totalPrice: 100, currency: 'GHS' });
        mockPaystackFetch(async () => paystackSuccess({ amount: 1 })); // 1 pesewa instead of 10000

        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
            .rejects.toMatchObject({ code: 'failed-precondition' });

        const order = (await db().collection('orders').doc('order1').get()).data();
        expect(order.paymentStatus).toBe('pending');
    });

    it('rejects when the verified currency does not match the order currency', async () => {
        await seedOrder('order1', { totalPrice: 100, currency: 'GHS' });
        mockPaystackFetch(async () => paystackSuccess({ currency: 'USD' }));

        await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
            .rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('rejects reusing a payment reference that already paid for a different order', async () => {
        await seedOrder('order1', { totalPrice: 100, currency: 'GHS' });
        await seedOrder('order2', { totalPrice: 100, currency: 'GHS' });
        mockPaystackFetch(async () => paystackSuccess());

        const first = await verifyPaystackPayment.run({ data: { reference: 'shared-ref', orderId: 'order1' } });
        expect(first).toEqual({ success: true, alreadyVerified: false });

        await expect(verifyPaystackPayment.run({ data: { reference: 'shared-ref', orderId: 'order2' } }))
            .rejects.toMatchObject({ code: 'already-exists' });

        const order2 = (await db().collection('orders').doc('order2').get()).data();
        expect(order2.paymentStatus).toBe('pending');
    });

    // The price is recomputed server-side from the order's configuration.
    // Before that, these checks compared the amount paid against the
    // client-written totalPrice, so an order could simply declare itself cheap.
    describe('server-side price recomputation', () => {
        it('rejects an order whose client-stated total undercuts the real price', async () => {
            // Real price of this configuration is GHS 100, but the order
            // claims GHS 1 and only GHS 1 was actually paid.
            await seedOrder('order1', { totalPrice: 1, currency: 'GHS' });
            mockPaystackFetch(async () => paystackSuccess({ amount: 100 })); // 100 pesewas = GHS 1

            await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
                .rejects.toMatchObject({ code: 'failed-precondition' });

            const order = (await db().collection('orders').doc('order1').get()).data();
            expect(order.paymentStatus).toBe('pending');
        });

        it('accepts payment of the real server-computed price even if totalPrice was tampered low', async () => {
            await seedOrder('order1', { totalPrice: 1, currency: 'GHS' });
            mockPaystackFetch(async () => paystackSuccess({ amount: 10000 })); // the true GHS 100

            const res = await verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } });
            expect(res).toEqual({ success: true, alreadyVerified: false });
        });

        it('prices multiple items and quantities', async () => {
            // 2 x GHS 100 = GHS 200
            await seedOrder('order1', {
                totalPrice: 200,
                items: [item100({ quantity: 2 })],
            });
            mockPaystackFetch(async () => paystackSuccess({ amount: 20000 }));

            const res = await verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } });
            expect(res).toEqual({ success: true, alreadyVerified: false });
        });

        it('applies a known promo code server-side', async () => {
            // SAVE50 is a fixed GHS 50 discount: 100 - 50 = 50
            await seedOrder('order1', { totalPrice: 50, promoCode: 'SAVE50' });
            mockPaystackFetch(async () => paystackSuccess({ amount: 5000 }));

            const res = await verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } });
            expect(res).toEqual({ success: true, alreadyVerified: false });
        });

        it('rejects an invented promo code rather than honouring the discount', async () => {
            await seedOrder('order1', { totalPrice: 1, promoCode: 'TOTALLY_FREE_99' });
            mockPaystackFetch(async () => paystackSuccess({ amount: 100 }));

            await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
                .rejects.toMatchObject({ code: 'failed-precondition' });
        });

        it('rejects an order referencing a product that is not in the price table', async () => {
            await seedOrder('order1', {
                items: [item100({ selectedFrame: { id: 'frame-does-not-exist' } })],
            });
            mockPaystackFetch(async () => paystackSuccess());

            await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
                .rejects.toMatchObject({ code: 'failed-precondition' });
        });

        it('rejects an order with no items rather than pricing it at zero', async () => {
            await seedOrder('order1', { items: [] });
            mockPaystackFetch(async () => paystackSuccess());

            await expect(verifyPaystackPayment.run({ data: { reference: 'ref1', orderId: 'order1' } }))
                .rejects.toMatchObject({ code: 'failed-precondition' });
        });
    });
});
