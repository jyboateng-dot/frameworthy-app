const GENERIC_PROFILE_METERS = {
    narrow: { face: 0.025, depth: 0.02 },
    medium: { face: 0.04, depth: 0.028 },
    wide: { face: 0.06, depth: 0.035 },
};

const isMetallicFrame = (frame) => /gold|silver|pewter|metallic|chrome|bronze|copper|rose gold/i.test(`${frame?.name || ''} ${frame?.desc || ''}`);

const arSafeArtworkUrl = (url) => {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/upload/')) {
            return url.replace('/upload/', '/upload/w_1024,c_limit,q_auto,f_jpg/');
        }
        if (parsed.hostname === 'images.unsplash.com') {
            parsed.searchParams.set('fm', 'jpg');
            parsed.searchParams.set('w', '1024');
            return parsed.toString();
        }
    } catch {
        return null;
    }
    return null;
};

const arSafeFrameTextureUrl = (url) => {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;
    try {
        return new URL(url, window.location.origin).toString();
    } catch {
        return null;
    }
};

export function createArPreviewUrls({ projectId, frame, size, orientation, artworkUrl }) {
    const source = arSafeArtworkUrl(artworkUrl);
    if (!projectId || !source) return null;
    const profile = GENERIC_PROFILE_METERS[frame?.widthCategory] || GENERIC_PROFILE_METERS.medium;
    const widthCm = orientation === 'landscape' ? size?.height : size?.width;
    const heightCm = orientation === 'landscape' ? size?.width : size?.height;
    if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm)) return null;
    const payload = {
        artworkUrl: source,
        openingWidthM: widthCm / 100,
        openingHeightM: heightCm / 100,
        frameFaceM: profile.face,
        frameDepthM: profile.depth,
        frameColor: frame?.baseColor,
        frameTextureUrl: arSafeFrameTextureUrl(frame?.previewImg),
        isMetallic: isMetallicFrame(frame),
    };
    const encoded = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const endpoint = `https://us-central1-${projectId}.cloudfunctions.net/createArPreview?d=${encodeURIComponent(encoded)}`;
    return { ios: endpoint, android: `${endpoint}&format=glb` };
}

// iPadOS can present a desktop-like Macintosh user agent, so touch points are
// included in the iOS check. Capacitor reports its native shell directly,
// which avoids relying on its embedded browser's user-agent string.
export function getArPlatform({ userAgent, maxTouchPoints, capacitorPlatform } = {}) {
    const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    const touches = maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);
    const nativePlatform = capacitorPlatform ?? (typeof window !== 'undefined' ? window.Capacitor?.getPlatform?.() : undefined);
    if (nativePlatform === 'ios' || /iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touches > 1)) return 'ios';
    if (nativePlatform === 'android' || /Android/i.test(ua)) return 'android';
    return null;
}

export function createAndroidSceneViewerIntent(modelUrl, fallbackUrl) {
    if (!modelUrl) return null;
    const query = new URLSearchParams({ file: modelUrl, mode: 'ar_only' });
    const fallback = fallbackUrl ?? (typeof window !== 'undefined' ? window.location.href : 'https://frameworthy.co');
    return `intent://arvr.google.com/scene-viewer/1.0?${query}#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallback)};end;`;
}
