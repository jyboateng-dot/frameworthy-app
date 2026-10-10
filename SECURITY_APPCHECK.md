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

## Current status (checked in console, 2026-09-07)

Where things actually stand right now, for reference:

- **Web app**: registered, reCAPTCHA provider attached — matches the client
  code. Step 1-2 above are done.
- **iOS app** (`com.frameworthyco.app`): **not registered at all** — shows
  "Register" with no attestation provider. The Capacitor iOS build currently
  gets no App Check coverage.
- **Cloud Firestore** and **Authentication**: both in **Monitoring**, not
  Enforce — 0% of traffic showing as verified so far (likely mostly just low
  volume, since the site's still behind the private-preview gate — worth
  confirming this climbs once real traffic starts, not assuming it will).
- **Cloud Functions**: no App Check enforcement configured at all yet — the
  console just shows a "view docs" link, not a monitoring/enforce toggle like
  Firestore has.

### The one gap App Check's own toggle won't cover

`importArtworkFromUrl` (the "paste an image link" endpoint) is an `onRequest`
function, not an `onCall` one, so the Functions Enforce toggle does not cover
it automatically. The client now attaches `X-Firebase-AppCheck` when App
Check is configured, and the function verifies the token with the Admin SDK.

The endpoint is deliberately in **monitoring mode** for the first rollout:
missing and invalid tokens are logged but are not rejected yet. After the new
client has been live long enough to show that legitimate imports consistently
log `App Check verified`, change the function to reject `missing` and
`invalid` results before fetching the supplied URL. This ordering prevents an
App Check configuration problem from locking customers out of URL imports.

The endpoint's CORS allowlist remains useful browser hardening, but CORS is
not the security boundary. Enforcing the verified App Check result after the
monitoring window is what prevents scripts and other non-browser clients from
using the raw function URL.
