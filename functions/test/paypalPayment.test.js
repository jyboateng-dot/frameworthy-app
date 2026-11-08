import { describe, it, expect, beforeEach, vi } from 'vitest';
import admin from 'firebase-admin';
import { createPayPalOrder, capturePayPalOrder } from '../index.js';
import { clearFirestore } from './helpers.js';

const originalFetch = global.fetch;
const db = () => admin.firestore();

const item100 = () => ({
    selectedFrame: { id: 'frame-canvas' },
    selectedSize: { id: 'custom-60x100' },
    matWidth: 'none',
    quantity: 1,
});

async function seedOrder(id) {
    await db().collection('orders').doc(id).set({
        userId: 'guest', totalPrice: 100, currency: 'GBP', paymentStatus: 'pending', items: [item100()],
    });
}

function mockPayPal({ createdId = 'PAYPAL-ORDER-1', customId = 'order1', amount = '100.00' } = {}) {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, options = {}) => {
        const target = String(url);
        if (target.endsWith('/v1/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'token' }) };
        if (target.endsWith('/v2/checkout/orders') && options.method === 'POST') return { ok: true, status: 201, json: async () => ({ id: createdId }) };
        if (target.endsWith(`/v2/checkout/orders/${createdId}`) && options.method !== 'POST') {
            return { ok: true, status: 200, json: async () => ({
                id: createdId,
                purchase_units: [{ custom_id: customId, amount: { currency_code: 'GBP', value: amount } }],
            }) };
        }
        if (target.endsWith(`/v2/checkout/orders/${createdId}/capture`)) {
            return { ok: true, status: 201, json: async () => ({
                status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED', amount: { currency_code: 'GBP', value: amount } }] } }],
            }) };
        }
        return originalFetch(url, options);
    });
}

beforeEach(async () => {
    await clearFirestore();
    vi.restoreAllMocks();
});

describe('PayPal payment functions', () => {
    it('creates a PayPal order from the server-computed GBP total', async () => {
        await seedOrder('order1');
        mockPayPal();

        await expect(createPayPalOrder.run({ data: { orderId: 'order1' } })).resolves.toEqual({ id: 'PAYPAL-ORDER-1' });
        const creationCall = global.fetch.mock.calls.find(([url, options]) => String(url).endsWith('/v2/checkout/orders') && options.method === 'POST');
        expect(JSON.parse(creationCall[1].body).purchase_units[0]).toMatchObject({
            custom_id: 'order1', amount: { currency_code: 'GBP', value: '100.00' },
        });
    });

    it('only marks the order paid after a matching completed PayPal capture', async () => {
        await seedOrder('order1');
        mockPayPal();

        await expect(capturePayPalOrder.run({ data: { orderId: 'order1', paypalOrderId: 'PAYPAL-ORDER-1' } }))
            .resolves.toMatchObject({ success: true, captureId: 'CAPTURE-1' });
        const order = (await db().collection('orders').doc('order1').get()).data();
        expect(order).toMatchObject({ paymentStatus: 'paid', paymentProvider: 'paypal', paypalOrderId: 'PAYPAL-ORDER-1' });
    });

    it('rejects a PayPal order that belongs to a different FrameWorthy order', async () => {
        await seedOrder('order1');
        mockPayPal({ customId: 'other-order' });

        await expect(capturePayPalOrder.run({ data: { orderId: 'order1', paypalOrderId: 'PAYPAL-ORDER-1' } }))
            .rejects.toMatchObject({ code: 'failed-precondition' });
        expect((await db().collection('orders').doc('order1').get()).data().paymentStatus).toBe('pending');
    });
});
