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

const seedOrder = async (id, data) => {
    await db().collection('orders').doc(id).set({
        userId: 'alice',
        totalPrice: 100,
        currency: 'GHS',
        paymentStatus: 'pending',
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
});
