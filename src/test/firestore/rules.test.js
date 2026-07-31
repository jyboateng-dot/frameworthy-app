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
const SECOND_ADMIN_EMAIL = 'info@frameworthyco.com';

const pendingOrder = (overrides = {}) => ({
    paymentStatus: 'pending',
    totalPrice: 100,
    currency: 'GHS',
    items: [{ selectedFrame: { id: 'frame-canvas' }, selectedSize: { id: 'custom-60x100' }, quantity: 1 }],
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

        it('blocks an order with no items', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertFails(setDoc(doc(guest, 'orders/order1'), pendingOrder({ userId: 'guest', items: [] })));
        });

        it('blocks an order with an absurd item count (spam/abuse doc)', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            const manyItems = Array.from({ length: 51 }, () => ({ selectedFrame: { id: 'frame-canvas' } }));
            await assertFails(setDoc(doc(guest, 'orders/order1'), pendingOrder({ userId: 'guest', items: manyItems })));
        });

        it('blocks a non-numeric or non-positive totalPrice', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertFails(setDoc(doc(guest, 'orders/order1'), pendingOrder({ userId: 'guest', totalPrice: '100' })));
            await assertFails(setDoc(doc(guest, 'orders/order2'), pendingOrder({ userId: 'guest', totalPrice: 0 })));
            await assertFails(setDoc(doc(guest, 'orders/order3'), pendingOrder({ userId: 'guest', totalPrice: -50 })));
        });

        it('blocks an absurdly large totalPrice', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertFails(setDoc(doc(guest, 'orders/order1'), pendingOrder({ userId: 'guest', totalPrice: 999999999 })));
        });

        it('blocks a totalPrice just over the ceiling', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertFails(setDoc(doc(guest, 'orders/order1'), pendingOrder({ userId: 'guest', totalPrice: 250001 })));
        });

        it('blocks an oversized customerName or userEmail', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertFails(setDoc(doc(guest, 'orders/order1'), pendingOrder({ userId: 'guest', customerName: 'x'.repeat(201) })));
            await assertFails(setDoc(doc(guest, 'orders/order2'), pendingOrder({ userId: 'guest', userEmail: 'x'.repeat(201) })));
        });

        it('still allows a well-formed order at the boundary values', async () => {
            const guest = testEnv.unauthenticatedContext().firestore();
            await assertSucceeds(setDoc(doc(guest, 'orders/order1'), pendingOrder({
                userId: 'guest',
                totalPrice: 250000,
                customerName: 'x'.repeat(200),
                userEmail: 'x'.repeat(200),
                items: Array.from({ length: 50 }, () => ({ selectedFrame: { id: 'frame-canvas' } })),
            })));
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
            const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
            await assertSucceeds(getDoc(doc(admin, 'orders/alice-order')));
            await assertSucceeds(getDoc(doc(admin, 'orders/bob-order')));
        });

        it('lets the second admin address read any order too', async () => {
            const admin = testEnv.authenticatedContext('admin-uid-2', { email: SECOND_ADMIN_EMAIL, email_verified: true }).firestore();
            await assertSucceeds(getDoc(doc(admin, 'orders/alice-order')));
        });

        // Regression guard: without checking email_verified, self-registering
        // an email/password account under admin@/info@frameworthyco.com
        // (nothing stops that signup — the app never calls
        // sendEmailVerification) would produce a token whose email claim
        // matches the allowlist despite the mailbox never being proven.
        it('blocks an unverified account whose email matches the admin allowlist (self-registration escalation)', async () => {
            const impostor = testEnv.authenticatedContext('impostor-uid', { email: ADMIN_EMAIL, email_verified: false }).firestore();
            await assertFails(getDoc(doc(impostor, 'orders/alice-order')));
        });

        it('blocks an admin-matching account with no email_verified claim at all', async () => {
            const impostor = testEnv.authenticatedContext('impostor-uid', { email: ADMIN_EMAIL }).firestore();
            await assertFails(getDoc(doc(impostor, 'orders/alice-order')));
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
            const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
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
            const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
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
        const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
        await assertSucceeds(getDoc(doc(admin, 'clientErrors/err1')));
    });

    it('never allows updates or deletes, even from the admin', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'clientErrors/err1'), validError());
        });
        const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
        await assertFails(updateDoc(doc(admin, 'clientErrors/err1'), { message: 'edited' }));
        await assertFails(deleteDoc(doc(admin, 'clientErrors/err1')));
    });
});

describe('chats/{uid}/messages collection', () => {
    const customerMessage = (overrides = {}) => ({
        text: 'Do you deliver to Kumasi?',
        senderRole: 'customer',
        senderId: 'alice',
        ...overrides,
    });

    it('lets the thread owner create their own customer message', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await assertSucceeds(setDoc(doc(alice, 'chats/alice/messages/m1'), customerMessage()));
    });

    it('lets the thread owner create the AI assistant reply (written client-side by chat.js)', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await assertSucceeds(setDoc(doc(alice, 'chats/alice/messages/m1'), {
            text: 'We deliver to all 16 regions!',
            senderRole: 'assistant',
            senderId: 'ai-assistant',
        }));
    });

    it('blocks a customer from forging an admin message in their own thread (the actual attack this guards against)', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await assertFails(setDoc(doc(alice, 'chats/alice/messages/m1'), {
            text: 'We approved your full refund, no need to contact support.',
            senderRole: 'admin',
            senderId: 'admin',
        }));
    });

    it('blocks a customer message where senderId does not match their own uid', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await assertFails(setDoc(doc(alice, 'chats/alice/messages/m1'), customerMessage({ senderId: 'someone-else' })));
    });

    it('blocks a customer from writing into a different customer\'s thread', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await assertFails(setDoc(doc(alice, 'chats/bob/messages/m1'), customerMessage()));
    });

    it('rejects a message text over 4000 characters', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await assertFails(setDoc(doc(alice, 'chats/alice/messages/m1'), customerMessage({ text: 'x'.repeat(4001) })));
    });

    it('lets the admin create a real admin reply', async () => {
        const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
        await assertSucceeds(setDoc(doc(admin, 'chats/alice/messages/m1'), {
            text: 'Happy to help with that!',
            senderRole: 'admin',
            senderId: 'admin',
        }));
    });

    it('blocks the admin from writing a message that claims a customer/assistant role', async () => {
        const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
        await assertFails(setDoc(doc(admin, 'chats/alice/messages/m1'), customerMessage({ senderId: 'alice' })));
    });

    it('blocks an unauthenticated write', async () => {
        const guest = testEnv.unauthenticatedContext().firestore();
        await assertFails(setDoc(doc(guest, 'chats/alice/messages/m1'), customerMessage()));
    });
});

describe('default-deny collections', () => {
    it('blocks any client read/write to paystackReferences (Admin-SDK-only)', async () => {
        const admin = testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
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
