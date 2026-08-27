import { registerPlugin } from '@capacitor/core';

/**
 * Bridges to QuickLookPlugin.swift (ios/App/App/QuickLookPlugin.swift), which
 * presents Apple's native QLPreviewController — see that file's own comment
 * for why this exists instead of a web `rel="ar"` link, and why this exact
 * string has to match its `@objc` class name (a mismatch makes the call hang
 * forever rather than fail).
 *
 * Going through QLPreviewController rather than a URL is also what lands the
 * customer *in* AR rather than on Quick Look's object-preview screen with an
 * AR button to press — Apple's own guidance is that the preview screen is an
 * artifact of URL-opening paths, which is what the WebView hand-off had been
 * doing.
 *
 * There is no Android counterpart: Scene Viewer is launched by a plain
 * intent:// navigation, which needs no native plugin — see
 * createAndroidSceneViewerIntent.
 */
const QuickLook = registerPlugin('FrameWorthyQuickLook');

export function presentNativeQuickLook(url) {
    return QuickLook.present({ url });
}
