// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getToken as getAppCheckTokenFromSdk, initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { hasAnalyticsConsent } from "./cookieConsent";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// App Check — proves requests come from our genuine app (via reCAPTCHA v3 in
// the browser, including the Capacitor webviews that load this same web app)
// so scripted/bot traffic can be rejected before it reaches Functions or
// Firestore. Intentionally gated on the site key being present: with no key
// set this block is a no-op, so the app runs identically until App Check is
// deployed and enforced. See SECURITY_APPCHECK.md for the rollout steps.
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_RECAPTCHA_SITE_KEY;
let appCheckInstance = null;
if (appCheckSiteKey) {
    // In local dev, App Check would otherwise reject requests from localhost.
    // Setting this global before initializeAppCheck makes the SDK print a
    // debug token to the browser console; register that token under
    // App Check > Apps > (this app) > Manage debug tokens to allow dev traffic.
    if (import.meta.env.DEV) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
    });
}

// Raw HTTP functions do not receive App Check automatically the way Firebase
// callable functions do. Callers can use this helper to attach the current
// token explicitly. Returning null keeps local and unconfigured environments
// working while the production rollout is still in monitoring mode.
export const getAppCheckToken = async () => {
    if (!appCheckInstance) return null;
    try {
        const result = await getAppCheckTokenFromSdk(appCheckInstance);
        return result.token || null;
    } catch {
        return null;
    }
};

// Initialize Auth
export const auth = getAuth(app);
export const db = getFirestore(app);
// Region matches where verifyPaystackPayment was deployed (functions/index.js).
export const functions = getFunctions(app, 'us-central1');
// Image storage is handled by Cloudinary (see src/services/storage.js), not
// Firebase Storage — this avoids requiring the Blaze billing plan, which
// Firebase now mandates for Cloud Storage on new projects.

// Analytics — gated on the measurement ID being present, the same way App
// Check is gated on its site key above: with no ID set, this whole block is
// inert and the app behaves exactly as it did before analytics existed. See
// ANALYTICS.md for how to get a measurement ID and what gets tracked.
//
// Unlike App Check, this can't also be a plain module-level constant: it's
// additionally gated on cookie consent (see cookieConsent.js /
// CookieConsentBanner.jsx), which is a decision made interactively after
// the page has already loaded, not something known at import time. Calling
// getAnalyticsInstance() fresh on every trackPageView/trackEvent (rather
// than reading a value captured once at startup) is what lets a visitor who
// accepts partway through their visit start being tracked from that point
// on, without needing a page reload — declining, or never deciding, keeps
// this returning null and Analytics never initializes at all, so no
// tracking cookie is ever set.
const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
let analyticsInitPromise;
export const getAnalyticsInstance = () => {
    if (!measurementId || !hasAnalyticsConsent()) return Promise.resolve(null);
    if (!analyticsInitPromise) {
        // isSupported() is checked because the Analytics SDK relies on
        // IndexedDB/cookies that aren't guaranteed available in every
        // environment this app runs in (a Capacitor native webview in
        // particular) — skipping it there avoids a thrown error rather
        // than silently degrading.
        analyticsInitPromise = isAnalyticsSupported()
            .then((supported) => (supported ? getAnalytics(app) : null))
            .catch(() => null);
    }
    return analyticsInitPromise;
};

// Providers
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
googleProvider.setCustomParameters({ prompt: 'select_account' });
appleProvider.addScope('email');
appleProvider.addScope('name');

export default app;
