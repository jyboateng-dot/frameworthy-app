// This app sets no tracking cookies today on its own (Firebase Auth's
// session persistence and the cart/wishlist are localStorage, not cookies —
// see PrivacyPage.jsx's own "Local device data" section). Firebase
// Analytics (see analytics.js/firebase.js) is the one thing that WOULD set
// real tracking cookies (GA4's _ga / _ga_<id>) once a measurement ID is
// configured — so consent is asked before that ever initializes, not after.
const STORAGE_KEY = 'fw_cookie_consent'; // 'granted' | 'declined'

export const getConsentStatus = () => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        // Private browsing / storage blocked — treat as "not yet decided"
        // rather than throwing; the banner will just keep showing.
        return null;
    }
};

export const hasAnalyticsConsent = () => getConsentStatus() === 'granted';

const setConsentStatus = (value) => {
    try {
        localStorage.setItem(STORAGE_KEY, value);
    } catch {
        // Nothing to persist to — the banner will reappear next visit,
        // which is the safe direction to fail in (asking again, not
        // silently tracking without ever having asked).
    }
};

export const grantConsent = () => setConsentStatus('granted');
export const declineConsent = () => setConsentStatus('declined');
