import { registerPlugin } from '@capacitor/core';

/**
 * Bridges to QuickLookPlugin.swift (ios/App/App/QuickLookPlugin.swift),
 * which presents Apple's native QLPreviewController directly — see that
 * file's own comment for why this exists instead of a web `rel="ar"`
 * link. There is no Android counterpart: Android's equivalent (Scene
 * Viewer) is launched by a plain intent:// navigation, which needs no
 * native plugin at all — see createAndroidSceneViewerIntent.
 */
const QuickLook = registerPlugin('QuickLook');

export function presentNativeQuickLook(url) {
    return QuickLook.present({ url });
}
