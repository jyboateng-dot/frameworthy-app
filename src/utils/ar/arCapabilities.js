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
 * Every check is a real capability probe. User-agent strings appear
 * only where a capability genuinely cannot be feature-detected: iOS
 * needs one because `relList.supports('ar')` is true in some non-AR
 * WebKit contexts, and iPadOS deliberately reports itself as macOS.
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

function supportsQuickLook() {
    if (!isIosDevice()) return false;
    const anchor = document.createElement('a');
    return Boolean(anchor.relList?.supports?.('ar'));
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
 */
export async function detectArMode() {
    if (supportsQuickLook()) return AR_MODE.QUICK_LOOK;
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
 */
export function openQuickLook(usdzUrl) {
    const anchor = document.createElement('a');
    anchor.setAttribute('rel', 'ar');
    anchor.href = usdzUrl;
    anchor.appendChild(document.createElement('img'));
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    // Left for a tick so Safari can read the anchor during its own
    // activation handling before it disappears.
    setTimeout(() => anchor.remove(), 1000);
}
