// Guards the platform-detection bug that shipped: a real iPhone was
// falling through to the desktop viewer-only fallback because
// detectArMode() gated iOS behind `relList.supports('ar')`, a capability
// probe that turned out to lie on real hardware. iOS must now be decided
// by user agent alone, with no feature probe that could reintroduce the
// same silent failure.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

import { Capacitor } from '@capacitor/core';
import {
    AR_MODE,
    detectArMode,
    isIosDevice,
    isAndroidDevice,
    isMobileDevice,
    isCapacitorNative,
    openQuickLook,
    createAndroidSceneViewerIntent,
} from './arCapabilities';

const REAL_IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const REAL_IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// iPadOS 13+ reports as desktop Safari; only maxTouchPoints tells it
// apart from an actual Mac.
const IPADOS_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const REAL_ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const DESKTOP_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function mockNavigator({ userAgent, platform = '', maxTouchPoints = 0 }) {
    Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
    Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
}

describe('isIosDevice', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('recognises a real iPhone UA', () => {
        mockNavigator({ userAgent: REAL_IPHONE_UA });
        expect(isIosDevice()).toBe(true);
    });

    it('recognises a real iPad UA', () => {
        mockNavigator({ userAgent: REAL_IPAD_UA });
        expect(isIosDevice()).toBe(true);
    });

    it('recognises modern iPadOS reporting as desktop Safari, via touch points', () => {
        mockNavigator({ userAgent: IPADOS_DESKTOP_UA, platform: 'MacIntel', maxTouchPoints: 5 });
        expect(isIosDevice()).toBe(true);
    });

    it('does not mistake an actual Mac for an iPad', () => {
        mockNavigator({ userAgent: IPADOS_DESKTOP_UA, platform: 'MacIntel', maxTouchPoints: 0 });
        expect(isIosDevice()).toBe(false);
    });

    it('rejects desktop and Android UAs', () => {
        mockNavigator({ userAgent: DESKTOP_CHROME_UA });
        expect(isIosDevice()).toBe(false);
        mockNavigator({ userAgent: REAL_ANDROID_UA });
        expect(isIosDevice()).toBe(false);
    });
});

describe('isAndroidDevice / isMobileDevice', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('recognises Android and excludes desktop', () => {
        mockNavigator({ userAgent: REAL_ANDROID_UA });
        expect(isAndroidDevice()).toBe(true);
        mockNavigator({ userAgent: DESKTOP_CHROME_UA });
        expect(isAndroidDevice()).toBe(false);
    });

    it('is true for either handheld platform, false for desktop', () => {
        mockNavigator({ userAgent: REAL_IPHONE_UA });
        expect(isMobileDevice()).toBe(true);
        mockNavigator({ userAgent: REAL_ANDROID_UA });
        expect(isMobileDevice()).toBe(true);
        mockNavigator({ userAgent: DESKTOP_CHROME_UA });
        expect(isMobileDevice()).toBe(false);
    });
});

describe('detectArMode', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        // navigator.xr is deleted between tests rather than left stubbed,
        // since its mere presence changes detectArMode's branch.
        delete window.navigator.xr;
        Capacitor.isNativePlatform.mockReturnValue(false);
    });

    it('returns native-quick-look for iOS inside the Capacitor app', async () => {
        // The whole reason this mode exists: a blob: USDZ opens fine in
        // Safari but silently no-ops in the app's WKWebView, so the native
        // shell needs its own mode even though it's still "iOS".
        mockNavigator({ userAgent: REAL_IPHONE_UA });
        Capacitor.isNativePlatform.mockReturnValue(true);
        expect(await detectArMode()).toBe(AR_MODE.NATIVE_QUICK_LOOK);
    });

    it('returns native-scene-viewer for Android inside the Capacitor app, even if WebXR would report support', async () => {
        // Native must win outright, the same way iOS wins outright above —
        // a bare Android WebView reporting navigator.xr support (it never
        // actually does, but the point is the native check can't be a
        // priority tiebreaker that a stray polyfill could subvert).
        mockNavigator({ userAgent: REAL_ANDROID_UA });
        Capacitor.isNativePlatform.mockReturnValue(true);
        window.navigator.xr = { isSessionSupported: vi.fn().mockResolvedValue(true) };
        expect(await detectArMode()).toBe(AR_MODE.NATIVE_SCENE_VIEWER);
    });

    it('returns quick-look for iOS regardless of any WebXR/relList state', () => {
        mockNavigator({ userAgent: REAL_IPHONE_UA });
        // Even if the device happened to also report WebXR support (it
        // never does — iOS has none — but the point is iOS must win
        // outright, not merely win a priority order), the branch that
        // shipped broken relied on a DOM capability probe instead of
        // this UA check. Asserting the return value directly, with
        // nothing else configured, is what pins that the probe is gone.
        return detectArMode().then((mode) => {
            expect(mode).toBe(AR_MODE.QUICK_LOOK);
        });
    });

    it('returns webxr when navigator.xr reports immersive-ar support', async () => {
        mockNavigator({ userAgent: REAL_ANDROID_UA });
        window.navigator.xr = { isSessionSupported: vi.fn().mockResolvedValue(true) };
        expect(await detectArMode()).toBe(AR_MODE.WEBXR);
    });

    it('falls back to viewer-only on Android without WebXR support', async () => {
        mockNavigator({ userAgent: REAL_ANDROID_UA });
        window.navigator.xr = { isSessionSupported: vi.fn().mockResolvedValue(false) };
        expect(await detectArMode()).toBe(AR_MODE.VIEWER_ONLY);
    });

    it('falls back to viewer-only on desktop with no navigator.xr at all', async () => {
        mockNavigator({ userAgent: DESKTOP_CHROME_UA });
        expect(await detectArMode()).toBe(AR_MODE.VIEWER_ONLY);
    });

    it('treats a rejected WebXR support check as unsupported, not an error', async () => {
        mockNavigator({ userAgent: REAL_ANDROID_UA });
        window.navigator.xr = { isSessionSupported: vi.fn().mockRejectedValue(new Error('policy disabled')) };
        expect(await detectArMode()).toBe(AR_MODE.VIEWER_ONLY);
    });
});

describe('openQuickLook', () => {
    it('sets download="model.usdz" so iOS 17+ can infer the extension a blob: URL lacks', () => {
        // Without this, Quick Look opens and silently closes again for a
        // blob href on iOS 17+ — the actual bug behind "nothing happens"
        // when tapping the AR button, confirmed against model-viewer's
        // own launcher setting the same attribute for the same reason.
        let anchor;
        const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
            anchor = el;
            return el;
        });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        openQuickLook('blob:https://example.com/some-uuid');

        expect(anchor.getAttribute('rel')).toBe('ar');
        expect(anchor.getAttribute('download')).toBe('model.usdz');
        expect(anchor.firstChild?.tagName).toBe('IMG');

        appendChild.mockRestore();
    });
});

describe('isCapacitorNative', () => {
    afterEach(() => Capacitor.isNativePlatform.mockReturnValue(false));

    it('mirrors Capacitor.isNativePlatform()', () => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        expect(isCapacitorNative()).toBe(false);
        Capacitor.isNativePlatform.mockReturnValue(true);
        expect(isCapacitorNative()).toBe(true);
    });
});

describe('createAndroidSceneViewerIntent', () => {
    it('builds a Scene Viewer intent carrying the relayed model URL and an ar_only mode', () => {
        const intent = createAndroidSceneViewerIntent('https://frameworthyco-9c78c.web.app/api/ar-relay/abc.glb');

        expect(intent).toMatch(/^intent:\/\/arvr\.google\.com\/scene-viewer\/1\.0\?/);
        expect(intent).toContain(encodeURIComponent('https://frameworthyco-9c78c.web.app/api/ar-relay/abc.glb'));
        expect(intent).toContain('mode=ar_only');
        expect(intent).toContain('package=com.google.ar.core');
        expect(intent).toContain('S.browser_fallback_url=');
    });
});
