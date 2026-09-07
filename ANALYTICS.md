# Firebase Analytics (GA4) setup

Nothing was tracking pageviews or events before this — you had no visibility
into how many people visit, what they look at, or where they drop off.

The client code is already wired in `src/services/firebase.js` and
`src/services/analytics.js`, gated on `VITE_FIREBASE_MEASUREMENT_ID`. With no
ID set it's a no-op, so the app behaves exactly as before until the steps
below are done — nothing to roll back or enforce carefully, unlike App Check.

Every route change calls `trackPageView` (wired into `src/App.jsx`), so once
enabled you get a `page_view` event for every page a visitor lands on,
including in-app navigation — a plain HTML page wouldn't need this, but this
app never does a real page reload after the first one, so nothing would be
tracked without it. `src/services/analytics.js` also exports `trackEvent` for
anything else worth tracking later (e.g. "add_to_cart", "begin_checkout") —
not wired up yet, so it's there when you want it.

**Consent gate:** the moment a measurement ID is set, `CookieConsentBanner`
(`src/components/common/CookieConsentBanner.jsx`) starts showing on a first
visit that hasn't decided yet, and Analytics genuinely does not initialize —
not even a background call — until the visitor accepts (see
`src/services/cookieConsent.js`). Declining, or just never deciding, keeps
`getAnalyticsInstance()` returning null forever, same as having no
measurement ID at all. This is why the cookie-consent-banner and analytics
checklist items were done together rather than separately — turning on
tracking without also gating it on consent would have been the wrong order.

## Step 1 — Get a measurement ID

1. Firebase Console → your project → **Project settings** (gear icon) → **Your
   apps** → the web app.
2. If Google Analytics isn't linked yet, there's a prompt right there to link
   or create one — do that first (it creates a GA4 property behind the
   scenes, no separate Google Analytics signup needed).
3. Once linked, the same screen shows a **Measurement ID** — looks like
   `G-XXXXXXXXXX`. Copy it.

## Step 2 — Add the ID and redeploy

1. Local dev: put it in `.env.local`:
   `VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX`
2. Production: add the same value as a GitHub Actions repo secret named
   `VITE_FIREBASE_MEASUREMENT_ID` (Settings → Secrets and variables → Actions)
   — the deploy workflow already reads it from there.
3. Push to `master` (or `npm run build && firebase deploy --only hosting`
   manually) — the next deploy picks it up automatically.

## Step 3 — Confirm it's actually tracking

Firebase Console → **Analytics** → **Realtime** — browse the live site
yourself in another tab and you should see yourself show up within a minute
or so, with the page you're on. If nothing shows up, double check the
measurement ID was pasted correctly and that the deploy actually picked up
the new secret (check the build log for `VITE_FIREBASE_MEASUREMENT_ID` not
being blank).
