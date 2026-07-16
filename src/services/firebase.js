// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
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
