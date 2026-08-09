import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader, AlertTriangle } from 'lucide-react';
import { buildArPreviewModel } from '../../utils/arModelBuilder';

// Cross-platform "view this frame on your wall" preview, built on Google's
// <model-viewer> web component rather than hand-splitting iOS/Android
// ourselves — one element, and it picks the right mechanism per platform:
//   - iOS Safari (native or inside a Capacitor WKWebView): AR Quick Look,
//     triggered internally via a `rel="ar"` anchor over the `ios-src` USDZ.
//   - Android Chrome (native or inside a Capacitor WebView): Google Scene
//     Viewer over the `src` GLB, via an `intent://` launch.
//   - Any browser with WebXR's immersive-ar session support: an in-page AR
//     session over the same GLB, no app handoff.
//   - Everything else (desktop browsers, older mobile browsers): no AR
//     entry point exists at all, so model-viewer exposes no AR affordance
//     — model-viewer's own capability probe decides this, not a manual
//     platform sniff, which is what actually avoids ever showing a button
//     that would fail if pressed.
// `@google/model-viewer` is dynamically imported only when this modal
// actually opens — it bundles its own three.js-based renderer, too heavy
// to pay for on every visit to the customizer for a feature most sessions
// never touch.

let modelViewerLoadPromise = null;
function ensureModelViewerLoaded() {
    if (!modelViewerLoadPromise) {
        modelViewerLoadPromise = import('@google/model-viewer');
    }
    return modelViewerLoadPromise;
}

export default function ArPreviewModal({ isOpen, onClose, frame, widthIn, heightIn, matInches, matColorHex, artworkUrl }) {
    const [status, setStatus] = useState('idle'); // idle | loading | ready | error
    const [modelUrls, setModelUrls] = useState(null);
    const [arUnavailable, setArUnavailable] = useState(false);
    const modelViewerRef = useRef(null);
    const revokeRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setStatus('loading');
        setArUnavailable(false);

        Promise.all([
            ensureModelViewerLoaded(),
            buildArPreviewModel({ frame, widthIn, heightIn, matInches, matColorHex, artworkUrl }),
        ])
            .then(([, model]) => {
                if (cancelled) { model.revoke(); return; }
                revokeRef.current = model.revoke;
                setModelUrls(model);
                setStatus('ready');
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to build AR preview model:', err);
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
        // Rebuilds only when the modal transitions open — the selection at
        // the moment of opening is what gets previewed, matching how the
        // rest of the visualizer treats a modal as a snapshot of "now"
        // rather than something that live-updates behind itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen && revokeRef.current) {
            revokeRef.current();
            revokeRef.current = null;
            setModelUrls(null);
            setStatus('idle');
        }
    }, [isOpen]);

    useEffect(() => () => revokeRef.current?.(), []);

    // model-viewer fires this on every AR-availability probe result. A
    // browser that genuinely can't do AR at all (desktop Chrome without
    // WebXR, an older mobile browser) reports 'not-presenting' and never
    // fires anything else — after a short grace period with no positive
    // signal, that's the cue to show the explanatory message instead of a
    // silently-dead button.
    useEffect(() => {
        const el = modelViewerRef.current;
        if (!el || status !== 'ready') return;
        let sawFailure = false;
        const onArStatus = (e) => {
            if (e.detail?.status === 'failed') {
                sawFailure = true;
                setArUnavailable(true);
            }
        };
        el.addEventListener('ar-status', onArStatus);
        const timer = setTimeout(() => {
            if (!sawFailure && !el.canActivateAR) setArUnavailable(true);
        }, 1200);
        return () => {
            el.removeEventListener('ar-status', onArStatus);
            clearTimeout(timer);
        };
    }, [status]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[300] flex flex-col bg-black">
            <button
                onClick={onClose}
                aria-label="Close AR preview"
                className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-stone-800 shadow-md transition-colors"
            >
                <X size={20} />
            </button>

            {status === 'loading' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/90">
                    <Loader size={28} className="animate-spin" />
                    <p className="text-sm">Preparing your frame for AR…</p>
                </div>
            )}

            {status === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/90 px-8 text-center">
                    <AlertTriangle size={28} />
                    <p className="text-sm max-w-sm">Couldn't prepare the AR preview for this frame. Please try again.</p>
                </div>
            )}

            {status === 'ready' && modelUrls && (
                <>
                    {/* eslint-disable-next-line react/no-unknown-property */}
                    <model-viewer
                        ref={modelViewerRef}
                        src={modelUrls.glbUrl}
                        ios-src={modelUrls.usdzUrl}
                        ar
                        ar-modes="webxr scene-viewer quick-look"
                        ar-placement="wall"
                        ar-scale="fixed"
                        camera-controls
                        shadow-intensity="1"
                        alt="Preview of your framed piece"
                        style={{ width: '100%', height: '100%', '--poster-color': 'transparent' }}
                    >
                        <button
                            slot="ar-button"
                            className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-[#c9a84c] hover:bg-[#d4b55c] text-stone-950 font-bold text-sm shadow-lg transition-colors"
                        >
                            View on your wall
                        </button>
                    </model-viewer>

                    {arUnavailable && (
                        <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-white/95 text-stone-700 text-xs text-center max-w-[280px] shadow-md">
                            AR isn't available on this browser. Open this page on an iPhone (Safari) or Android phone (Chrome) to place it on your wall — you can still look around the 3D preview here.
                        </div>
                    )}
                </>
            )}
        </div>,
        document.body
    );
}
