/**
 * Which AR mechanism this device can actually use.
 *
 * The three platforms take genuinely different routes, and the choice
 * is forced by what each one supports rather than by preference:
 *
 *   quick-look   iOS hands a .usdz to the system AR viewer. iOS has no
 *                WebXR at all — Safari doesn't implement it and every
 *                other iOS browser is WebKit underneath — so this is
 *                the only route there, not the preferred one.
 *
 *   webxr        Android Chrome and desktop headset browsers run the
 *                session in-page. Chosen over Android's Scene Viewer
 *                because Scene Viewer is a separate app and can only
 *                fetch a public URL, which would mean uploading a
 *                model per preview; an in-page session reads the blob
 *                we already built locally.
 *
 *   viewer-only  Everything else — the desktop case. No major desktop
 *                browser implements immersive-ar without a headset
 *                attached, so this is an orbit preview, honestly
 *                labelled as one rather than dressed up as AR.
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
    WEBXR: 'webxr',
    VIEWER_ONLY: 'viewer-only',
};

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
 * comment for why. Everything else (Android, desktop, headset
 * browsers) goes through the real WebXR capability check, since that
 * one has proven reliable; it's Apple's own probe that lied.
 */
export async function detectArMode() {
    if (isIosDevice()) return AR_MODE.QUICK_LOOK;
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
