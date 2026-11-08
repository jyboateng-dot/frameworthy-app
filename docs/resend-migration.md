# Resend email setup

FrameWorthy now sends transactional email from Firebase Functions through Resend. The browser no longer contains an email-provider key.

## One-time account setup

1. Create a Resend account and add `frameworthyco.com` as a sending domain.
2. Add the SPF and DKIM DNS records Resend provides. Wait until the domain is marked **Verified**.
3. Create a restricted API key with permission to send email.
4. Store the key in Firebase Secret Manager:

```sh
firebase functions:secrets:set RESEND_API_KEY --project frameworthyco-9c78c
```

The default sender is `FrameWorthy <orders@frameworthyco.com>`. If the verified sender is different, set `RESEND_FROM_EMAIL` in the Functions environment before deploying.

## Functions using Resend

- `sendOrderConfirmationOnPayment` — paid-order confirmation
- `sendPasswordResetLink` — Firebase password reset links
- `sendOrderShareEmail` — authenticated admin order sharing
- `notifyAdminOfChatMessage` — support handoff notifications
- `prodigiCallback` — shipment/tracking notifications

Email sends are server-side and idempotent where the event can be retried. The old EmailJS browser package and EmailJS credentials are no longer used by the app.

## Safe rollout

Deploy Functions only after the Resend API key and sending domain are verified. Send a test password reset, a test admin share, and a sandbox Prodigi tracking callback before removing the old EmailJS account/templates.
