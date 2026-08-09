// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
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
if (appCheckSiteKey) {
    // In local dev, App Check would otherwise reject requests from localhost.
    // Setting this global before initializeAppCheck makes the SDK print a
    // debug token to the browser console; register that token under
    // App Check > Apps > (this app) > Manage debug tokens to allow dev traffic.
    if (import.meta.env.DEV) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
    });
}

// Initialize Auth
export const auth = getAuth(app);
export const db = getFirestore(app);
// Region matches where verifyPaystackPayment was deployed (functions/index.js).
export const functions = getFunctions(app, 'us-central1');
// Image storage is handled by Cloudinary (see src/services/storage.js), not
// Firebase Storage — this avoids requiring the Blaze billing plan, which
// Firebase now mandates for Cloud Storage on new projects.

// Providers
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
googleProvider.setCustomParameters({ prompt: 'select_account' });
appleProvider.addScope('email');
appleProvider.addScope('name');

export default app;
