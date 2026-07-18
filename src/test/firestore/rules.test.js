import { readFileSync } from 'fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let testEnv;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'demo-frameworthy-rules-test',
        firestore: {
            rules: readFileSync('firestore.rules', 'utf8'),
            host: 'localhost',
            port: 8080,
        },
    });
});

afterAll(async () => {
    await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

const ADMIN_EMAIL = 'admin@frameworthyco.com';

const pendingOrder = (overrides = {}) => ({
    paymentStatus: 'pending',
    totalPrice: 100,
    currency: 'GHS',
    ...overrides,
});

describe('orders collection', () => {
    describe('create', () => {
        it('allows a guest to create a pending order with userId "guest"', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertSucceeds(setDoc(doc(guest, 'orders/order1'), pendingOrder({ userId: 'guest' })));
        });

        it('blocks a guest from creating an order under someone else\'s uid', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertFails(setDoc(doc(guest, 'orders/order1'), pendingOrder({ userId: 'someone-else' })));
        });

        it('allows a signed-in user to create a pending order under their own uid', async () => {
            const alice = testEnv.authenticatedContext('alice').firestore();
            await assertSucceeds(setDoc(doc(alice, 'orders/order1'), pendingOrder({ userId: 'alice' })));
        });

        it('blocks a signed-in user from creating an order under a different uid', async () => {
            const alice = testEnv.authenticatedContext('alice').firestore();
            await assertFails(setDoc(doc(alice, 'orders/order1'), pendingOrder({ userId: 'bob' })));
        });

        it('blocks creating an order that is already marked paid (payment bypass)', async () => {
            const alice = testEnv.authenticatedContext('alice').firestore();
            await assertFails(setDoc(doc(alice, 'orders/order1'), pendingOrder({ userId: 'alice', paymentStatus: 'paid' })));

            const guest = testEnv.unauthenticatedContext().firestore();
            await assertFails(setDoc(doc(guest, 'orders/order2'), pendingOrder({ userId: 'guest', paymentStatus: 'paid' })));
        });
    });

    describe('read', () => {
        beforeEach(async () => {
            await testEnv.withSecurityRulesDisabled(async (ctx) => {
                const db = ctx.firestore();
                await setDoc(doc(db, 'orders/alice-order'), pendingOrder({ userId: 'alice' }));
                await setDoc(doc(db, 'orders/bob-order'), pendingOrder({ userId: 'bob' }));
            });
        });

        it('lets a signed-in user read their own order', async () => {
            const alice = testEnv.authenticatedContext('alice').firestore();
            await assertSucceeds(getDoc(doc(alice, 'orders/alice-order')));
        });

        it('blocks a signed-in user from reading someone else\'s order', async () => {
            const alice = testEnv.authenticatedContext('alice').firestore();
            await assertFails(getDoc(doc(alice, 'orders/bob-order')));
        });

        it('blocks an unauthenticated user from reading any order', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertFails(getDoc(doc(guest, 'orders/alice-order')));
        });

        it('lets the admin read any order', async () => {
            const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL }).firestore();
            await assertSucceeds(getDoc(doc(admin, 'orders/alice-order')));
            await assertSucceeds(getDoc(doc(admin, 'orders/bob-order')));
        });
    });

    describe('update', () => {
        beforeEach(async () => {
            await testEnv.withSecurityRulesDisabled(async (ctx) => {
                await setDoc(doc(ctx.firestore(), 'orders/alice-order'), pendingOrder({ userId: 'alice' }));
            });
        });

        it('blocks the order owner from updating their own order (e.g. self-marking paid)', async () => {
            const alice = testEnv.authenticatedContext('alice').firestore();
            await assertFails(updateDoc(doc(alice, 'orders/alice-order'), { paymentStatus: 'paid' }));
        });

        it('lets the admin update an order', async () => {
            const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL }).firestore();
            await assertSucceeds(updateDoc(doc(admin, 'orders/alice-order'), { status: 'shipped' }));
        });
    });

    describe('delete', () => {
        beforeEach(async () => {
            await testEnv.withSecurityRulesDisabled(async (ctx) => {
                await setDoc(doc(ctx.firestore(), 'orders/alice-order'), pendingOrder({ userId: 'alice' }));
            });
        });

        it('is never allowed, even for the admin', async () => {
            const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL }).firestore();
            await assertFails(deleteDoc(doc(admin, 'orders/alice-order')));
        });
    });
});

describe('clientErrors collection', () => {
    const validError = (overrides = {}) => ({
        message: 'Something broke',
        url: 'https://frameworthy.app/checkout',
        platform: 'web',
        ...overrides,
    });

    it('allows an unauthenticated client to log a small error report', async () => {
        const guest = testEnv.unauthenticatedContext().firestore();
        await assertSucceeds(setDoc(doc(guest, 'clientErrors/err1'), validError()));
    });

    it('rejects a message over 1000 characters', async () => {
        const guest = testEnv.unauthenticatedContext().firestore();
        await assertFails(setDoc(doc(guest, 'clientErrors/err1'), validError({ message: 'x'.repeat(1001) })));
    });

    it('rejects a stack trace over 4000 characters', async () => {
        const guest = testEnv.unauthenticatedContext().firestore();
        await assertFails(setDoc(doc(guest, 'clientErrors/err1'), validError({ stack: 'x'.repeat(4001) })));
    });

    it('allows a null stack (optional field)', async () => {
        const guest = testEnv.unauthenticatedContext().firestore();
        await assertSucceeds(setDoc(doc(guest, 'clientErrors/err1'), validError({ stack: null })));
    });

    it('rejects a report missing the required platform field', async () => {
        const guest = testEnv.unauthenticatedContext().firestore();
        const { platform, ...rest } = validError();
        await assertFails(setDoc(doc(guest, 'clientErrors/err1'), rest));
    });

    it('blocks a non-admin from reading error reports', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'clientErrors/err1'), validError());
        });
        const alice = testEnv.authenticatedContext('alice').firestore();
        await assertFails(getDoc(doc(alice, 'clientErrors/err1')));
    });

    it('lets the admin read error reports', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'clientErrors/err1'), validError());
        });
        const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL }).firestore();
        await assertSucceeds(getDoc(doc(admin, 'clientErrors/err1')));
    });

    it('never allows updates or deletes, even from the admin', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'clientErrors/err1'), validError());
        });
        const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL }).firestore();
        await assertFails(updateDoc(doc(admin, 'clientErrors/err1'), { message: 'edited' }));
        await assertFails(deleteDoc(doc(admin, 'clientErrors/err1')));
    });
});

describe('default-deny collections', () => {
    it('blocks any client read/write to paystackReferences (Admin-SDK-only)', async () => {
        const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL }).firestore();
        await assertFails(setDoc(doc(admin, 'paystackReferences/ref1'), { orderId: 'order1' }));

        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'paystackReferences/ref1'), { orderId: 'order1' });
        });
        await assertFails(getDoc(doc(admin, 'paystackReferences/ref1')));
    });

    it('blocks any client read/write to an unlisted collection', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await assertFails(setDoc(doc(alice, 'projects/p1'), { name: 'test' }));
    });
});
