import { logEvent } from 'firebase/analytics';
import { analyticsReady } from './firebase';

// Firebase Analytics (GA4) only auto-logs a page_view on its own initial
// load — it has no idea this is a single-page app that swaps content
// without a real page load, so every route change has to be reported by
// hand. analyticsReady resolves to null wherever analytics isn't
// configured/supported (see firebase.js), so every call here is a safe
// no-op until a measurement ID is actually set.
export const trackPageView = async (path, title) => {
    const analytics = await analyticsReady;
    if (!analytics) return;
    logEvent(analytics, 'page_view', {
        page_path: path,
        page_title: title,
        page_location: window.location.href,
    });
};

// General-purpose event logger for anything worth tracking beyond page
// views (e.g. "add_to_cart", "begin_checkout") — same safe-no-op guarantee.
export const trackEvent = async (name, params = {}) => {
    const analytics = await analyticsReady;
    if (!analytics) return;
    logEvent(analytics, name, params);
};
