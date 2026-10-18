const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { recomputeOrderTotal } = require('./pricing');
const { FRAMEWORTHY_KNOWLEDGE_BASE } = require('./supportKnowledge');
const prodigi = require('./prodigi');

admin.initializeApp();

exports.museumArtworks = onRequest({
    region: 'us-central1', memory: '256MiB', timeoutSeconds: 180, invoker: 'public',
    secrets: ['PARIS_MUSEES_API_TOKEN'],
}, async (req, res) => {
    if (req.method !== 'GET') { res.status(405).send('Method not allowed'); return; }
    try {
        const { museumFeed } = require('./museumFeeds');
        const data = await museumFeed(req.query.source, Number(req.query.page || 1));
        res.set('Cache-Control', 'public, max-age=300').json(data);
    } catch (error) {
        res.status(error.status || 502).json({ error: error.message });
    }
});

// Credential-free archival feeds deploy separately from optional museum feeds.
exports.archivalArtworks = onRequest({
    region: 'us-central1', memory: '256MiB', timeoutSeconds: 120, invoker: 'public',
}, async (req, res) => {
    if (req.method !== 'GET') { res.status(405).send('Method not allowed'); return; }
    try {
        const { archivalFeed } = require('./museumFeeds');
        const data = await archivalFeed(req.query.source, Number(req.query.page || 1));
        res.set('Cache-Control', 'public, max-age=300').json(data);
    } catch (error) {
        res.status(error.status || 502).json({ error: error.message });
    }
});

// Stored in Secret Manager via `firebase functions:secrets:set PAYSTACK_SECRET_KEY`
// — never committed to source, never sent to the client.
const paystackSecretKey = defineSecret('PAYSTACK_SECRET_KEY');
const prodigiApiKey = defineSecret('PRODIGI_API_KEY');
const prodigiCallbackToken = defineSecret('PRODIGI_CALLBACK_TOKEN');

const prodigiEnvironment = () => process.env.PRODIGI_ENVIRONMENT === 'live' ? 'live' : 'sandbox';

exports.getProdigiQuote = onCall({
    secrets: [prodigiApiKey], region: 'us-central1', timeoutSeconds: 30, maxInstances: 10,
}, async (request) => {
    try {
        const input = prodigi.buildQuotePayload(request.data);
        const baseInput = prodigi.buildBaseQuotePayload(request.data, input);
        const quoteArgs = { apiKey: prodigiApiKey.value(), environment: prodigiEnvironment() };
        const selectedQuotePromise = prodigi.createQuote({ ...quoteArgs, input });
        const sameAsBase = JSON.stringify(input.items) === JSON.stringify(baseInput.items);
        const [result, baseResult] = await Promise.all([
            selectedQuotePromise,
            sameAsBase ? selectedQuotePromise : prodigi.createQuote({ ...quoteArgs, input: baseInput }),
        ]);
        const summaries = prodigi.summariseQuotes(result);
        const rawQuotes = Array.isArray(result.quotes) ? result.quotes : [];
        const rawBaseQuotes = Array.isArray(baseResult.quotes) ? baseResult.quotes : [];
        const exchangeRates = {
            GBP: Number(process.env.PRODIGI_GHS_PER_GBP),
            EUR: Number(process.env.PRODIGI_GHS_PER_EUR),
            USD: Number(process.env.PRODIGI_GHS_PER_USD),
        };
        return {
            environment: prodigiEnvironment(),
            outcome: result.outcome,
            quotes: summaries.map((summary, index) => {
                const rawQuote = rawQuotes[index];
                const baseQuote = rawBaseQuotes.find((candidate) => candidate.shipmentMethod === rawQuote?.shipmentMethod) || rawBaseQuotes[0];
                const retail = prodigi.createRetailQuote({
                    quote: rawQuote, baseQuote, input, signingKey: prodigiApiKey.value(), exchangeRates,
                });
                if (!retail) throw new Error('Could not calculate the customer price');
                return { ...summary, items: retail.items, total: retail.total, retail };
            }),
        };
    } catch (error) {
        logger.warn('Prodigi quote failed', { message: error.message, status: error.status });
        const code = error.status === 401 ? 'failed-precondition'
            : error.status === 400 || !error.status ? 'invalid-argument'
            : 'unavailable';
        throw new HttpsError(code, error.message || 'Could not retrieve a Prodigi quote');
    }
});

// Shared by verifyPaystackPayment (client-triggered) and paystackWebhook
// (Paystack-triggered) — both end up with the same three facts (orderId,
// reference, verified amount+currency) from different sources, and both need
// the identical pricing/idempotency guarantees applied to them.
//
// Returns { ok: true, alreadyVerified } on success, or { ok: false, reason }
// on a handled failure (never throws for expected conditions — callers
// decide how to surface `reason` in their own protocol, since one caller is
// an onCall and the other is a raw webhook).
async function finalizeOrderPayment({ orderId, reference, amount, currency }) {
    const db = admin.firestore();
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        return { ok: false, reason: 'order-not-found' };
    }
    const order = orderSnap.data();

    // Already verified — idempotent, don't re-charge-check or re-write.
    // This is what makes it safe for both the webhook and the client's own
    // verify call to race each other: whichever lands first wins, the other
    // is a no-op.
    if (order.paymentStatus === 'paid') {
        return { ok: true, alreadyVerified: true };
    }

    // Recompute what this order should cost from its configuration alone.
    // order.totalPrice is written by the client, so comparing the amount paid
    // against it would only prove "they paid what they said they'd pay" —
    // a tampered client could claim totalPrice: 1 and pay GHS 1 for a GHS 321
    // frame. The price table in pricing-data.json is the server's own copy.
    const recomputed = recomputeOrderTotal(order, {
        prodigiPriceForItem: (item) => {
            try {
                const quote = prodigi.verifyRetailQuoteToken(item?.prodigi?.quoteToken, prodigiApiKey.value());
                const quantity = Number(item?.quantity || 1);
                if (quote.sku !== item.prodigi.sku || quote.copies !== quantity) return null;
                return quote.retailTotalGhs / quantity;
            } catch (error) {
                logger.warn('Invalid Prodigi retail quote on order', { orderId, message: error.message });
                return null;
            }
        },
    });
    if (recomputed.error) {
        logger.error('Could not recompute order total', { orderId, reference, reason: recomputed.error });
        return { ok: false, reason: 'pricing-error' };
    }

    // Guard against a tampered/mismatched amount — Paystack amounts are in
    // the lowest currency unit (pesewas for GHS), recomputed total is major units.
    const expectedAmount = Math.round(recomputed.total * 100);
    if (amount !== expectedAmount || currency !== order.currency) {
        logger.error('Amount/currency mismatch on verified payment', {
            orderId, reference, expectedAmount, got: amount,
            currency, clientClaimedTotal: order.totalPrice
        });
        return { ok: false, reason: 'amount-mismatch' };
    }

    // Surfaces client/server price disagreement even when the customer paid
    // the correct (server) amount — a mismatch here means either a stale
    // pricing-data.json or a client-side tampering attempt worth knowing about.
    if (Math.round(Number(order.totalPrice) * 100) !== expectedAmount) {
        logger.warn('Client-stated order total disagreed with server recomputation', {
            orderId, reference, clientClaimedTotal: order.totalPrice, serverTotal: recomputed.total
        });
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
    try {
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
                throw Object.assign(new Error('reference-reused'), { code: 'reference-reused' });
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
    } catch (err) {
        if (err.code === 'reference-reused') {
            return { ok: false, reason: 'reference-reused' };
        }
        throw err;
    }

    return { ok: true, alreadyVerified: false };
}

// Verifies a Paystack transaction server-side (the only place the secret key
// may be used) before marking an order as paid. The client-side payment
// callback alone can't be trusted — anyone could fake a "success" event
// without actually paying, so this function is one of two independent
// sources of truth (see paystackWebhook below for the other — this call can
// fail to reach the client at all if the tab closes/network drops right
// after Paystack actually charges the customer, which is exactly what the
// webhook exists to catch).
exports.verifyPaystackPayment = onCall({ secrets: [paystackSecretKey, prodigiApiKey], region: 'us-central1', timeoutSeconds: 30, maxInstances: 10 }, async (request) => {
    const { reference, orderId } = request.data || {};
    if (!reference || !orderId) {
        throw new HttpsError('invalid-argument', 'reference and orderId are required');
    }

    // Short-circuit before ever calling Paystack: the webhook may well have
    // already finalized this order (that's the point of having both), and
    // there's no reason to spend an external API call re-verifying — or to
    // fail confusingly if this call's reference happens to be stale/reused
    // while a *different* reference already paid for the order via the
    // webhook.
    const orderSnap = await admin.firestore().collection('orders').doc(orderId).get();
    if (!orderSnap.exists) {
        throw new HttpsError('not-found', 'Order not found');
    }
    if (orderSnap.data().paymentStatus === 'paid') {
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

    const outcome = await finalizeOrderPayment({
        orderId, reference, amount: result.data.amount, currency: result.data.currency
    });

    if (!outcome.ok) {
        const message = outcome.reason === 'order-not-found' ? 'Order not found'
            : outcome.reason === 'reference-reused' ? 'This payment reference has already been used for a different order'
            : outcome.reason === 'amount-mismatch' ? 'Verified amount does not match order total'
            : 'Order could not be priced for verification';
        const code = outcome.reason === 'order-not-found' ? 'not-found'
            : outcome.reason === 'reference-reused' ? 'already-exists'
            : 'failed-precondition';
        throw new HttpsError(code, message);
    }

    return { success: true, alreadyVerified: outcome.alreadyVerified };
});

// Independent, server-initiated confirmation of the same payment
// verifyPaystackPayment does client-initiated — Paystack calls this directly
// the moment a charge succeeds, regardless of whether the customer's browser
// is still around to hear about it. This is what closes the gap where a
// completed charge could otherwise leave an order stuck 'pending' forever
// (tab closed / crashed / network dropped between Paystack succeeding and
// the client's verify call completing).
//
// Configure this in the Paystack dashboard: Settings -> API Keys & Webhooks
// -> Webhook URL. Paystack signs every request with the secret key via the
// x-paystack-signature header (HMAC SHA512 over the raw body) — requests
// that don't match are rejected before any Firestore access.
exports.paystackWebhook = onRequest({ secrets: [paystackSecretKey, prodigiApiKey], region: 'us-central1', timeoutSeconds: 30, maxInstances: 10 }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    const signature = req.get('x-paystack-signature');
    const expectedSignature = crypto
        .createHmac('sha512', paystackSecretKey.value())
        .update(req.rawBody)
        .digest('hex');
    if (!signature || signature !== expectedSignature) {
        logger.warn('paystackWebhook: signature mismatch, rejecting');
        res.status(401).send('Invalid signature');
        return;
    }

    const event = req.body;
    // Paystack sends many event types (transfer, subscription, etc.) — this
    // app only cares about a successful charge. Everything else is
    // acknowledged with 200 so Paystack doesn't retry it forever.
    if (event?.event !== 'charge.success') {
        res.status(200).send('ignored');
        return;
    }

    const data = event.data || {};
    const orderId = data.metadata?.orderId;
    const reference = data.reference;
    if (!orderId || !reference) {
        logger.error('paystackWebhook: charge.success missing orderId/reference in metadata', { reference });
        // Acknowledge anyway — this isn't a delivery failure Paystack should
        // retry, the payload just doesn't map to an order we know about.
        res.status(200).send('missing metadata');
        return;
    }

    try {
        const outcome = await finalizeOrderPayment({ orderId, reference, amount: data.amount, currency: data.currency });
        if (!outcome.ok) {
            logger.error('paystackWebhook: could not finalize order', { orderId, reference, reason: outcome.reason });
        } else {
            logger.info('paystackWebhook: order finalized', { orderId, reference, alreadyVerified: outcome.alreadyVerified });
        }
        // 200 either way — a "reason" failure (bad price data, reused
        // reference, etc.) won't resolve itself on a Paystack retry, so
        // there's no point asking it to try again.
        res.status(200).send('ok');
    } catch (err) {
        logger.error('paystackWebhook: unexpected error', { orderId, reference, message: err.message });
        // A genuine transient error (Firestore hiccup) IS worth a retry.
        res.status(500).send('internal error');
    }
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
const EMAILJS_STUDIO_TEMPLATE_ID = 'template_hbx1njo';
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

// Sends the "new chat message" / "human requested" admin notification email.
// Previously the client called emailjs.send() directly, throttled by an
// in-memory Map keyed by uid — reset on every page reload, independent per
// browser tab, so a refresh (or a second tab) bypassed the "1 email per 2
// minutes" limit entirely. It also meant a determined caller could skip the
// throttle altogether by calling emailjs.send() directly with the public
// key/service/template ids, which ship in the client bundle by EmailJS's own
// design. Moving the send itself here (using the private key, only usable
// server-side) closes both: the throttle now lives in Firestore, and the
// public keys alone can no longer trigger a send at all.
exports.notifyAdminOfChatMessage = onCall({ secrets: [emailjsPrivateKey], region: 'us-central1', timeoutSeconds: 30, maxInstances: 5 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sign in to use chat support');
    }

    const { text, isHandoff } = request.data || {};
    if (!text || typeof text !== 'string') {
        throw new HttpsError('invalid-argument', 'text is required');
    }

    const uid = request.auth.uid;
    const throttleRef = admin.firestore().collection('chatEmailThrottle').doc(uid);
    const COOLDOWN_MS = 120_000;
    try {
        const allowed = await admin.firestore().runTransaction(async (tx) => {
            // An explicit human-handoff request always gets through
            // immediately — mirrors the client's original behavior, since
            // that's the one case worth interrupting the cooldown for.
            if (isHandoff === true) return true;
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
            return { sent: false };
        }
    } catch (err) {
        logger.error('notifyAdminOfChatMessage throttle check failed', err);
        return { sent: false };
    }

    // Trusting the authenticated caller's own token for name/email rather
    // than client-supplied userMeta — the old client code took
    // userMeta.displayName/email as given, which a caller could set to
    // anything when calling the (formerly client-side) send directly.
    const userName = request.auth.token.name || 'Customer';
    const userEmail = request.auth.token.email || 'Anonymous/Guest Customer';
    const chatLink = `https://frameworthyco-9c78c.web.app/admin/messages?chat=${uid}`;

    try {
        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: EMAILJS_SERVICE_ID,
                template_id: EMAILJS_STUDIO_TEMPLATE_ID,
                user_id: EMAILJS_PUBLIC_KEY,
                accessToken: emailjsPrivateKey.value(),
                template_params: {
                    to_email: 'admin@frameworthyco.com',
                    to_name: 'FrameWorthy Admin',
                    user_name: userName,
                    user_email: userEmail,
                    subject: isHandoff ? `URGENT: Human Assistance Requested by ${userName}` : `New Customer Message from ${userName}`,
                    message: `Customer Message: "${text.slice(0, 2000)}"\n\nDirect Chat Link: ${chatLink}`,
                },
            }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!emailResponse.ok) {
            const body = await emailResponse.text().catch(() => '<unreadable body>');
            logger.error('notifyAdminOfChatMessage: EmailJS send failed', { status: emailResponse.status, body });
            return { sent: false };
        }
    } catch (err) {
        logger.error('notifyAdminOfChatMessage: EmailJS request failed', err);
        return { sent: false };
    }

    return { sent: true };
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
// a transaction to mark "used" and it keeps working indefinitely. Kept in
// Secret Manager rather than hardcoded so it isn't sitting in plaintext in
// version-controlled source (set via
// `firebase functions:secrets:set MASTER_TESTER_PIN`).
const masterTesterPin = defineSecret('MASTER_TESTER_PIN');

// Validates a tester's one-time PIN and records who redeemed it. A Firestore
// transaction makes the used-check-and-claim atomic, so two people racing to
// redeem the same PIN can't both succeed.
exports.redeemTesterPin = onCall({ secrets: [masterTesterPin], region: 'us-central1', timeoutSeconds: 30, maxInstances: 5 }, async (request) => {
    const { pin, name } = request.data || {};
    if (!pin || typeof pin !== 'string' || !name || typeof name !== 'string' || !name.trim()) {
        throw new HttpsError('invalid-argument', 'name and pin are required');
    }

    const trimmedName = name.trim().slice(0, 80);
    const normalizedPin = pin.trim().toUpperCase();
    const db = admin.firestore();

    // Checked before the throttle below, not after: the master pin is
    // deliberately reusable/unlimited (unlike the one-time codes), so a
    // legitimate repeated redemption should never get rate-limited. It's
    // also not what a brute-force script is actually targeting — guessing
    // this exact string by chance is astronomically unlikely — so nothing
    // is lost by exempting this path from the throttle.
    //
    // .trim() on the secret's own value, not just the user's input: secrets
    // set via `echo "X" | firebase functions:secrets:set` pick up a trailing
    // newline from echo, which Secret Manager stores verbatim — an untrimmed
    // comparison then never matches even the correct PIN.
    if (normalizedPin === masterTesterPin.value().trim()) {
        logger.info('Master tester PIN redeemed', { name: trimmedName });
        return { success: true };
    }

    // Abuse guard: this callable is unauthenticated (it's the onboarding
    // step before signup), so there's no uid to throttle by like
    // askSupportAgent does. A single shared cooldown across all callers is
    // the available mitigation without App Check/IP infra — it caps a
    // brute-force PIN-enumeration script to a few guesses per second
    // instead of unlimited, at the cost of a small delay if two real
    // testers happen to redeem a one-time code within the same window
    // (rare in practice). Only applies past this point, i.e. to one-time
    // code lookups — see the master-pin check above for why that path is
    // exempt.
    const globalThrottleRef = db.collection('testerPinThrottle').doc('global');
    const GLOBAL_COOLDOWN_MS = 1_500;
    try {
        const allowed = await db.runTransaction(async (tx) => {
            const snap = await tx.get(globalThrottleRef);
            const now = Date.now();
            if (snap.exists) {
                const last = snap.data().lastCallMs || 0;
                if (now - last < GLOBAL_COOLDOWN_MS) {
                    return false;
                }
            }
            tx.set(globalThrottleRef, { lastCallMs: now });
            return true;
        });
        if (!allowed) {
            throw new HttpsError('resource-exhausted', 'Please wait a moment and try again');
        }
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        // Fail closed on throttle-store errors so this can't be bypassed by
        // forcing the transaction to error.
        logger.error('redeemTesterPin throttle check failed', err);
        throw new HttpsError('unavailable', 'Please try again in a moment');
    }

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

// Guest order lookup. Guest checkout writes orders under userId 'guest' with
// no auth context, so firestore.rules can never let a guest read their order
// back directly — there's no identity to match against. This callable is the
// deliberate, narrow exception: it releases a single order's status to
// whoever can present BOTH its Firestore document id AND the email it was
// placed under.
//
// Why that pair is an acceptable bar: the document id is a 20-char Firestore
// auto-id that only ever appears on the post-payment success screen and in
// the confirmation email — it's unguessable and unenumerable, and the email
// requirement means a leaked/mistyped id alone still isn't enough. Wrong id
// and wrong email return the same 'not-found' so the endpoint can't be used
// to probe which order ids exist.
//
// Deliberately NOT returned: shipping address, phone, or line-item detail —
// status queries don't need them, so a correct-pair lookup by someone who
// shouldn't have the pair (e.g. a forwarded email) leaks as little as
// possible.
exports.lookupGuestOrder = onCall({ region: 'us-central1', timeoutSeconds: 30, maxInstances: 5 }, async (request) => {
    const { orderId, email } = request.data || {};
    if (!orderId || typeof orderId !== 'string' || !email || typeof email !== 'string') {
        throw new HttpsError('invalid-argument', 'orderId and email are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedOrderId = orderId.trim();
    // Firestore auto-ids are exactly 20 chars of [A-Za-z0-9] — reject anything
    // else before touching the database.
    if (!/^[A-Za-z0-9]{20}$/.test(trimmedOrderId) || !normalizedEmail.includes('@')) {
        throw new HttpsError('not-found', 'No matching order found');
    }

    const db = admin.firestore();

    // Abuse guard: the id+email pair is only a safe access control if
    // checking it is slow to brute-force. Without this, someone who
    // legitimately obtained ONE valid order id (a shared screenshot, a
    // forwarded email) could script unlimited email guesses against that
    // fixed id until one stops returning 'not-found'. Throttled here per
    // orderId — legitimate lookups of different orders are unaffected —
    // and, critically, throttled attempts get the exact same 'not-found'
    // error as every other failure path, so a throttled caller still learns
    // nothing about whether the id exists.
    const throttleRef = db.collection('guestOrderLookupThrottle').doc(trimmedOrderId);
    const COOLDOWN_MS = 3_000;
    try {
        const allowed = await db.runTransaction(async (tx) => {
            const snap = await tx.get(throttleRef);
            const now = Date.now();
            if (snap.exists) {
                const last = snap.data().lastCallMs || 0;
                if (now - last < COOLDOWN_MS) {
                    return false;
                }
            }
            tx.set(throttleRef, { lastCallMs: now });
            return true;
        });
        if (!allowed) {
            throw new HttpsError('not-found', 'No matching order found');
        }
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        // Fail closed (deny) on throttle-store errors, same generic error.
        logger.error('lookupGuestOrder throttle check failed', err);
        throw new HttpsError('not-found', 'No matching order found');
    }

    const snap = await db.collection('orders').doc(trimmedOrderId).get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'No matching order found');
    }

    const order = snap.data();
    if ((order.userEmail || '').trim().toLowerCase() !== normalizedEmail) {
        // Same error as a missing doc — the caller learns nothing about
        // whether this id exists.
        throw new HttpsError('not-found', 'No matching order found');
    }

    return {
        orderId: snap.id,
        paymentStatus: order.paymentStatus || 'pending',
        status: order.status || 'pending',
        totalPrice: order.totalPrice ?? null,
        currency: order.currency || 'GHS',
        createdAt: order.createdAt ? order.createdAt.toMillis() : null,
        itemCount: Array.isArray(order.items)
            ? order.items.reduce((n, item) => n + (Number(item.quantity) || 1), 0)
            : null,
    };
});

// ---------------------------------------------------------------------------
// askSupportAgent — server-side proxy for the Help Centre AI chat.
//
// The client used to call Gemini directly with a VITE_-baked API key, which
// put the key in the public JS bundle. This callable keeps the key in Secret
// Manager and the knowledge-base prompt server-side. Chat requires a
// signed-in user (threads live at chats/{uid}), so auth is required here too —
// it also stops anonymous quota burn on the Gemini key.
//
// On any upstream failure this throws `unavailable`; the client falls back to
// its local keyword engine, same as before.
// Stored in Secret Manager via `firebase functions:secrets:set GEMINI_API_KEY`
const geminiApiKey = defineSecret('GEMINI_API_KEY');

const GEMINI_MODEL = 'gemini-3.5-flash';

exports.askSupportAgent = onCall({ secrets: [geminiApiKey], region: 'us-central1', timeoutSeconds: 30, maxInstances: 5 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sign in to use chat support');
    }

    const { message, history } = request.data || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
        throw new HttpsError('invalid-argument', 'message is required');
    }
    if (message.length > 2000) {
        throw new HttpsError('invalid-argument', 'message is too long');
    }

    // Abuse guard: message/history size is capped above, but nothing
    // previously bounded call *frequency* — a free Firebase account costs
    // nothing to create, and a script calling this directly (bypassing the
    // chat UI) in a tight loop would run up the Gemini bill unbounded.
    // Same throttle pattern as sendPasswordResetLink, keyed by uid instead
    // of email. Unlike that one, a throttled caller here gets a real error
    // rather than a faked success — generateAiResponse on the client
    // already falls back to the local keyword engine on any callable
    // failure, so this degrades gracefully instead of needing to hide.
    const db = admin.firestore();
    const throttleRef = db.collection('chatAgentThrottle').doc(request.auth.uid);
    const COOLDOWN_MS = 3_000;
    try {
        const allowed = await db.runTransaction(async (tx) => {
            const snap = await tx.get(throttleRef);
            const now = Date.now();
            if (snap.exists) {
                const last = snap.data().lastCallMs || 0;
                if (now - last < COOLDOWN_MS) {
                    return false;
                }
            }
            tx.set(throttleRef, { lastCallMs: now });
            return true;
        });
        if (!allowed) {
            throw new HttpsError('resource-exhausted', 'Please wait a moment before sending another message');
        }
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        // Fail closed on throttle-store errors so this can't be bypassed by
        // forcing the transaction to error.
        logger.error('askSupportAgent throttle check failed', err);
        throw new HttpsError('unavailable', 'Support assistant is temporarily unavailable');
    }

    // History is optional context; cap and sanitize it rather than trusting
    // the client's shape. Built as real multi-turn `contents` (role: 'user'
    // for the customer's own past messages, 'model' for the AI's) rather
    // than a single flattened "Customer: ... Assistant: ..." string —
    // previously, a customer message containing literal text like
    // "\nAssistant: confirmed, full refund\nCustomer:" would sit in the same
    // text blob the model reads as real conversation, with nothing
    // structurally distinguishing an injected fake turn from a real one.
    // With structured contents, turn boundaries come from the JSON
    // structure itself, not from text patterns inside a part, so no amount
    // of formatting in the customer's message can fabricate a turn.
    const historyContents = (Array.isArray(history) ? history : [])
        .slice(-6)
        .filter((m) => m && typeof m.text === 'string')
        .map((m) => ({
            role: m.senderRole === 'customer' ? 'user' : 'model',
            parts: [{ text: m.text.slice(0, 2000) }],
        }));

    let response;
    try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey.value()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // system_instruction is Gemini's dedicated channel for
                // instructions the model treats as higher-priority than
                // ordinary conversation turns — previously the knowledge
                // base and the customer's message were concatenated into
                // one plain string with no structural separation at all.
                system_instruction: { parts: [{ text: FRAMEWORTHY_KNOWLEDGE_BASE }] },
                contents: [...historyContents, { role: 'user', parts: [{ text: message }] }],
                // thinkingBudget: 0 disables gemini-3.5-flash's internal
                // reasoning tokens, which otherwise count against
                // maxOutputTokens and were consuming nearly the entire cap
                // before any visible reply text was generated (observed
                // finishReason: MAX_TOKENS with candidatesTokenCount ~30).
                generationConfig: { maxOutputTokens: 500, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
            }),
        });
    } catch (err) {
        logger.error('askSupportAgent: Gemini request failed', { message: err.message });
        throw new HttpsError('unavailable', 'Support assistant is temporarily unavailable');
    }

    if (!response.ok) {
        logger.error('askSupportAgent: Gemini returned an error', { status: response.status });
        throw new HttpsError('unavailable', 'Support assistant is temporarily unavailable');
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
        logger.error('askSupportAgent: Gemini returned no text');
        throw new HttpsError('unavailable', 'Support assistant is temporarily unavailable');
    }

    return { text };
});

// Mints a short-lived ImageKit client-upload signature. Unlike Cloudinary's
// unsigned upload preset, ImageKit has no equivalent — every client upload
// must carry a token/expire/signature triple where the signature is
// HMAC-SHA1(token + expire) keyed on the *private* key, which can only ever
// be computed server-side. This callable is that computation; the private
// key itself never reaches the client.
// Stored in Secret Manager via `firebase functions:secrets:set IMAGEKIT_PRIVATE_KEY`
const imageKitPrivateKey = defineSecret('IMAGEKIT_PRIVATE_KEY');

exports.getImageKitUploadAuth = onCall({ secrets: [imageKitPrivateKey], region: 'us-central1', timeoutSeconds: 10, maxInstances: 20 }, async () => {
    const token = crypto.randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minute window
    const signature = crypto.createHmac('sha1', imageKitPrivateKey.value()).update(token + String(expire)).digest('hex');
    return { token, expire, signature };
});

// Re-serves an image from an allowlisted upstream host with CORS enabled.
//
// Why this exists: the AR pipeline (src/utils/ar/arTextures.js) draws
// artwork into a <canvas> to embed as a GLB/USDZ texture, which requires
// actually reading the pixel data — not just displaying the image, the way
// a plain <img> tag does. That read is blocked by the browser unless the
// image's own response carries CORS headers. Most of this app's image
// hosts (ImageKit, Apple's/Amazon's/the Met's CDNs) already send
// `Access-Control-Allow-Origin`, but bymuseum.com — the source for the
// Artists & Masterpieces catalogue — sends none at all, which silently
// left every masterpiece's AR preview showing an empty frame.
//
// A server-to-server fetch has no such restriction (CORS only governs
// browser-to-server requests), so this just re-fetches the bytes here and
// adds the header when handing them back. Restricted to an explicit host
// allowlist rather than accepting any URL — an open image proxy is a
// classic SSRF vector (a client could otherwise point it at internal
// infrastructure, or just burn bandwidth as an anonymizing relay).
const PROXY_ALLOWED_HOSTS = new Set([
    'bymuseum.com',
    'www.bymuseum.com',
    'openaccess-cdn.clevelandart.org',
    'parismuseescollections.paris.fr',
    'www.parismuseescollections.paris.fr',
]);

exports.proxyArtworkImage = onRequest({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 30, maxInstances: 10 }, async (req, res) => {
    const target = req.query.url;
    if (typeof target !== 'string' || !target) {
        res.status(400).send('Missing url parameter');
        return;
    }

    let parsed;
    try {
        parsed = new URL(target);
    } catch {
        res.status(400).send('Invalid url parameter');
        return;
    }

    if (parsed.protocol !== 'https:' || !PROXY_ALLOWED_HOSTS.has(parsed.hostname)) {
        res.status(403).send('Host not allowed');
        return;
    }

    let upstream;
    try {
        upstream = await fetch(parsed.toString(), { signal: AbortSignal.timeout(10_000) });
    } catch (err) {
        logger.error('proxyArtworkImage: upstream fetch failed', { url: parsed.toString(), message: err.message });
        res.status(502).send('Upstream fetch failed');
        return;
    }

    if (!upstream.ok) {
        res.status(upstream.status).send('Upstream returned an error');
        return;
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const bytes = Buffer.from(await upstream.arrayBuffer());

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);
    // Upstream art doesn't change once published — safe to cache hard and
    // skip re-fetching bymuseum.com on every AR open.
    res.set('Cache-Control', 'public, max-age=86400, immutable');
    res.status(200).send(bytes);
});

// The Art Institute's IIIF server requires a museum-style request header and
// rejects direct browser image requests. Keep this relay narrow: only accept
// image identifiers, only request the Art Institute host, and cap the width.
exports.proxyArtInstituteImage = onRequest({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 30, maxInstances: 10, invoker: 'public' }, async (req, res) => {
    const imageId = req.query.id;
    const requestedWidth = Number(req.query.width || 843);
    const width = Math.min(16000, Math.max(240, Number.isFinite(requestedWidth) ? requestedWidth : 843));
    if (typeof imageId !== 'string' || !/^[a-f0-9-]{20,}$/i.test(imageId)) {
        res.status(400).send('Invalid image id');
        return;
    }
    try {
        const upstream = await fetch(`https://www.artic.edu/iiif/2/${imageId}/full/${width},/0/default.jpg`, {
            headers: { 'User-Agent': 'FrameWorthy/1.0', Referer: 'https://www.artic.edu/' },
            signal: AbortSignal.timeout(25_000),
        });
        if (!upstream.ok) {
            res.status(upstream.status).send('Art Institute image unavailable');
            return;
        }
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400, immutable');
        res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
        logger.error('proxyArtInstituteImage: upstream fetch failed', { imageId, message: error.message });
        res.status(502).send('Upstream image fetch failed');
    }
});

const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_ARTWORK_IMPORT_BYTES = 20 * 1024 * 1024;
const MAX_ARTWORK_REDIRECTS = 4;

function isPrivateOrReservedIp(address) {
    const type = net.isIP(address);
    if (type === 4) {
        const [a, b] = address.split('.').map(Number);
        return (
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) || // link-local, incl. cloud metadata (169.254.169.254)
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 192 && b === 168) ||
            (a === 198 && (b === 18 || b === 19)) ||
            a === 0 ||
            a >= 224
        );
    }
    if (type === 6) {
        const lower = address.toLowerCase();
        return (
            lower === '::' ||
            lower === '::1' ||
            lower.startsWith('fe80:') || // link-local
            lower.startsWith('fc') || lower.startsWith('fd') || // unique local
            lower.startsWith('::ffff:127.') // IPv4-mapped loopback
        );
    }
    return true; // Unrecognised form — refuse rather than guess.
}
exports.isPrivateOrReservedIp = isPrivateOrReservedIp; // exported for direct unit testing

async function validateArtworkUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        const error = new Error('Invalid URL');
        error.status = 400;
        throw error;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        const error = new Error('Unsupported protocol');
        error.status = 400;
        throw error;
    }
    if (parsed.username || parsed.password || parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) {
        const error = new Error('Host is not allowed');
        error.status = 403;
        throw error;
    }

    let resolved;
    try {
        resolved = net.isIP(parsed.hostname)
            ? [{ address: parsed.hostname }]
            : await dns.lookup(parsed.hostname, { all: true });
    } catch {
        const error = new Error('Host could not be resolved');
        error.status = 400;
        throw error;
    }
    if (!resolved.length || resolved.some(({ address }) => isPrivateOrReservedIp(address))) {
        const error = new Error('Host is not allowed');
        error.status = 403;
        throw error;
    }
    return parsed;
}

async function fetchArtworkUrl(rawUrl) {
    let currentUrl = rawUrl;
    for (let redirectCount = 0; redirectCount <= MAX_ARTWORK_REDIRECTS; redirectCount += 1) {
        const parsed = await validateArtworkUrl(currentUrl);
        const response = await fetch(parsed.toString(), {
            signal: AbortSignal.timeout(10_000),
            redirect: 'manual',
            headers: { Accept: 'image/*' },
        });
        if (response.status < 300 || response.status >= 400) return { response, finalUrl: parsed };

        const location = response.headers.get('location');
        if (!location || redirectCount === MAX_ARTWORK_REDIRECTS) {
            const error = new Error('Too many redirects');
            error.status = 502;
            throw error;
        }
        currentUrl = new URL(location, parsed).toString();
    }
    throw new Error('Could not load image');
}

function filenameFromArtworkUrl(url, contentType) {
    let filename = '';
    try {
        filename = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
    } catch {
        filename = '';
    }
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100);
    if (filename && filename.includes('.')) return filename;
    const subtype = contentType.split(';')[0].split('/')[1] || 'jpg';
    return `linked-image.${subtype === 'jpeg' ? 'jpg' : subtype}`;
}

// Unlike proxyArtworkImage/arRelay above (both deliberately wildcard-CORS —
// one re-serves public art images a <canvas> needs to read cross-origin,
// the other is fetched by system-level AR viewers with no fixed origin at
// all), this endpoint is only ever meant to be called by this app's own
// frontend, via the same-origin `/api/artwork/import-url` hosting rewrite —
// a wildcard here just let any other website's client-side JS call it too,
// for free, at this project's expense. Restricting to an explicit allowlist
// doesn't change how the app itself calls this (same-origin requests don't
// need the header at all), it only stops third-party pages from doing so.
// Raw onRequest functions do not validate App Check automatically. Keep the
// verification result separate from enforcement so the rollout can first
// measure real production traffic without locking customers out.
async function inspectAppCheckRequest(req, verifyToken = token => admin.appCheck().verifyToken(token)) {
    const rawToken = req.get?.('X-Firebase-AppCheck')
        ?? req.headers?.['x-firebase-appcheck']
        ?? req.headers?.['X-Firebase-AppCheck'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    if (!token || typeof token !== 'string') return { status: 'missing' };

    try {
        const decoded = await verifyToken(token);
        return { status: 'valid', appId: decoded.app_id || null };
    } catch (error) {
        return { status: 'invalid', error: error?.message || 'verification failed' };
    }
}
exports.inspectAppCheckRequest = inspectAppCheckRequest;

const IMPORT_ARTWORK_ALLOWED_ORIGINS = new Set([
    'https://frameworthyco.com',
    'https://www.frameworthyco.com',
    'https://frameworthyco-9c78c.web.app',
    'https://frameworthyco-9c78c.firebaseapp.com',
    'http://localhost:3000',
    'http://localhost:5173',
]);

exports.importArtworkFromUrl = onRequest({ region: 'us-central1', timeoutSeconds: 15, maxInstances: 10 }, async (req, res) => {
    const origin = req.headers?.origin;
    if (origin && IMPORT_ARTWORK_ALLOWED_ORIGINS.has(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    const appCheck = await inspectAppCheckRequest(req);
    if (appCheck.status === 'valid') {
        logger.info('importArtworkFromUrl App Check verified', { appId: appCheck.appId });
    } else {
        logger.warn('importArtworkFromUrl App Check not verified', {
            status: appCheck.status,
            error: appCheck.error,
        });
    }

    const target = req.body?.url;
    if (typeof target !== 'string' || !target.trim()) {
        res.status(400).send('Missing URL');
        return;
    }

    let upstream;
    let finalUrl;
    try {
        ({ response: upstream, finalUrl } = await fetchArtworkUrl(target.trim()));
    } catch (err) {
        const status = err.status || 502;
        logger.warn('importArtworkFromUrl failed', { message: err.message, status });
        res.status(status).send(status === 403 ? 'Host is not allowed' : 'Could not load image');
        return;
    }
    if (!upstream.ok) {
        res.status(upstream.status === 404 ? 404 : 502).send('Could not load image');
        return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
        res.status(415).send('That link is not an image');
        return;
    }

    const declaredLength = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTWORK_IMPORT_BYTES) {
        res.status(413).send('Image is too large');
        return;
    }

    const chunks = [];
    let total = 0;
    for await (const chunk of upstream.body) {
        total += chunk.length;
        if (total > MAX_ARTWORK_IMPORT_BYTES) {
            res.status(413).send('Image is too large');
            return;
        }
        chunks.push(chunk);
    }

    res.set('Content-Type', contentType);
    res.set('X-Artwork-Filename', filenameFromArtworkUrl(finalUrl, contentType));
    res.set('Cache-Control', 'no-store');
    res.status(200).send(Buffer.concat(chunks));
});

// ---------------------------------------------------------------------------
// arRelay — hands a client-built AR model (USDZ/GLB) a real HTTPS URL.
//
// The model itself is built entirely client-side (src/utils/ar/buildArModel.js)
// and normally lives only as a blob: URL — fine for mobile Safari, which
// hands blob: USDZs to AR Quick Look directly. It is NOT fine inside the
// native iOS/Android app: Capacitor's WKWebView (iOS) and Android's Scene
// Viewer (a separate app) both need to hand off to a real system AR viewer,
// and that hand-off is keyed off an actual HTTP response — a blob: URL,
// being pure in-page JS memory, never produces one. This endpoint doesn't
// build or alter the model at all; it just stores the exact bytes the
// client already generated and answers with a URL a real navigation (POST
// to store, then GET to fetch back) or a wholly separate app (Scene Viewer)
// can retrieve independently of the WebView that created it.
//
// Deliberately not a long-lived asset: nothing here is meant to outlive the
// few seconds between a customer opening AR and their device's own viewer
// fetching it once, so age alone (pruneArRelayObjects, below) is a safe
// deletion signal — there's no completion state worth tracking.
const AR_RELAY_CONTENT_TYPES = {
    usdz: 'model/vnd.usdz+zip',
    glb: 'model/gltf-binary',
};
const AR_RELAY_MAX_BYTES = 20 * 1024 * 1024; // generous — real models run low single-digit MB
const AR_RELAY_PATH_RE = /^\/api\/ar-relay\/([a-f0-9-]+)\.(usdz|glb)$/;
const AR_RELAY_BASE_URL = 'https://frameworthyco-9c78c.web.app';

exports.arRelay = onRequest({ region: 'us-central1', timeoutSeconds: 30, maxInstances: 10 }, async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST, GET');
        res.set('Access-Control-Allow-Headers', 'Content-Type, X-Relay-Kind');
        res.status(204).send('');
        return;
    }

    if (req.method === 'GET') {
        const match = AR_RELAY_PATH_RE.exec(req.path);
        if (!match) {
            res.status(400).send('Invalid relay path');
            return;
        }
        const [, id, kind] = match;
        try {
            const [bytes] = await admin.storage().bucket().file(`ar-relay/${id}.${kind}`).download();
            res.set('Content-Type', AR_RELAY_CONTENT_TYPES[kind]);
            res.set('Cache-Control', 'private, max-age=900');
            res.status(200).send(bytes);
        } catch (err) {
            logger.warn('arRelay: object not found or unreadable', { id, kind, message: err.message });
            res.status(404).send('Not found or expired');
        }
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    const kind = req.get('X-Relay-Kind');
    if (!AR_RELAY_CONTENT_TYPES[kind]) {
        res.status(400).send('Missing or unrecognised X-Relay-Kind header');
        return;
    }

    const bytes = req.rawBody;
    if (!bytes || !bytes.length) {
        res.status(400).send('Empty body');
        return;
    }
    if (bytes.length > AR_RELAY_MAX_BYTES) {
        res.status(413).send('Model too large');
        return;
    }

    const id = crypto.randomUUID();
    try {
        await admin.storage().bucket().file(`ar-relay/${id}.${kind}`).save(bytes, {
            contentType: AR_RELAY_CONTENT_TYPES[kind],
            metadata: { cacheControl: 'private, max-age=900' },
        });
        res.status(200).json({ url: `${AR_RELAY_BASE_URL}/api/ar-relay/${id}.${kind}` });
    } catch (err) {
        logger.error('arRelay: storage write failed', { id, kind, message: err.message });
        res.status(502).send('Could not relay model');
    }
});

// Sweeps ar-relay/ objects older than an hour. Nothing legitimate should
// still need one this old (see arRelay's own comment), so object age alone
// is a safe, stateless deletion signal.
exports.pruneArRelayObjects = onSchedule({ schedule: 'every 60 minutes', region: 'us-central1', timeoutSeconds: 120 }, async () => {
    const [files] = await admin.storage().bucket().getFiles({ prefix: 'ar-relay/' });
    const cutoff = Date.now() - 60 * 60 * 1000;
    await Promise.all(files.map(async (file) => {
        const created = new Date(file.metadata.timeCreated).getTime();
        if (created < cutoff) {
            await file.delete().catch((err) => logger.warn('pruneArRelayObjects: delete failed', { name: file.name, message: err.message }));
        }
    }));
});

// Paid Prodigi items are submitted from a Firestore trigger rather than the
// browser. This keeps the API key private and means both Paystack completion
// paths (client verification and webhook verification) reach the same
// idempotent fulfilment step.
exports.submitPaidProdigiOrder = onDocumentUpdated({
    document: 'orders/{orderId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    maxInstances: 10,
    secrets: [prodigiApiKey],
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after || after.paymentStatus !== 'paid' || before?.paymentStatus === 'paid') return;

    const items = (after.items || []).filter((item) => item?.prodigi?.sku);
    if (items.length === 0) return;
    if (after.prodigi?.orderId) return;

    try {
        items.forEach((item) => prodigi.validatePrintQuality(item));
    } catch (error) {
        await event.data.after.ref.update({
            'prodigi.status': 'blocked',
            'prodigi.error': error.message || 'Print quality validation failed.',
            'prodigi.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
    }

    const orderId = event.params.orderId;
    const address = after.shippingAddress || {};
    const missingAddress = !address.countryCode || !address.postalOrZipCode || !address.address || !address.city;
    if (missingAddress) {
        await event.data.after.ref.update({
            'prodigi.status': 'blocked',
            'prodigi.error': 'A country code, postal code, city and street address are required for fulfilment.',
            'prodigi.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
    }

    await event.data.after.ref.update({
        'prodigi.status': 'submitting',
        'prodigi.environment': prodigiEnvironment(),
        'prodigi.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
        const result = await prodigi.createOrder({
            apiKey: prodigiApiKey.value(),
            environment: prodigiEnvironment(),
            input: {
                merchantReference: orderId,
                shippingMethod: items[0]?.prodigi?.shippingMethod || 'Standard',
                callbackUrl: process.env.PRODIGI_CALLBACK_URL || undefined,
                recipient: {
                    name: after.customerName,
                    email: after.userEmail,
                    phoneNumber: address.phone,
                    address: {
                        line1: address.address,
                        line2: address.line2,
                        postalOrZipCode: address.postalOrZipCode,
                        countryCode: address.countryCode,
                        townOrCity: address.city,
                        stateOrCounty: address.stateOrCounty,
                    },
                },
                items: items.map((item) => ({
                    sku: item.prodigi.sku,
                    copies: item.quantity || 1,
                    attributes: item.prodigi.attributes || {},
                    assetUrl: item.productionImage || item.image,
                    sizing: item.prodigi.sizing || 'fillPrintArea',
                })),
            },
        });
        await event.data.after.ref.update({
            'prodigi.status': String(result.order?.status?.stage || result.outcome || 'submitted'),
            'prodigi.orderId': result.order?.id || null,
            'prodigi.outcome': result.outcome || null,
            'prodigi.environment': prodigiEnvironment(),
            'prodigi.error': admin.firestore.FieldValue.delete(),
            'prodigi.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        logger.error('Prodigi order submission failed', { orderId, message: error.message, status: error.status });
        await event.data.after.ref.update({
            'prodigi.status': 'error',
            'prodigi.error': error.message || 'Prodigi order submission failed',
            'prodigi.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});

// Prodigi callbacks do not carry a signing header. Protect this public route
// with an unguessable query token, then re-fetch the order from Prodigi before
// writing any state supplied by the callback.
exports.prodigiCallback = onRequest({
    region: 'us-central1', timeoutSeconds: 30, maxInstances: 10,
    invoker: 'public', secrets: [prodigiApiKey, prodigiCallbackToken],
}, async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
    const supplied = Buffer.from(String(req.query.token || ''));
    const expected = Buffer.from(prodigiCallbackToken.value());
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        res.status(401).send('Unauthorized');
        return;
    }
    const prodigiOrderId = String(req.body?.subject || req.body?.data?.order?.id || req.body?.data?.id || '');
    if (!/^ord_[A-Za-z0-9_-]+$/.test(prodigiOrderId)) { res.status(400).send('Invalid order'); return; }
    try {
        const verified = await prodigi.prodigiRequest({
            apiKey: prodigiApiKey.value(), environment: prodigiEnvironment(), path: `orders/${prodigiOrderId}`,
        });
        const order = verified.order;
        const matches = await admin.firestore().collection('orders').where('prodigi.orderId', '==', prodigiOrderId).limit(1).get();
        if (!matches.empty) {
            await matches.docs[0].ref.update({
                'prodigi.status': order?.status?.stage || 'unknown',
                'prodigi.shipments': order?.shipments || [],
                'prodigi.issues': order?.status?.issues || [],
                'prodigi.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        res.status(200).json({ received: true });
    } catch (error) {
        logger.error('Prodigi callback verification failed', { prodigiOrderId, message: error.message });
        res.status(502).json({ error: 'Could not verify Prodigi order' });
    }
});
