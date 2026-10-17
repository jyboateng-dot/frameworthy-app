import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';
import { getThumbnailUrl } from '../../services/storage';

const AR_PHASES = [
    { label: 'Crafting precision solid wood moulding…', progress: 28 },
    { label: 'Fitting archival mount & museum glass…', progress: 62 },
    { label: 'Calibrating true 1:1 spatial wall scale…', progress: 88 },
    { label: 'Connecting to camera & spatial tracking…', progress: 98 },
];

const VIEWER_PHASES = [
    { label: 'Crafting precision solid wood moulding…', progress: 28 },
    { label: 'Fitting archival mount & museum glass…', progress: 62 },
    { label: 'Generating high-definition 3D geometry…', progress: 88 },
    { label: 'Calibrating 3D studio lighting…', progress: 98 },
];

/**
 * Meta-inspired AR Loading & Spatial Onboarding Screen.
 *
 * Implements Meta's 4 core AR try-on UX principles:
 * 1. Visual Continuity: Live 1:1 proportional frame miniature with user's artwork
 * 2. Progressive Stage Feedback: Dynamic craft stages instead of a generic spinner
 * 3. Spatial Coaching: Reticle, wall-distance guidance, and lighting tips
 * 4. Privacy Reassurance: Explicit camera privacy trust disclosure
 */
export default function ArLoadingScreen({
    onClose,
    frame,
    widthIn,
    heightIn,
    matReveal,
    matColorHex = '#ffffff',
    artworkUrl,
    status = 'loading',
    onRetry,
    isViewerOnly = false,
}) {
    const phases = isViewerOnly ? VIEWER_PHASES : AR_PHASES;
    const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
    const [animatedProgress, setAnimatedProgress] = useState(15);

    // Escape key listener for immediate dismissal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Progressive stage advancement
    useEffect(() => {
        if (status !== 'loading') return;

        const interval = setInterval(() => {
            setCurrentPhaseIndex((prev) => {
                if (prev < phases.length - 1) return prev + 1;
                return prev;
            });
        }, 600);

        return () => clearInterval(interval);
    }, [status, phases.length]);

    useEffect(() => {
        if (status !== 'loading') return;
        const targetProgress = phases[currentPhaseIndex]?.progress || 95;
        const timeout = setTimeout(() => {
            setAnimatedProgress(targetProgress);
        }, 50);
        return () => clearTimeout(timeout);
    }, [currentPhaseIndex, status, phases]);

    // Dimensions calculation
    const railIn = frame?.railWidthIn || 0.8;
    const outerWidthIn = (widthIn || 12) + 2 * railIn;
    const outerHeightIn = (heightIn || 16) + 2 * railIn;
    const outerWidthCm = Math.round(outerWidthIn * 2.54);
    const outerHeightCm = Math.round(outerHeightIn * 2.54);

    const frameColor = frame?.color || '#2d241e';
    const frameName = frame?.name || frame?.label || 'Custom Solid Wood Frame';
    const hasMount = matReveal && (matReveal.sideIn > 0 || matReveal.topIn > 0);

    // Frame aspect ratio for realistic miniature
    const aspectRatio = outerWidthIn / outerHeightIn;

    return (
        <div className="fixed inset-0 z-[100] bg-stone-950/95 backdrop-blur-xl flex flex-col justify-between text-stone-100 overflow-hidden select-none">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between px-6 py-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] shrink-0 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-widest uppercase bg-[#c9a84c]/15 text-[#e6ca65] border border-[#c9a84c]/30 shadow-[0_0_12px_rgba(201,168,76,0.15)]">
                        <Sparkles size={11} className="text-[#e6ca65]" /> {isViewerOnly ? '3D Studio Preview' : '1:1 Scale AR'}
                    </span>
                    <span className="text-xs text-stone-400 font-light hidden sm:inline">
                        {isViewerOnly ? 'Interactive 3D model' : 'Preview in your room'}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-stone-300 hover:text-white transition-all text-xs font-medium"
                    aria-label={isViewerOnly ? 'Close 3D preview' : 'Cancel AR preview'}
                >
                    <span>Cancel</span>
                    <X size={15} className="group-hover:rotate-90 transition-transform duration-200" />
                </button>
            </div>

            {/* Error View */}
            {status === 'error' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center gap-6">
                    <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.15)]">
                        <AlertCircle size={28} />
                    </div>
                    <div>
                        <h2 className="font-serif text-2xl font-light text-white mb-2">
                            {isViewerOnly ? '3D Preview Unavailable' : 'Spatial Preview Unavailable'}
                        </h2>
                        <p className="text-xs text-stone-400 leading-relaxed">
                            {isViewerOnly
                                ? "We couldn't generate the 3D model for this frame. Your custom frame configuration and artwork are unaffected."
                                : "We couldn't connect to the AR camera viewer. Your custom frame configuration and artwork are safe."}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-900 text-xs font-semibold uppercase tracking-wider transition-all shadow-md"
                            >
                                <RotateCcw size={13} /> Try Again
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold uppercase tracking-wider transition-all border border-white/10"
                        >
                            Return to Customizer
                        </button>
                    </div>
                </div>
            ) : (
                /* Active Meta-Style AR Loading & Onboarding View */
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 max-w-lg mx-auto w-full gap-8">
                    {/* Hero Spatial Reticle Container */}
                    <div className="relative w-full aspect-[4/3] max-w-[340px] flex items-center justify-center">
                        {/* Spatial Radar Corner Brackets */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#c9a84c]/80 rounded-tl-sm animate-pulse" />
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#c9a84c]/80 rounded-tr-sm animate-pulse" />
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#c9a84c]/80 rounded-bl-sm animate-pulse" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#c9a84c]/80 rounded-br-sm animate-pulse" />
                        </div>

                        {/* Subtle Background Spatial Grid */}
                        <div 
                            className="absolute inset-2 rounded-lg opacity-15 pointer-events-none"
                            style={{
                                backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)',
                                backgroundSize: '24px 24px',
                            }}
                        />

                        {/* Scanning Laser Beam */}
                        <div className="absolute inset-x-4 top-0 h-24 bg-gradient-to-b from-[#c9a84c]/0 via-[#c9a84c]/15 to-transparent pointer-events-none ar-scan-beam" />

                        {/* Visual Continuity: The Framed Artwork Miniature */}
                        <div 
                            className="relative shadow-2xl transition-transform duration-700 ease-out flex items-center justify-center max-w-[220px] max-h-[220px]"
                            style={{
                                aspectRatio: `${aspectRatio}`,
                                padding: '8px',
                                backgroundColor: frameColor,
                                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), 0 0 20px rgba(201,168,76,0.15)',
                            }}
                        >
                            {/* Mount Board Layer */}
                            <div 
                                className="w-full h-full flex items-center justify-center overflow-hidden"
                                style={{
                                    backgroundColor: hasMount ? matColorHex : 'transparent',
                                    padding: hasMount ? '10px' : '0px',
                                }}
                            >
                                {/* Artwork Print */}
                                <div className="w-full h-full overflow-hidden bg-stone-900 shadow-inner flex items-center justify-center">
                                    {artworkUrl ? (
                                        <img
                                            src={getThumbnailUrl(artworkUrl, 400)}
                                            alt={frameName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-stone-800 flex items-center justify-center text-[10px] text-stone-500 font-serif">
                                            Art
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Floating Dimension Badge */}
                        <div className="absolute -bottom-3 px-3.5 py-1 rounded-full bg-stone-900/90 border border-white/10 text-[11px] font-medium text-stone-200 tracking-wide backdrop-blur-md shadow-lg flex items-center gap-1.5">
                            <span className="font-semibold text-white">{outerWidthCm} × {outerHeightCm} cm</span>
                            <span className="text-stone-500">·</span>
                            <span className="text-stone-400 font-light truncate max-w-[140px]">{frameName}</span>
                        </div>
                    </div>

                    {/* Progress Pipeline & Phase Feedback */}
                    <div className="w-full flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs font-light">
                            <p key={currentPhaseIndex} className="text-stone-300 font-medium tracking-tight animate-fade-in">
                                {phases[currentPhaseIndex]?.label}
                            </p>
                            <span className="text-[11px] font-mono text-[#e6ca65]">
                                {animatedProgress}%
                            </span>
                        </div>

                        {/* Shimmering Progress Track */}
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                            <div
                                className="h-full bg-gradient-to-r from-[#b38e36] via-[#e6ca65] to-[#c9a84c] rounded-full transition-all duration-500 ease-out relative"
                                style={{ width: `${animatedProgress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/30 ar-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                            </div>
                        </div>
                    </div>

                    {/* Spatial / 3D Coaching Cards */}
                    <div className="w-full grid grid-cols-3 gap-2.5 pt-1">
                        {!isViewerOnly ? (
                            <>
                                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm gap-1.5">
                                    <span className="text-base">📱</span>
                                    <span className="text-[10px] font-semibold text-stone-200 uppercase tracking-wider">Point Camera</span>
                                    <span className="text-[9px] text-stone-400 leading-tight">Aim toward clear vertical wall</span>
                                </div>

                                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm gap-1.5">
                                    <span className="text-base">📏</span>
                                    <span className="text-[10px] font-semibold text-stone-200 uppercase tracking-wider">Step Back</span>
                                    <span className="text-[9px] text-stone-400 leading-tight">Stand 1.5 to 2.5 metres away</span>
                                </div>

                                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm gap-1.5">
                                    <span className="text-base">💡</span>
                                    <span className="text-[10px] font-semibold text-stone-200 uppercase tracking-wider">Good Light</span>
                                    <span className="text-[9px] text-stone-400 leading-tight">Ensure wall is well-illuminated</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm gap-1.5">
                                    <span className="text-base">🖱️</span>
                                    <span className="text-[10px] font-semibold text-stone-200 uppercase tracking-wider">360° Orbit</span>
                                    <span className="text-[9px] text-stone-400 leading-tight">Click and drag to rotate frame</span>
                                </div>

                                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm gap-1.5">
                                    <span className="text-base">🔍</span>
                                    <span className="text-[10px] font-semibold text-stone-200 uppercase tracking-wider">Pinch & Zoom</span>
                                    <span className="text-[9px] text-stone-400 leading-tight">Scroll or pinch to view details</span>
                                </div>

                                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-sm gap-1.5">
                                    <span className="text-base">✨</span>
                                    <span className="text-[10px] font-semibold text-stone-200 uppercase tracking-wider">True Finish</span>
                                    <span className="text-[9px] text-stone-400 leading-tight">Realistic solid wood & glazing</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Privacy & Trust Footer (Meta Reassurance Standard) */}
            <div className="px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shrink-0 flex items-center justify-center gap-2 border-t border-white/5 text-stone-500 text-[10px]">
                {!isViewerOnly ? (
                    <>
                        <ShieldCheck size={14} className="text-[#c9a84c]/80 shrink-0" />
                        <span>Camera feed is used exclusively for live spatial placement. No photos or video are recorded.</span>
                    </>
                ) : (
                    <>
                        <Sparkles size={13} className="text-[#c9a84c]/80 shrink-0" />
                        <span>Interactive 3D model with true wood profiles and archival mount proportions.</span>
                    </>
                )}
            </div>
        </div>
    );
}
