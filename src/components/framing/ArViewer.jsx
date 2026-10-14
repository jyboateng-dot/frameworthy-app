import React, { useEffect, useRef, useState } from 'react';
import { X, Loader, RotateCcw } from 'lucide-react';
import { buildArModel } from '../../utils/ar/buildArModel';
import {
    AR_MODE,
    detectArMode,
    openQuickLook,
    isMobileDevice,
    createAndroidSceneViewerIntent,
    armMobileViewportRecovery,
} from '../../utils/ar/arCapabilities';
import { relayArModel } from '../../utils/ar/arModelRelay';
import { openQuickLookViaSafari } from '../../utils/ar/nativeQuickLook';

/**
 * The AR entry point from the visualizer.
 *
 * Two shapes, decided by whether this device's AR lives somewhere else:
 *
 *   hand-off    iOS and Android both end up in a viewer that isn't this
 *               page — Quick Look, or the Scene Viewer app. There is
 *               nothing for a customer to do in here while that is being
 *               prepared, so they get a bare "opening" overlay that
 *               dismisses itself the moment the hand-off lands, and they
 *               come back from AR to the customizer they left. No preview,
 *               no button, no screen to read.
 *
 *   in-page     WebXR runs the session on this component's own canvas, and
 *               desktop has no AR at all, so both genuinely need the orbit
 *               preview — for WebXR it *is* the AR surface, and on desktop
 *               it's the whole feature.
 *
 * The hand-off path deliberately never imports arScene: three.js is ~600KB
 * that would only ever render a preview covered a moment later by the AR
 * viewer, delaying the thing the customer actually asked for.
 *
 * Why the hand-off exists at all: WKWebView, which the native app runs in,
 * won't give a tapped rel="ar" link to Quick Look the way Safari does — it
 * renders its own inline model preview with AR buried inside, the "view 3D
 * object, then tap AR" detour reported from the app. So the model is
 * relayed to a real HTTPS URL (arModelRelay.js — neither viewer can read a
 * blob: URL belonging to this page) and handed to Safari or Scene Viewer.
 */

// Modes whose AR happens outside this page, and which therefore have no use
// for the preview screen.
const HANDOFF_MODES = new Set([
    AR_MODE.QUICK_LOOK,
    AR_MODE.NATIVE_QUICK_LOOK,
    AR_MODE.NATIVE_SCENE_VIEWER,
]);

const RELAY_KIND_BY_MODE = {
    [AR_MODE.NATIVE_QUICK_LOOK]: 'usdz',
    [AR_MODE.NATIVE_SCENE_VIEWER]: 'glb',
};

const VIEWER_BACKGROUND = '#777777';

// Both get the model in front of something that isn't this WebView — Safari
// for Quick Look, the Scene Viewer app for Android — because the WebView is
// precisely what can't hand off to AR.
const NATIVE_LAUNCH = {
    [AR_MODE.NATIVE_QUICK_LOOK]: (url) => openQuickLookViaSafari(url),
    [AR_MODE.NATIVE_SCENE_VIEWER]: (url) => window.location.assign(createAndroidSceneViewerIntent(url)),
};

// A hang detector, not a deadline. Capacitor answers a call it can't route
// by returning *without* settling the promise, so a bridge-side fault
// presents as nothing happening at all — no error, nothing to catch, which
// is exactly how a broken build of this reached TestFlight. Scene Viewer's
// navigation settles at once and Safari's sheet resolves when presented, so
// anything past this bound is a fault worth surfacing rather than waiting on.
const NATIVE_LAUNCH_TIMEOUT_MS = 20_000;

function launchNative(mode, url) {
    return Promise.race([
        Promise.resolve(NATIVE_LAUNCH[mode]?.(url)),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`AR launch (${mode}) never responded`)), NATIVE_LAUNCH_TIMEOUT_MS);
        }),
    ]);
}

export default function ArViewer({
    isOpen,
    onClose,
    frame,
    widthIn,
    heightIn,
    matReveal,
    matColorHex,
    glassType,
    artworkUrl,
    hardwareType,
    canvasWrap,
}) {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const sceneRef = useRef(null);
    const restoreViewportRef = useRef(null);

    // Read inside the effect without being a dependency of it — the parent
    // rebuilds this closure every render, so depending on it would restart
    // the whole build/launch on any unrelated re-render.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const [mode, setMode] = useState(null);
    const [status, setStatus] = useState('loading');
    const [model, setModel] = useState(null);
    const [inSession, setInSession] = useState(false);
    const [hasPlaced, setHasPlaced] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!isOpen) return undefined;

        let cancelled = false;
        let scene = null;
        let nativeHandoffStarted = false;
        setStatus('loading');
        setInSession(false);
        setHasPlaced(false);

        (async () => {
            try {
                // Resolved before the model is built, unlike the two running
                // together: which chrome to show depends on it, and detection
                // is a user-agent read (or one quick WebXR probe) against a
                // build that takes far longer. Knowing first means the
                // hand-off overlay is what shows from the outset, rather than
                // a preview screen that flashes up and is then replaced.
                const detected = await detectArMode();
                if (cancelled) return;
                setMode(detected);

                if (detected !== AR_MODE.VIEWER_ONLY) {
                    restoreViewportRef.current = armMobileViewportRecovery();
                }

                const built = await buildArModel({
                    frame,
                    widthIn,
                    heightIn,
                    matReveal: matReveal || { topIn: 0, sideIn: 0, bottomIn: 0 },
                    matColorHex,
                    glassType,
                    artworkUrl,
                    hardwareType,
                    canvasWrap,
                });
                if (cancelled) return;
                setModel(built);

                if (HANDOFF_MODES.has(detected)) {
                    nativeHandoffStarted = true;
                    const relayKind = RELAY_KIND_BY_MODE[detected];
                    if (relayKind) {
                        const relaySrc = relayKind === 'usdz' ? built.usdzUrl : built.glbUrl;
                        const url = await relayArModel(relaySrc, relayKind);
                        if (cancelled) return;
                        await launchNative(detected, url);
                    } else {
                        // Mobile Safari, straight off the blob — no relay,
                        // and no promise either, since this is an anchor
                        // activation rather than a call that reports back.
                        openQuickLook(built.usdzUrl);
                    }
                    if (cancelled) return;
                    // AR owns the screen now. Dismissing means backing out of
                    // it returns to the customizer rather than to a stale
                    // "opening" overlay with nothing left to do.
                    onCloseRef.current();
                    return;
                }

                // Imported here rather than at module scope so three.js and
                // its loaders stay out of the main bundle — and skipped
                // entirely above, since a hand-off never shows this canvas.
                const { ArScene } = await import('../../utils/ar/arScene');
                if (cancelled || !canvasRef.current) return;

                scene = new ArScene(canvasRef.current);
                sceneRef.current = scene;
                scene.onSessionEnd = () => {
                    restoreViewportRef.current?.();
                    restoreViewportRef.current = null;
                    setInSession(false);
                    setHasPlaced(false);
                    scene.startPreview();
                };

                await scene.loadModel(built.glbUrl);
                if (cancelled) return;

                scene.startPreview();
                setStatus('ready');

                if (detected === AR_MODE.WEBXR) {
                    setInSession(true);
                    scene.startAr(overlayRef.current).catch((error) => {
                        if (cancelled) return;
                        console.warn('AR session refused:', error);
                        setInSession(false);
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    restoreViewportRef.current?.();
                    restoreViewportRef.current = null;
                    console.warn('AR failed:', error);
                    setStatus('error');
                }
            }
        })();

        return () => {
            cancelled = true;
            scene?.dispose();
            sceneRef.current = null;
            if (!nativeHandoffStarted) {
                restoreViewportRef.current?.();
                restoreViewportRef.current = null;
            }
        };
    // matReveal's three numbers, not the object itself — the parent
    // recomputes a fresh matReveal object every render, so depending on
    // its reference would rebuild the AR model (an image decode + canvas
    // work) on every unrelated re-render while this stays open.
    }, [isOpen, attempt, frame, widthIn, heightIn, matReveal?.topIn, matReveal?.sideIn, matReveal?.bottomIn, matColorHex, glassType, artworkUrl, hardwareType, canvasWrap]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape' && !inSession) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, inSession, onClose]);

    if (!isOpen) return null;

    const placePiece = () => {
        if (sceneRef.current?.place()) setHasPlaced(true);
    };
    const isViewerOnly = mode === AR_MODE.VIEWER_ONLY;

    // Until detection resolves, assume hand-off: it's the common case on the
    // devices that can actually do AR, and guessing the preview screen would
    // mean flashing up the exact screen this is meant to skip.
    if (mode === null || HANDOFF_MODES.has(mode)) {
        return (
            <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col items-center justify-center gap-5 px-8">
                {status === 'error' ? (
                    <>
                        <p className="text-center text-xs text-stone-300 max-w-xs">
                            AR couldn&apos;t be opened. Your frame settings are unaffected.
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setAttempt((n) => n + 1)}
                                className="px-6 py-3 rounded-full bg-white text-stone-900 text-xs font-bold uppercase tracking-wider"
                            >
                                Try again
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 rounded-full bg-white/15 text-white text-xs font-bold uppercase tracking-wider"
                            >
                                Close
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <Loader size={24} className="animate-spin text-stone-300" />
                        <p className="text-xs text-stone-300">Opening AR…</p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[11px] text-stone-500 underline underline-offset-4"
                        >
                            Cancel
                        </button>
                    </>
                )}
            </div>
        );
    }

    return (
        <div
            className={`fixed inset-0 z-[100] ${isViewerOnly ? '' : 'bg-stone-950/95 backdrop-blur-sm'} flex flex-col`}
            style={isViewerOnly ? { backgroundColor: VIEWER_BACKGROUND } : undefined}
        >
            <div className="flex items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] shrink-0">
                <div className={isViewerOnly ? 'text-stone-950' : 'text-white'}>
                    <p className="text-base font-bold">{isViewerOnly ? '3D Frame Preview' : 'See it on your wall'}</p>
                    {model && (
                        <p className={isViewerOnly ? 'text-xs font-semibold text-stone-800' : 'text-[11px] text-stone-400'}>
                            {(model.outerWidthM * 100).toFixed(0)} × {(model.outerHeightM * 100).toFixed(0)} cm
                            {!model.isMeasured && ' · approximate depth'}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className={`w-9 h-9 rounded-full ${isViewerOnly ? 'bg-black/10 hover:bg-black/20 text-stone-900' : 'bg-white/10 hover:bg-white/20 text-white'} flex items-center justify-center transition-colors`}
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
                    {/* Android renders the WebXR DOM overlay behind the gesture
                        navigation bar, so a flat p-5 put these controls right on the
                        swipe-up strip. The bottom padding grows past the inset when
                        the OS reports one. */}
                    {inSession && (
                        <div className="p-5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] flex flex-col items-center gap-3 pointer-events-auto">
                            <p className="text-xs text-white/90 bg-black/50 rounded-full px-4 py-2">
                                {hasPlaced ? 'Looks good?' : 'Hold and drag onto your wall to view the frame in your room'}
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
                    {mode === AR_MODE.WEBXR ? (
                        <button
                            type="button"
                            onClick={async () => {
                                if (!sceneRef.current) return;
                                try {
                                    setInSession(true);
                                    await sceneRef.current.startAr(overlayRef.current);
                                } catch (error) {
                                    console.warn('AR session refused:', error);
                                    setInSession(false);
                                }
                            }}
                            className="w-full max-w-xs py-3.5 rounded-full bg-white text-stone-900 text-xs font-bold uppercase tracking-wider hover:bg-stone-100 transition-colors"
                        >
                            View on your wall
                        </button>
                    ) : (
                    <p className={isViewerOnly ? 'text-xs font-semibold text-stone-950 text-center max-w-xs' : 'text-[11px] text-stone-400 text-center max-w-xs'}>
                            {isMobileDevice()
                                // Genuinely on a phone/tablet already — the
                                // gap is the browser's AR support, not the
                                // device, so telling them to grab a phone
                                // would be telling them to use the one in
                                // their hand.
                                ? "Select and drag to move the frame around, or pinch to zoom in and out. This browser doesn't support wall placement yet — try Chrome, or open this page on one that does."
                                : 'Select and drag to move the frame around, or pinch to zoom in and out.'}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
