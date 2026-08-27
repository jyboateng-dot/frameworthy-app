import { Browser } from '@capacitor/browser';

const AR_LAUNCH_PATH = '/ar-launch.html';

/**
 * Opens iOS AR Quick Look for a relayed model, from inside the native app.
 *
 * Routed through SFSafariViewController (what @capacitor/browser presents)
 * rather than the app's own WebView, because WKWebView is the one place a
 * rel="ar" link doesn't reach Quick Look — it renders an inline model
 * preview with AR buried inside instead, which is the detour reported from
 * the app. Safari honours rel="ar" by going straight to the AR camera, and
 * SFSafariViewController has carried that same support since iOS 13.
 *
 * A native QLPreviewController plugin (ios/App/App/QuickLookPlugin.swift) was
 * built for this first and is still compiled into the app, but shelved: it
 * went out in two TestFlight builds without ever opening, and the Capacitor
 * bridge answers a call it can't route by returning without settling the
 * promise, so it fails invisibly and can't be diagnosed without a device.
 * This path needs no native build at all to change, which is why it's the
 * one in use — revisit the plugin only with device logs in hand.
 *
 * There is no Android counterpart: Scene Viewer is launched by a plain
 * intent:// navigation — see createAndroidSceneViewerIntent.
 */
export function openQuickLookViaSafari(modelUrl) {
    const launcher = new URL(AR_LAUNCH_PATH, window.location.origin);
    launcher.searchParams.set('model', modelUrl);
    return Browser.open({
        url: launcher.toString(),
        // Apple doesn't let an app remove SFSafariViewController's own URL
        // bar — it's a mandatory anti-phishing control, no API suppresses
        // it — so this can't stop looking like Safari. It can stop looking
        // like a *different app*: matching the toolbar to ar-launch.html's
        // own background keeps the transition from reading as a jump to
        // somewhere else, even with the address bar still showing.
        toolbarColor: '#0c0a09',
    });
}
