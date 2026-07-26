import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// target="_blank" / window.open are no-ops (or navigate the app away from
// itself) inside a Capacitor WebView -- there's no browser chrome to open a
// new tab in. Route external links through the system's in-app browser on
// native platforms instead; web behavior (real new tab) is untouched.
export const openExternalLink = (url) => {
    if (Capacitor.isNativePlatform()) {
        Browser.open({ url });
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};

// Same as openExternalLink, but for use as an anchor's onClick handler where
// the anchor already carries href/target="_blank" for correct web behavior
// and non-JS fallback (e.g. right-click "open in new tab" still works).
export const openExternalLinkFromEvent = (e, url) => {
    if (!Capacitor.isNativePlatform()) return;
    e.preventDefault();
    Browser.open({ url });
};
