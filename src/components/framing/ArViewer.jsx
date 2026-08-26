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

/**
 * "See it on your wall" — the AR entry point from the visualizer.
 *
 * Every device gets the orbit preview; what changes per platform is
 * what the button under it does. iOS hands the .usdz to AR Quick Look,
 * WebXR devices open a session in this same canvas, and desktop is told
 * plainly that it's a 3D preview rather than being shown a button that
 * would do nothing. The two native-app modes (see arCapabilities.js)
 * need one extra step first — relaying the model to a real URL — before
 * their button can do anything at all, which is why they get their own
 * render branch below instead of sharing the generic CTA button.
 *
 * Three of those four modes launch themselves the instant they're ready,
 * rather than waiting for a second tap on the CTA underneath — the
 * customer already asked for AR by opening this screen, so the orbit
 * preview shows only as long as the model takes to build. The CTA stays
 * mounted regardless, as the manual retry path for whichever of those
 * auto-launches the browser silently refuses (a real possibility for
 * anything gated on user-activation timing, which is browser-dependent).
 * NATIVE_QUICK_LOOK is the one exception, and can't join them: its whole
 * fix was routing through a real, directly-tapped <a> rather than a
 * script-driven click (see the anchor below) — auto-firing it would
 * mean clicking that anchor from script, undoing the fix.
 */

const CTA_LABEL = {
    [AR_MODE.QUICK_LOOK]: 'View on your wall',
    [AR_MODE.WEBXR]: 'View on your wall',
};

const RELAY_KIND_BY_MODE = {
    [AR_MODE.NATIVE_QUICK_LOOK]: 'usdz',
    [AR_MODE.NATIVE_SCENE_VIEWER]: 'glb',
};

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

                // Straight into AR the moment it's ready, for every mode
                // that can do that safely from here (see the module
                // comment for why NATIVE_QUICK_LOOK can't join them). Not
                // awaited — a rejection here just leaves the manual CTA as
                // the way in, same as if this block didn't exist.
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

                // Kicked off here, right away, rather than waiting for the
                // tap — Quick Look wants a real <a href> already sitting in
                // the DOM to activate, not one that only resolves after the
                // gesture, and Scene Viewer's launch is smoother without an
                // extra spinner-on-tap for a customer who's already waited
                // for the model to build.
                const relayKind = RELAY_KIND_BY_MODE[detected];
                if (relayKind) {
                    setNativeRelayStatus('loading');
                    const relaySrc = relayKind === 'usdz' ? built.usdzUrl : built.glbUrl;
                    relayArModel(relaySrc, relayKind)
                        .then((url) => {
                            if (cancelled) return;
                            setNativeRelayUrl(url);
                            setNativeRelayStatus('ready');
                            // Scene Viewer is a plain navigation, not a
                            // gesture-gated hand-off like Quick Look's —
                            // safe to fire as soon as the relay resolves,
                            // however long after the original tap that is.
                            if (detected === AR_MODE.NATIVE_SCENE_VIEWER) {
                                window.location.assign(createAndroidSceneViewerIntent(url));
                            }
                        })
                        .catch((error) => {
                            if (cancelled) return;
                            console.warn('AR model relay failed:', error);
                            setNativeRelayStatus('error');
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
                    {mode === AR_MODE.NATIVE_QUICK_LOOK ? (
                        nativeRelayUrl ? (
                            // A real, directly-tapped <a rel="ar"> — not a
                            // JS-created one clicked programmatically. That
                            // distinction is what made this work at all
                            // inside the app's WKWebView (confirmed against
                            // an earlier build of this same AR flow).
                            <a
                                rel="ar"
                                href={nativeRelayUrl}
                                className="w-full max-w-xs py-3.5 rounded-full bg-white text-stone-900 text-xs font-bold uppercase tracking-wider hover:bg-stone-100 transition-colors text-center"
                            >
                                {/* Required direct child for Quick Look to recognise this as an AR link. */}
                                <img alt="" className="hidden" />
                                View on your wall
                            </a>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="w-full max-w-xs py-3.5 rounded-full bg-white/40 text-stone-900/60 text-xs font-bold uppercase tracking-wider cursor-wait"
                            >
                                {nativeRelayStatus === 'error' ? "Couldn't prepare AR preview" : 'Preparing…'}
                            </button>
                        )
                    ) : mode === AR_MODE.NATIVE_SCENE_VIEWER ? (
                        <button
                            type="button"
                            disabled={!nativeRelayUrl}
                            onClick={() => {
                                if (nativeRelayUrl) window.location.assign(createAndroidSceneViewerIntent(nativeRelayUrl));
                            }}
                            className="w-full max-w-xs py-3.5 rounded-full bg-white text-stone-900 text-xs font-bold uppercase tracking-wider hover:bg-stone-100 transition-colors disabled:bg-white/40 disabled:text-stone-900/60 disabled:cursor-wait"
                        >
                            {nativeRelayUrl ? 'View on your wall' : (nativeRelayStatus === 'error' ? "Couldn't prepare AR preview" : 'Preparing…')}
                        </button>
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
