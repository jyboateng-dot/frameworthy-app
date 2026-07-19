const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Stored in Secret Manager via `firebase functions:secrets:set PAYSTACK_SECRET_KEY`
// — never committed to source, never sent to the client.
const paystackSecretKey = defineSecret('PAYSTACK_SECRET_KEY');

// Verifies a Paystack transaction server-side (the only place the secret key
// may be used) before marking an order as paid. The client-side payment
// callback alone can't be trusted — anyone could fake a "success" event
// without actually paying, so this function is the real source of truth.
exports.verifyPaystackPayment = onCall({ secrets: [paystackSecretKey], region: 'us-central1', timeoutSeconds: 30, maxInstances: 10 }, async (request) => {
    const { reference, orderId } = request.data || {};
    if (!reference || !orderId) {
        throw new HttpsError('invalid-argument', 'reference and orderId are required');
    }

    const db = admin.firestore();
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        throw new HttpsError('not-found', 'Order not found');
    }
    const order = orderSnap.data();

    // Already verified — idempotent, don't re-charge-check or re-write.
    if (order.paymentStatus === 'paid') {
        return { success: true, alreadyVerified: true };
    }

    let verifyResponse;
    try {
        verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${paystackSecretKey.value()}` },
            signal: AbortSignal.timeout(10_000)
        });
    } catch (err) {
        logger.error('Paystack verify request failed', err);
        throw new HttpsError('unavailable', 'Could not reach Paystack to verify payment');
    }

    let result;
    try {
        result = await verifyResponse.json();
    } catch (err) {
        logger.error('Paystack verify response was not valid JSON', err);
        throw new HttpsError('unavailable', 'Could not parse Paystack verification response');
    }

    if (!verifyResponse.ok || !result.status || result.data?.status !== 'success') {
        logger.warn('Paystack verification did not succeed', { orderId, reference, result });
        throw new HttpsError('failed-precondition', 'Payment could not be verified as successful');
    }

    // Guard against a tampered/mismatched amount — Paystack amounts are in
    // the lowest currency unit (pesewas for GHS), order.totalPrice is major units.
    const expectedAmount = Math.round(Number(order.totalPrice) * 100);
    if (result.data.amount !== expectedAmount || result.data.currency !== order.currency) {
        logger.error('Amount/currency mismatch on verified payment', {
            orderId, reference, expectedAmount, got: result.data.amount, currency: result.data.currency
        });
        throw new HttpsError('failed-precondition', 'Verified amount does not match order total');
    }

    // Paystack references stay verifiable indefinitely (re-querying an
    // already-successful transaction just returns success again) — without
    // claiming the reference here, a client could create N additional
    // 'pending' orders with the same totalPrice/currency as one real payment
    // and call this function once per order with the SAME reference, paying
    // for one order but marking all of them 'paid'. A Firestore transaction
    // that atomically claims the reference for exactly one order closes
    // that gap: only the first order to successfully claim a given
    // reference can ever be marked paid from it.
    const referenceRef = db.collection('paystackReferences').doc(reference);
    await db.runTransaction(async (tx) => {
        const [referenceSnap, freshOrderSnap] = await Promise.all([tx.get(referenceRef), tx.get(orderRef)]);

        const freshOrder = freshOrderSnap.data();
        if (freshOrder.paymentStatus === 'paid') {
            // Already verified by a concurrent/earlier call for this same order.
            return;
        }

        if (referenceSnap.exists && referenceSnap.data().orderId !== orderId) {
            logger.error('Paystack reference reuse attempt', {
                orderId, reference, claimedBy: referenceSnap.data().orderId
            });
            throw new HttpsError('already-exists', 'This payment reference has already been used for a different order');
        }

        tx.set(referenceRef, {
            orderId,
            claimedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        tx.update(orderRef, {
            paymentStatus: 'paid',
            paystackReference: reference,
            paystackVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    return { success: true, alreadyVerified: false };
});

// Stored in Secret Manager via `firebase functions:secrets:set EMAILJS_PRIVATE_KEY`.
// EmailJS's REST API requires this (in addition to the public key, which is
// safe client-side) to accept sends from a server context with no browser
// Origin header.
const emailjsPrivateKey = defineSecret('EMAILJS_PRIVATE_KEY');

// These match the values already used client-side in CheckoutPage.jsx — the
// service and public key are not secrets by EmailJS's own design.
const EMAILJS_SERVICE_ID = 'service_aefbwot';
const EMAILJS_RESET_TEMPLATE_ID = 'template_wn39cmf';
const EMAILJS_PUBLIC_KEY = 'O8XgNWf6VmV-veLaX';

// Generates a Firebase password-reset link server-side and emails it via
// EmailJS (through the project's own connected Gmail account) instead of
// letting Firebase Auth send it directly. Firebase's built-in auth emails
// come from a shared noreply@<project-id>.firebaseapp.com address with no
// domain reputation, which routinely lands in spam — routing through the
// same EmailJS/Gmail pipeline already used for order confirmations fixes
// that, since it's a real, already-warmed-up sending identity.
exports.sendPasswordResetLink = onCall({ secrets: [emailjsPrivateKey], region: 'us-central1', timeoutSeconds: 30, maxInstances: 5 }, async (request) => {
    const { email } = request.data || {};
    if (!email || typeof email !== 'string') {
        throw new HttpsError('invalid-argument', 'email is required');
    }

    // Abuse guard: without this, anyone can script this endpoint to email-bomb
    // a victim's inbox — every call sends a real message through our connected
    // Gmail/EmailJS identity, which floods the target AND torches that
    // identity's sending reputation (spam complaints -> future order emails
    // land in spam). Throttle to one reset email per address per 60s using a
    // short-lived Firestore marker keyed by the lowercased email. We always
    // return { success: true } regardless (see below), so a throttled caller
    // learns nothing about whether the address exists — the no-enumeration
    // guarantee is preserved.
    const normalizedEmail = email.trim().toLowerCase();
    const db = admin.firestore();
    const throttleRef = db.collection('passwordResetThrottle').doc(encodeURIComponent(normalizedEmail));
    const COOLDOWN_MS = 60_000;
    try {
        const allowed = await db.runTransaction(async (tx) => {
            const snap = await tx.get(throttleRef);
            const now = Date.now();
            if (snap.exists) {
                const last = snap.data().lastSentMs || 0;
                if (now - last < COOLDOWN_MS) {
                    return false;
                }
            }
            tx.set(throttleRef, { lastSentMs: now });
            return true;
        });
        if (!allowed) {
            logger.info('Password reset throttled', { email: normalizedEmail });
            return { success: true };
        }
    } catch (err) {
        // Fail closed on throttle-store errors so this can't be bypassed by
        // forcing the transaction to error — but still don't leak anything.
        logger.error('Password reset throttle check failed', err);
        return { success: true };
    }

    let resetLink;
    try {
        resetLink = await admin.auth().generatePasswordResetLink(email);
    } catch (err) {
        // Don't leak whether the email exists — respond success either way,
        // mirroring Firebase's own client SDK behavior for this method.
        logger.warn('generatePasswordResetLink failed', { email, code: err.code });
        return { success: true };
    }

    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_RESET_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            accessToken: emailjsPrivateKey.value(),
            template_params: { to_email: email, reset_link: resetLink }
        }),
        signal: AbortSignal.timeout(10_000)
    }).catch((err) => {
        logger.error('EmailJS request failed', err);
        throw new HttpsError('unavailable', 'Could not reach email service');
    });

    if (!emailResponse.ok) {
        const body = await emailResponse.text().catch(() => '<unreadable body>');
        logger.error('EmailJS send failed', { status: emailResponse.status, body });
        throw new HttpsError('internal', 'Could not send reset email');
    }

    return { success: true };
});

// One-time-use PINs gating access to the private tester build. Docs live in
// `testerPins/{pin}` and are only ever touched here via the Admin SDK —
// Firestore's default-deny covers the collection for every client, so the
// actual PIN values and who-redeemed-what can't be read or tampered with
// from the browser. The initial batch of 5 was generated with a one-off
// seedTesterPins function that has since been removed — see git history
// if more PINs ever need generating the same way.

// Standing PIN that never gets consumed — unlike the generated one-time
// codes below, it isn't backed by a testerPins doc, so there's nothing for
// a transaction to mark "used" and it keeps working indefinitely.
const MASTER_PIN = 'JYB187';

// Validates a tester's one-time PIN and records who redeemed it. A Firestore
// transaction makes the used-check-and-claim atomic, so two people racing to
// redeem the same PIN can't both succeed.
exports.redeemTesterPin = onCall({ region: 'us-central1', timeoutSeconds: 30, maxInstances: 5 }, async (request) => {
    const { pin, name } = request.data || {};
    if (!pin || typeof pin !== 'string' || !name || typeof name !== 'string' || !name.trim()) {
        throw new HttpsError('invalid-argument', 'name and pin are required');
    }

    const trimmedName = name.trim().slice(0, 80);
    const normalizedPin = pin.trim().toUpperCase();

    if (normalizedPin === MASTER_PIN) {
        logger.info('Master tester PIN redeemed', { name: trimmedName });
        return { success: true };
    }

    const db = admin.firestore();
    const pinRef = db.collection('testerPins').doc(normalizedPin);

    return db.runTransaction(async (tx) => {
        const snap = await tx.get(pinRef);
        if (!snap.exists) {
            return { success: false, reason: 'invalid' };
        }
        if (snap.data().used) {
            return { success: false, reason: 'used' };
        }
        tx.update(pinRef, {
            used: true,
            usedByName: trimmedName,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    });
});
