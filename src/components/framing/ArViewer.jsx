import React, { useEffect, useRef, useState } from 'react';
import { X, Loader, RotateCcw } from 'lucide-react';
import { buildArModel } from '../../utils/ar/buildArModel';
import {
    AR_MODE,
    detectArMode,
    openQuickLook,
    isMobileDevice,
    createAndroidSceneViewerIntent,
} from '../../utils/ar/arCapabilities';
import { relayArModel } from '../../utils/ar/arModelRelay';
import { openQuickLookViaSafari } from '../../utils/ar/nativeQuickLook';

/**
 * "See it on your wall" — the AR entry point from the visualizer.
 *
 * Every device gets the orbit preview; what changes per platform is
 * what happens next. WebXR devices open a session in this same canvas.
 * Mobile Safari hands the .usdz to AR Quick Look over a blob: URL, which
 * works there but not inside the native app's WKWebView — Capacitor's
 * WebView doesn't hand a tapped `rel="ar"` link to Quick Look the way
 * Safari does, and just shows its own generic in-page model preview
 * instead (confirmed on hardware as the extra "view 3D object, then tap
 * AR" steps a customer had to take to get into AR at all). So the two
 * native-app modes (see arCapabilities.js) hand the model to something
 * outside this WebView: iOS to Safari, which does honour rel="ar"
 * (nativeQuickLook.js), and Android to Google's Scene Viewer app. Both
 * need the model relayed to a real HTTPS URL first — arModelRelay.js —
 * since neither can read the blob: URL this page built it into.
 *
 * Every mode launches itself the instant it's ready, rather than waiting
 * for a second tap on the CTA underneath — the customer already asked
 * for AR by opening this screen, so the orbit preview shows only as long
 * as the model takes to build (and, for the native modes, to relay). The
 * CTA stays mounted regardless, as the manual retry path for whichever
 * auto-launch a browser's user-activation rules silently refuse — a real
 * possibility for the two web modes specifically, and browser-dependent.
 */

const CTA_LABEL = {
    [AR_MODE.QUICK_LOOK]: 'View on your wall',
    [AR_MODE.WEBXR]: 'View on your wall',
};

const RELAY_KIND_BY_MODE = {
    [AR_MODE.NATIVE_QUICK_LOOK]: 'usdz',
    [AR_MODE.NATIVE_SCENE_VIEWER]: 'glb',
};

// What "launch AR" means for each native mode, once arRelay has handed back
// a real URL for it. Both get the model in front of something that isn't
// this WebView — Safari for Quick Look, the Scene Viewer app for Android —
// because the WebView is precisely what can't hand off to AR.
const NATIVE_LAUNCH = {
    [AR_MODE.NATIVE_QUICK_LOOK]: (url) => openQuickLookViaSafari(url),
    [AR_MODE.NATIVE_SCENE_VIEWER]: (url) => window.location.assign(createAndroidSceneViewerIntent(url)),
};

// Scene Viewer's launcher returns nothing; Quick Look's returns a promise
// from the native bridge — this covers both without the caller needing to
// know which.
//
// The race is a hang detector, not a deadline. Capacitor answers a call for
// a plugin it can't resolve by returning *without* settling the promise, so
// a bridge-side mismatch presents as the button doing nothing at all, with
// nothing logged and no rejection to catch — which is exactly how a broken
// build of this reached TestFlight. Scene Viewer's navigation settles at
// once and Quick Look's resolves when its sheet is up, so anything past
// this bound is a fault worth surfacing rather than waiting on.
const NATIVE_LAUNCH_TIMEOUT_MS = 30_000;

function launchNative(mode, url) {
    return Promise.race([
        Promise.resolve(NATIVE_LAUNCH[mode]?.(url)),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Native AR launch (${mode}) never responded`)), NATIVE_LAUNCH_TIMEOUT_MS);
        }),
    ]);
}

export default function ArViewer({
    isOpen,
    onClose,
    frame,
    widthIn,
    heightIn,
    matInches,
    matColorHex,
    artworkUrl,
    hardwareType,
}) {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const sceneRef = useRef(null);

    const [mode, setMode] = useState(null);
    const [model, setModel] = useState(null);
    const [status, setStatus] = useState('loading');
    const [inSession, setInSession] = useState(false);
    const [hasPlaced, setHasPlaced] = useState(false);
    // Only ever touched for the two native-app modes — a real HTTPS URL
    // standing in for the blob: one, once arRelay has stored the model.
    const [nativeRelayUrl, setNativeRelayUrl] = useState(null);
    const [nativeRelayStatus, setNativeRelayStatus] = useState('idle');

    useEffect(() => {
        if (!isOpen) return undefined;

        let cancelled = false;
        let scene = null;
        setStatus('loading');
        setInSession(false);
        setHasPlaced(false);
        setNativeRelayUrl(null);
        setNativeRelayStatus('idle');

        (async () => {
            try {
                const [detected, built] = await Promise.all([
                    detectArMode(),
                    buildArModel({
                        frame,
                        widthIn,
                        heightIn,
                        matIn: matInches || 0,
                        matColorHex,
                        artworkUrl,
                        hardwareType,
                    }),
                ]);
                if (cancelled) return;

                setMode(detected);
                setModel(built);

                // Ahead of the three.js import below, deliberately. Both
                // native modes hand off to something that replaces this
                // screen outright, so every millisecond spent pulling a
                // ~600KB renderer chunk and parsing a GLB first is time the
                // customer waits to see nothing. Kicking the upload off here
                // overlaps it with that download instead of queueing behind
                // it, and the preview still ends up built for whoever backs
                // out of AR and lands here again.
                const relayKind = RELAY_KIND_BY_MODE[detected];
                if (relayKind) {
                    setNativeRelayStatus('loading');
                    const relaySrc = relayKind === 'usdz' ? built.usdzUrl : built.glbUrl;
                    relayArModel(relaySrc, relayKind)
                        .then((url) => {
                            if (cancelled) return;
                            setNativeRelayUrl(url);
                            setNativeRelayStatus('ready');
                            return launchNative(detected, url);
                        })
                        .catch((error) => {
                            if (cancelled) return;
                            console.warn('Native AR failed:', error);
                            // Distinguished so the button can stay tappable
                            // for a retry when the model itself relayed fine
                            // and only the hand-off fell over.
                            setNativeRelayStatus((current) => (current === 'ready' ? 'launch-failed' : 'error'));
                        });
                }

                // Imported here rather than at module scope so three.js
                // and its loaders stay out of the main bundle — this is
                // the only screen that needs them, and most sessions
                // never open it.
                const { ArScene } = await import('../../utils/ar/arScene');
                if (cancelled || !canvasRef.current) return;

                scene = new ArScene(canvasRef.current);
                sceneRef.current = scene;
                scene.onSessionEnd = () => {
                    setInSession(false);
                    setHasPlaced(false);
                    scene.startPreview();
                };

                await scene.loadModel(built.glbUrl);
                if (cancelled) return;

                scene.startPreview();
                setStatus('ready');

                // Straight into AR the moment it's ready, for the two web
                // modes — the native pair already launched themselves above,
                // off the back of their relay. Not awaited: a rejection here
                // just leaves the manual CTA as the way in, same as if this
                // block didn't exist.
                if (detected === AR_MODE.QUICK_LOOK) {
                    openQuickLook(built.usdzUrl);
                } else if (detected === AR_MODE.WEBXR) {
                    setInSession(true);
                    scene.startAr(overlayRef.current).catch((error) => {
                        if (cancelled) return;
                        console.warn('AR session refused:', error);
                        setInSession(false);
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    console.warn('AR preview failed to build:', error);
                    setStatus('error');
                }
            }
        })();

        return () => {
            cancelled = true;
            scene?.dispose();
            sceneRef.current = null;
        };
    }, [isOpen, frame, widthIn, heightIn, matInches, matColorHex, artworkUrl, hardwareType]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape' && !inSession) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, inSession, onClose]);

    if (!isOpen) return null;

    const launchAr = async () => {
        if (mode === AR_MODE.QUICK_LOOK) {
            openQuickLook(model.usdzUrl);
            return;
        }
        if (mode === AR_MODE.WEBXR && sceneRef.current) {
            try {
                setInSession(true);
                await sceneRef.current.startAr(overlayRef.current);
            } catch (error) {
                console.warn('AR session refused:', error);
                setInSession(false);
            }
        }
    };

    const placePiece = () => {
        if (sceneRef.current?.place()) setHasPlaced(true);
    };

    const ctaLabel = CTA_LABEL[mode];

    return (
        <div className="fixed inset-0 z-[100] bg-stone-950/95 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] shrink-0">
                <div className="text-white">
                    <p className="text-sm font-bold">See it on your wall</p>
                    {model && (
                        <p className="text-[11px] text-stone-400">
                            {(model.outerWidthM * 100).toFixed(0)} × {(model.outerHeightM * 100).toFixed(0)} cm
                            {!model.isMeasured && ' · approximate depth'}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                    aria-label="Close AR preview"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="relative flex-1 min-h-0">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full block touch-none"
                />

                {status === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-300">
                        <Loader size={22} className="animate-spin" />
                        <p className="text-xs">Building your frame…</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center px-8">
                        <p className="text-center text-xs text-stone-300 max-w-xs">
                            This preview couldn&apos;t be built. Your frame settings are unaffected —
                            close this and carry on customizing.
                        </p>
                    </div>
                )}

                {/* Lives inside the XR dom-overlay while a session runs, which
                    is why it stays mounted rather than swapping with the
                    canvas — the session would lose its overlay root. */}
                <div ref={overlayRef} className="absolute inset-x-0 bottom-0 pointer-events-none">
                    {inSession && (
                        <div className="p-5 flex flex-col items-center gap-3 pointer-events-auto">
                            <p className="text-xs text-white/90 bg-black/50 rounded-full px-4 py-2">
                                {hasPlaced ? 'Looks good?' : 'Point at your wall, then tap Place'}
                            </p>
                            <div className="flex items-center gap-2">
                                {hasPlaced ? (
                                    <button
                                        type="button"
                                        onClick={() => { sceneRef.current?.unplace(); setHasPlaced(false); }}
                                        className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/15 text-white text-xs font-bold backdrop-blur"
                                    >
                                        <RotateCcw size={14} /> Move it
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={placePiece}
                                        className="px-8 py-3 rounded-full bg-white text-stone-900 text-xs font-bold"
                                    >
                                        Place
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => sceneRef.current?.endAr()}
                                    className="px-5 py-3 rounded-full bg-white/15 text-white text-xs font-bold backdrop-blur"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {status === 'ready' && !inSession && (
                <div className="shrink-0 px-5 pb-6 pt-2 flex flex-col items-center gap-2">
                    {mode === AR_MODE.NATIVE_QUICK_LOOK || mode === AR_MODE.NATIVE_SCENE_VIEWER ? (
                        // Already auto-launched once the relay resolved
                        // (see the effect above) — this is purely the
                        // manual retry for whichever customer dismissed
                        // that and wants back in.
                        <>
                            <button
                                type="button"
                                disabled={!nativeRelayUrl}
                                onClick={() => nativeRelayUrl && launchNative(mode, nativeRelayUrl).catch((error) => {
                                    console.warn('Native AR failed:', error);
                                    setNativeRelayStatus('launch-failed');
                                })}
                                className="w-full max-w-xs py-3.5 rounded-full bg-white text-stone-900 text-xs font-bold uppercase tracking-wider hover:bg-stone-100 transition-colors disabled:bg-white/40 disabled:text-stone-900/60 disabled:cursor-wait"
                            >
                                {nativeRelayUrl ? 'View on your wall' : (nativeRelayStatus === 'error' ? "Couldn't prepare AR preview" : 'Preparing…')}
                            </button>
                            {nativeRelayStatus === 'launch-failed' && (
                                // Says nothing opened rather than leaving a
                                // tapped button looking like it worked — the
                                // failure mode this whole screen has been bitten
                                // by twice is one that shows no sign of itself.
                                <p className="text-[11px] text-amber-300/90 text-center max-w-xs">
                                    AR didn&apos;t open on this device. Tap again to retry.
                                </p>
                            )}
                        </>
                    ) : ctaLabel ? (
                        <button
                            type="button"
                            onClick={launchAr}
                            className="w-full max-w-xs py-3.5 rounded-full bg-white text-stone-900 text-xs font-bold uppercase tracking-wider hover:bg-stone-100 transition-colors"
                        >
                            {ctaLabel}
                        </button>
                    ) : (
                        <p className="text-[11px] text-stone-400 text-center max-w-xs">
                            {isMobileDevice()
                                // Genuinely on a phone/tablet already — the
                                // gap is the browser's AR support, not the
                                // device, so telling them to grab a phone
                                // would be telling them to use the one in
                                // their hand.
                                ? "Drag to look around. This browser doesn't support wall placement yet — try Chrome, or open this page on one that does."
                                : 'Drag to look around. Wall placement needs a phone or tablet — open this page on one to hang it in your room.'}
                        </p>
                    )}
                    <p className="text-[10px] text-stone-500 text-center max-w-sm">
                        Shown at true size. Moulding depth and finish follow our catalogue.
                    </p>
                </div>
            )}
        </div>
    );
}
