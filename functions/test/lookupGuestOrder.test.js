import { describe, it, expect, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { lookupGuestOrder } from '../index.js';
import { clearFirestore } from './helpers.js';

const db = () => admin.firestore();

// Firestore auto-ids are 20 chars of [A-Za-z0-9] — the function rejects other
// shapes before touching the database, so tests must use realistic ids.
const ORDER_ID = 'aB3xK9mQ7pL2nR5tV8wY';

const seedGuestOrder = async (overrides = {}) => {
    await db().collection('orders').doc(ORDER_ID).set({
        userId: 'guest',
        userEmail: 'Guest@Example.com',
        totalPrice: 321,
        currency: 'GHS',
        paymentStatus: 'paid',
        status: 'processing',
        createdAt: admin.firestore.Timestamp.fromMillis(1_785_200_000_000),
        items: [{ quantity: 2 }, { quantity: 1 }],
        shippingAddress: { address: 'Secret Street 1', phone: '0240000000', city: 'Accra' },
        ...overrides,
    });
};

beforeEach(async () => {
    await clearFirestore();
});

describe('lookupGuestOrder', () => {
    it('rejects a call missing orderId or email', async () => {
        await expect(lookupGuestOrder.run({ data: {} }))
            .rejects.toMatchObject({ code: 'invalid-argument' });
        await expect(lookupGuestOrder.run({ data: { orderId: ORDER_ID } }))
            .rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('returns status for a matching id + email pair, case-insensitively', async () => {
        await seedGuestOrder();
        const res = await lookupGuestOrder.run({
            data: { orderId: ORDER_ID, email: 'guest@example.com' },
        });
        expect(res).toMatchObject({
            orderId: ORDER_ID,
            paymentStatus: 'paid',
            status: 'processing',
            totalPrice: 321,
            currency: 'GHS',
            itemCount: 3,
        });
        expect(res.createdAt).toBe(1_785_200_000_000);
    });

    it('never returns shipping address, phone, or item detail', async () => {
        await seedGuestOrder();
        const res = await lookupGuestOrder.run({
            data: { orderId: ORDER_ID, email: 'guest@example.com' },
        });
        const serialized = JSON.stringify(res);
        expect(serialized).not.toContain('Secret Street');
        expect(serialized).not.toContain('0240000000');
        expect(res.items).toBeUndefined();
        expect(res.shippingAddress).toBeUndefined();
    });

    it('returns the same not-found for a wrong email as for a missing order', async () => {
        await seedGuestOrder();
        const wrongEmail = lookupGuestOrder.run({
            data: { orderId: ORDER_ID, email: 'attacker@example.com' },
        }).catch(e => e);
        const missingOrder = lookupGuestOrder.run({
            data: { orderId: 'zZ9zZ9zZ9zZ9zZ9zZ9zZ', email: 'guest@example.com' },
        }).catch(e => e);
        const [a, b] = await Promise.all([wrongEmail, missingOrder]);
        expect(a.code).toBe('not-found');
        expect(b.code).toBe('not-found');
        expect(a.message).toBe(b.message);
    });

    it('rejects malformed order ids without hitting the database', async () => {
        await expect(lookupGuestOrder.run({ data: { orderId: '../../etc/passwd', email: 'a@b.c' } }))
            .rejects.toMatchObject({ code: 'not-found' });
        await expect(lookupGuestOrder.run({ data: { orderId: 'short', email: 'a@b.c' } }))
            .rejects.toMatchObject({ code: 'not-found' });
    });

    it('also finds signed-in users orders (id + email is still a valid proof)', async () => {
        // Not guest-only on purpose: the pair is equally strong proof for a
        // signed-in customer checking from a logged-out device.
        await seedGuestOrder({ userId: 'some-real-uid' });
        const res = await lookupGuestOrder.run({
            data: { orderId: ORDER_ID, email: 'guest@example.com' },
        });
        expect(res.orderId).toBe(ORDER_ID);
    });
});
