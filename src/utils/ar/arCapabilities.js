/**
 * Which AR mechanism this device can actually use.
 *
 * The platforms take genuinely different routes, and the choice is
 * forced by what each one supports rather than by preference:
 *
 *   quick-look          iOS hands a .usdz to the system AR viewer, over
 *                        a blob: URL. Works in mobile Safari (and any
 *                        WebKit browser there, since it's all Safari
 *                        underneath) — but not inside the native app's
 *                        WKWebView, which is native-quick-look below.
 *
 *   native-quick-look    iOS, inside the Capacitor app. WKWebView does
 *                        not hand a blob: URL to Quick Look the way
 *                        Safari does — there is no real HTTP response
 *                        for it to key the hand-off off. The model is
 *                        relayed through arRelay (functions/index.js)
 *                        to get a real HTTPS URL first.
 *
 *   webxr                Android Chrome and desktop headset browsers
 *                        run the session in-page, reading the blob we
 *                        already built locally — no relay needed.
 *
 *   native-scene-viewer   Android, inside the Capacitor app. Chrome's
 *                        WebXR isn't available in a bare Android
 *                        WebView, so this hands the (also relayed)
 *                        .glb to Google's Scene Viewer app instead —
 *                        the same relay endpoint as iOS, different
 *                        hand-off mechanism on the other side.
 *
 *   viewer-only          Everything else — the desktop case, and any
 *                        mobile browser with neither WebXR nor Quick
 *                        Look. No major desktop browser implements
 *                        immersive-ar without a headset attached, so
 *                        this is an orbit preview, honestly labelled
 *                        as one rather than dressed up as AR.
 *
 * iOS is decided by user-agent alone, not by feature-probing —
 * `HTMLAnchorElement.relList.supports('ar')`, the capability check
 * Apple documents for this, turned out to return false on real
 * AR-capable iPhones (confirmed: a customer on an actual iPhone was
 * dropped to the desktop viewer-only fallback). Since AR Quick Look
 * has shipped on effectively every iOS device still receiving updates
 * (iOS 12+), a `rel="ar"` link that turns out to be wrong for some
 * edge-case device just falls back to a normal file download — a far
 * better failure mode than confidently telling someone on their own
 * phone that they need a phone.
 */

export const AR_MODE = {
    QUICK_LOOK: 'quick-look',
    NATIVE_QUICK_LOOK: 'native-quick-look',
    WEBXR: 'webxr',
    NATIVE_SCENE_VIEWER: 'native-scene-viewer',
    VIEWER_ONLY: 'viewer-only',
};

import { Capacitor } from '@capacitor/core';

/**
 * True only inside the native iOS/Android app shell (Capacitor), never in
 * a browser tab — including the exact same site loaded in mobile Safari
 * or Chrome. This is the signal that decides whether a blob: URL is
 * usable as-is (a browser) or needs relaying to a real HTTPS URL first
 * (the native WebView/Scene Viewer hand-off — see the AR_MODE comment
 * above).
 */
export function isCapacitorNative() {
    return Capacitor.isNativePlatform();
}

export function isIosDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ reports the desktop Safari UA; touch points are what
    // still separate it from an actual Mac.
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isAndroidDevice() {
    if (typeof navigator === 'undefined') return false;
    return /Android/.test(navigator.userAgent || '');
}

/**
 * True on any handheld — used only to pick the right words for the
 * viewer-only fallback message, never to gate a capability. An Android
 * phone that lands on viewer-only because its browser lacks WebXR (a
 * real, common case: Firefox/Samsung Internet/older Chrome, or no
 * ARCore installed) still has a phone in hand, so it must not be told
 * it needs one — that was the exact wrong message iOS was showing.
 */
export function isMobileDevice() {
    return isIosDevice() || isAndroidDevice();
}

async function supportsWebXrAr() {
    if (typeof navigator === 'undefined' || !navigator.xr?.isSessionSupported) return false;
    try {
        return await navigator.xr.isSessionSupported('immersive-ar');
    } catch {
        // Some browsers reject rather than resolve false when the
        // feature is disabled by policy or missing ARCore.
        return false;
    }
}

/**
 * Resolves the mode this device should use. Async because WebXR's
 * support check is a promise — there is no synchronous equivalent.
 *
 * iOS is decided outright, before any feature probe — see the module
 * comment for why. Android takes the native-app branch outright too,
 * for a different reason: a bare Android WebView doesn't carry WebXR
 * the way Chrome does, so probing would just correctly report "no" and
 * silently drop native Android to the desktop-style viewer-only
 * fallback — Scene Viewer is the real capability there, it just isn't
 * reachable through navigator.xr. Everything else (Android web, desktop,
 * headset browsers) goes through the real WebXR capability check, since
 * that one has proven reliable; it's Apple's own probe that lied.
 */
export async function detectArMode() {
    const native = isCapacitorNative();
    if (isIosDevice()) return native ? AR_MODE.NATIVE_QUICK_LOOK : AR_MODE.QUICK_LOOK;
    if (isAndroidDevice() && native) return AR_MODE.NATIVE_SCENE_VIEWER;
    if (await supportsWebXrAr()) return AR_MODE.WEBXR;
    return AR_MODE.VIEWER_ONLY;
}

/**
 * Hands a .usdz to iOS AR Quick Look.
 *
 * Safari triggers Quick Look from the anchor's own activation, not from
 * a navigation, so the element has to exist in the document and be
 * clicked. The child <img> is not decorative: Safari ignores a
 * `rel="ar"` anchor with no content, treating it as a normal link and
 * downloading the file instead of opening it in AR.
 *
 * `download` is not decorative either, despite this never actually
 * downloading anything — a `blob:` URL is opaque and carries no file
 * extension of its own, and iOS 17 made Quick Look depend on seeing
 * one: without it, Quick Look opens and immediately closes again for a
 * blob href, silently, with nothing in the console. The `download`
 * attribute is where Safari finds the `.usdz` it's otherwise missing
 * (confirmed against model-viewer's own AR launcher, which sets the
 * same attribute for exactly this reason).
 */
export function openQuickLook(usdzUrl) {
    const anchor = document.createElement('a');
    anchor.setAttribute('rel', 'ar');
    anchor.href = usdzUrl;
    anchor.setAttribute('download', 'model.usdz');
    anchor.appendChild(document.createElement('img'));
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    // Left for a tick so Safari can read the anchor during its own
    // activation handling before it disappears.
    setTimeout(() => anchor.remove(), 1000);
}

/**
 * Builds the intent:// URL that launches Google's Scene Viewer app on a
 * .glb hosted at a real, publicly-fetchable URL — Scene Viewer runs as a
 * separate app and fetches the model itself, so it can never read a
 * blob: URL scoped to this page (hence relaying through arRelay first to
 * get `modelUrl`). `browser_fallback_url` is where Play Services sends
 * the user if Scene Viewer/ARCore isn't installed, so it points back at
 * this same AR screen rather than a dead end.
 */
export function createAndroidSceneViewerIntent(modelUrl) {
    const fallback = typeof window !== 'undefined' ? window.location.href : 'https://frameworthyco.com';
    const query = new URLSearchParams({ file: modelUrl, mode: 'ar_only' });
    return `intent://arvr.google.com/scene-viewer/1.0?${query}#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallback)};end;`;
}
