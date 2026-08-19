import React, { useEffect, useRef, useState } from 'react';
import { X, Loader, RotateCcw } from 'lucide-react';
import { buildArModel } from '../../utils/ar/buildArModel';
import { AR_MODE, detectArMode, openQuickLook } from '../../utils/ar/arCapabilities';

/**
 * "See it on your wall" — the AR entry point from the visualizer.
 *
 * Every device gets the orbit preview; what changes per platform is
 * what the button under it does. iOS hands the .usdz to AR Quick Look,
 * WebXR devices open a session in this same canvas, and desktop is told
 * plainly that it's a 3D preview rather than being shown a button that
 * would do nothing.
 */

const CTA_LABEL = {
    [AR_MODE.QUICK_LOOK]: 'View on your wall',
    [AR_MODE.WEBXR]: 'View on your wall',
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

    useEffect(() => {
        if (!isOpen) return undefined;

        let cancelled = false;
        let scene = null;
        setStatus('loading');
        setInSession(false);
        setHasPlaced(false);

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
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
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
                    {ctaLabel ? (
                        <button
                            type="button"
                            onClick={launchAr}
                            className="w-full max-w-xs py-3.5 rounded-full bg-white text-stone-900 text-xs font-bold uppercase tracking-wider hover:bg-stone-100 transition-colors"
                        >
                            {ctaLabel}
                        </button>
                    ) : (
                        <p className="text-[11px] text-stone-400 text-center max-w-xs">
                            Drag to look around. Wall placement needs a phone or tablet —
                            open this page on one to hang it in your room.
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
