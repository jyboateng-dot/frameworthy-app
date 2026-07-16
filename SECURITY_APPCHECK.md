# Firebase App Check rollout

App Check verifies that requests to Cloud Functions and Firestore come from
our genuine app (via reCAPTCHA v3 in the browser, which also covers the
Capacitor iOS/Android webviews since they load the same web app). Un-verified
traffic — bots, scripts, Burp Suite, scrapers — is rejected before it can hit
the backend.

The client code is already wired in `src/services/firebase.js`, gated on
`VITE_APPCHECK_RECAPTCHA_SITE_KEY`. With no key set it is a no-op, so the app
behaves exactly as before until the steps below are done.

## Golden rule

Do NOT enable *enforcement* until real traffic is already sending valid tokens.
Enforcing first would reject your own customers. Follow the order below.

## Step 1 — Register the app (get the site key)

1. Firebase Console → your project → **App Check** (under Build/Release).
2. Register the **web app** with the **reCAPTCHA v3** provider. The console
   will create/link a reCAPTCHA v3 key and show you a **site key** (public).
3. Copy that site key.

## Step 2 — Add the key and redeploy (tokens flow, nothing rejected yet)

1. Put the key in your local `.env.local`:
   `VITE_APPCHECK_RECAPTCHA_SITE_KEY=<the site key>`
2. Rebuild and redeploy hosting:
   `npm run build && firebase deploy --only hosting`
3. For local `npm run dev`: the app prints an App Check **debug token** to the
   browser console. Register it under
   App Check → Apps → (this app) → **Manage debug tokens** so dev traffic works.

## Step 3 — Watch the metrics

In Firebase Console → App Check, each product (Functions, Firestore) shows a
breakdown of **verified vs. unverified** requests. Wait until nearly all
legitimate traffic shows as verified (usually a few hours to a day, once the
new build is live and users have loaded it).

## Step 4 — Enforce

Only now, in Firebase Console → App Check, turn on **Enforce** for:
- Cloud Functions (callable)
- Cloud Firestore

From this point, requests without a valid App Check token are rejected.

## Rollback

If something breaks after enforcing, toggle **Enforce** back off in the
console — it takes effect within minutes, no redeploy needed. To disable App
Check on the client entirely, unset `VITE_APPCHECK_RECAPTCHA_SITE_KEY` and
redeploy.
