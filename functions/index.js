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
exports.verifyPaystackPayment = onCall({ secrets: [paystackSecretKey], region: 'us-central1', timeoutSeconds: 30 }, async (request) => {
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
exports.sendPasswordResetLink = onCall({ secrets: [emailjsPrivateKey], region: 'us-central1', timeoutSeconds: 30 }, async (request) => {
    const { email } = request.data || {};
    if (!email || typeof email !== 'string') {
        throw new HttpsError('invalid-argument', 'email is required');
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
