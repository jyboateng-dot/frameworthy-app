import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { paystackWebhook } from '../index.js';
import { clearFirestore } from './helpers.js';

const db = () => admin.firestore();
const SECRET = 'test-paystack-secret'; // matches setup.js's PAYSTACK_SECRET_KEY

// paystackWebhook is a raw onRequest handler (req, res) => {} — not an
// onCall, so there's no .run() helper. Build the minimal req/res shape the
// handler actually reads: method, rawBody (for HMAC), get() for the
// signature header, body (parsed), and a res that records what was sent.
const makeReq = (payload, { signature, method = 'POST' } = {}) => {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = signature !== undefined ? signature : crypto.createHmac('sha512', SECRET).update(rawBody).digest('hex');
    return {
        method,
        rawBody,
        body: payload,
        get: (header) => (header.toLowerCase() === 'x-paystack-signature' ? sig : undefined),
    };
};

const makeRes = () => {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (body) => { res.body = body; return res; };
    return res;
};

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

const chargeSuccessEvent = ({ orderId, reference, amount = 10000, currency = 'GHS' }) => ({
    event: 'charge.success',
    data: { reference, amount, currency, metadata: { orderId } },
});

beforeEach(async () => {
    await clearFirestore();
});

describe('paystackWebhook', () => {
    it('rejects non-POST requests', async () => {
        const res = makeRes();
        await paystackWebhook(makeReq({}, { method: 'GET' }), res);
        expect(res.statusCode).toBe(405);
    });

    it('rejects a request with a missing signature', async () => {
        const res = makeRes();
        await paystackWebhook(makeReq({ event: 'charge.success' }, { signature: '' }), res);
        expect(res.statusCode).toBe(401);
    });

    it('rejects a request with a wrong signature', async () => {
        const res = makeRes();
        await paystackWebhook(makeReq({ event: 'charge.success' }, { signature: 'not-the-real-signature' }), res);
        expect(res.statusCode).toBe(401);
    });

    it('acknowledges but ignores non-charge.success events', async () => {
        const res = makeRes();
        await paystackWebhook(makeReq({ event: 'transfer.success', data: {} }), res);
        expect(res.statusCode).toBe(200);
    });

    it('acknowledges charge.success events missing orderId/reference without touching Firestore', async () => {
        const res = makeRes();
        await paystackWebhook(makeReq({ event: 'charge.success', data: { amount: 100 } }), res);
        expect(res.statusCode).toBe(200);
    });

    it('marks a pending order paid on a valid charge.success event', async () => {
        await seedOrder('order1', { totalPrice: 100, currency: 'GHS' });
        const res = makeRes();

        await paystackWebhook(makeReq(chargeSuccessEvent({ orderId: 'order1', reference: 'ref1' })), res);
        expect(res.statusCode).toBe(200);

        const order = (await db().collection('orders').doc('order1').get()).data();
        expect(order.paymentStatus).toBe('paid');
        expect(order.paystackReference).toBe('ref1');
    });

    it('is idempotent — a repeated webhook delivery for an already-paid order is a no-op success', async () => {
        await seedOrder('order1', { totalPrice: 100, currency: 'GHS' });
        const first = makeRes();
        await paystackWebhook(makeReq(chargeSuccessEvent({ orderId: 'order1', reference: 'ref1' })), first);
        expect(first.statusCode).toBe(200);

        const second = makeRes();
        await paystackWebhook(makeReq(chargeSuccessEvent({ orderId: 'order1', reference: 'ref1' })), second);
        expect(second.statusCode).toBe(200);
    });

    it('does not mark an order paid when the webhook amount does not match the recomputed price', async () => {
        await seedOrder('order1', { totalPrice: 100, currency: 'GHS' });
        const res = makeRes();

        await paystackWebhook(makeReq(chargeSuccessEvent({ orderId: 'order1', reference: 'ref1', amount: 1 })), res);
        // Still 200 — a bad amount isn't a delivery failure Paystack should retry.
        expect(res.statusCode).toBe(200);

        const order = (await db().collection('orders').doc('order1').get()).data();
        expect(order.paymentStatus).toBe('pending');
    });

    it('this-then-client-call race: whichever finalizes first wins, the other is a no-op', async () => {
        // Simulates the exact scenario this function exists for: the webhook
        // arrives and finalizes the order before (or instead of) the
        // client's own verifyPaystackPayment call ever completing.
        await seedOrder('order1', { totalPrice: 100, currency: 'GHS' });
        const res = makeRes();
        await paystackWebhook(makeReq(chargeSuccessEvent({ orderId: 'order1', reference: 'ref1' })), res);

        const order = (await db().collection('orders').doc('order1').get()).data();
        expect(order.paymentStatus).toBe('paid');

        const claim = (await db().collection('paystackReferences').doc('ref1').get()).data();
        expect(claim.orderId).toBe('order1');
    });
});
