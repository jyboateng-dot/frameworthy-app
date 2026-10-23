import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, RotateCcw, ZoomIn, ZoomOut, Sliders, ShieldCheck, AlertTriangle, AlertCircle, Sparkles, Grid3X3, Eye } from 'lucide-react';
import { imageCrop, maxZoomForMinDpi, DEFAULT_POSITION, MIN_CROP_DPI } from '../../utils/frameFit';

/**
 * Concept 2: Dedicated Focus Crop Studio Modal
 *
 * Full-screen precision composition studio. Shows the entire uncropped image
 * with an illuminated aperture cutout, rule-of-thirds grid, corner resize handles,
 * live print resolution DPI gauge, and composition presets.
 */
export default function CropStudioModal({
    isOpen,
    onClose,
    onApply,
    image,
    natural,
    geometry,
    initialPosition = DEFAULT_POSITION,
    frameTitle = 'Custom Frame',
    sizeLabel = '',
    minimumDpi = MIN_CROP_DPI
}) {
    const [draftPosition, setDraftPosition] = useState(initialPosition);
    const [showGrid, setShowGrid] = useState(true);
    const [activeDrag, setActiveDrag] = useState(null); // 'pan' | 'handle-se' | 'handle-sw' | 'handle-ne' | 'handle-nw'
    const imageContainerRef = useRef(null);
    const dragStartRef = useRef({ clientX: 0, clientY: 0, startPos: { ...initialPosition } });

    // Sync draft position whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setDraftPosition(initialPosition || DEFAULT_POSITION);
            setActiveDrag(null);
        }
    }, [isOpen, initialPosition]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (!isOpen) return;
        const origOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = origOverflow;
        };
    }, [isOpen]);

    if (!isOpen || !natural?.w || !natural?.h || !geometry) {
        return null;
    }

    const maxZoom = maxZoomForMinDpi(natural, geometry, minimumDpi);
    const crop = imageCrop(natural, geometry, draftPosition, minimumDpi);

    if (!crop) return null;

    // Percentages of crop relative to the natural image
    const cropPct = {
        left: (crop.x / natural.w) * 100,
        top: (crop.y / natural.h) * 100,
        width: (crop.w / natural.w) * 100,
        height: (crop.h / natural.h) * 100,
    };

    // Effective print DPI
    const effectiveDpi = geometry.apertureWidth > 0
        ? Math.round(crop.w / geometry.apertureWidth)
        : 300;

    const retainedPct = Math.round((crop.retained || 1) * 100);

    // DPI Quality level
    let dpiLevel = {
        badge: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/40',
        bar: 'bg-emerald-500',
        text: 'Ultra-Sharp Museum Grade (300+ DPI)',
        icon: ShieldCheck
    };
    if (effectiveDpi < MIN_CROP_DPI) {
        dpiLevel = {
            badge: 'text-rose-400 bg-rose-950/80 border-rose-500/40',
            bar: 'bg-rose-500',
            text: `Below ${MIN_CROP_DPI} DPI production minimum!`,
            icon: AlertCircle
        };
    } else if (effectiveDpi < 200) {
        dpiLevel = {
            badge: 'text-amber-400 bg-amber-950/80 border-amber-500/40',
            bar: 'bg-amber-500',
            text: 'Good (Meets production floor)',
            icon: AlertTriangle
        };
    } else if (effectiveDpi < 300) {
        dpiLevel = {
            badge: 'text-teal-400 bg-teal-950/80 border-teal-500/40',
            bar: 'bg-teal-500',
            text: 'Very High Quality (200-299 DPI)',
            icon: ShieldCheck
        };
    }

    const DpiIcon = dpiLevel.icon;

    // Drag handlers
    const startPan = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}

        setActiveDrag('pan');
        dragStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            startPos: { ...draftPosition }
        };
    };

    const startCornerResize = (e, handleId) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}

        setActiveDrag(handleId);
        dragStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            startPos: { ...draftPosition }
        };
    };

    const handlePointerMove = (e) => {
        if (!activeDrag || !imageContainerRef.current) return;

        const rect = imageContainerRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragStartRef.current.clientX;
        const deltaY = e.clientY - dragStartRef.current.clientY;

        if (activeDrag === 'pan') {
            // Panning the crop box across the uncropped image
            // In imageContainer coordinate space:
            const overflowXImage = natural.w - crop.w;
            const overflowYImage = natural.h - crop.h;

            const nextPos = { ...dragStartRef.current.startPos };

            if (overflowXImage > 0 && rect.width > 0) {
                // Moving aperture box right (deltaX > 0) means increasing crop.x (pos.x)
                const deltaNormX = (deltaX / rect.width) * (natural.w / overflowXImage);
                nextPos.x = Math.max(0, Math.min(1, dragStartRef.current.startPos.x + deltaNormX));
            }

            if (overflowYImage > 0 && rect.height > 0) {
                // Moving aperture box down (deltaY > 0) means increasing crop.y (pos.y)
                const deltaNormY = (deltaY / rect.height) * (natural.h / overflowYImage);
                nextPos.y = Math.max(0, Math.min(1, dragStartRef.current.startPos.y + deltaNormY));
            }

            setDraftPosition(nextPos);
        } else if (activeDrag.startsWith('handle-')) {
            // Resizing corner handle changes zoom
            const isExpanding = activeDrag.includes('e') ? deltaX < 0 : deltaX > 0;
            const distance = Math.hypot(deltaX, deltaY);
            const zoomDelta = (isExpanding ? 1 : -1) * (distance / (rect.width || 300)) * 1.5;

            const newZoom = Math.max(1, Math.min(maxZoom, Math.round((dragStartRef.current.startPos.zoom + zoomDelta) * 100) / 100));
            setDraftPosition(prev => ({
                ...prev,
                zoom: newZoom
            }));
        }
    };

    const handlePointerUp = (e) => {
        if (!activeDrag) return;
        setActiveDrag(null);
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {}
    };

    // Quick Presets
    const applyPreset = (preset) => {
        switch (preset) {
            case 'center':
                setDraftPosition({ x: 0.5, y: 0.5, zoom: 1 });
                break;
            case 'headroom':
                setDraftPosition({ x: 0.5, y: 0.22, zoom: 1.15 });
                break;
            case 'horizon':
                setDraftPosition({ x: 0.5, y: 0.78, zoom: 1.15 });
                break;
            case 'rule-left':
                setDraftPosition({ x: 0.28, y: 0.5, zoom: 1.2 });
                break;
            case 'rule-right':
                setDraftPosition({ x: 0.72, y: 0.5, zoom: 1.2 });
                break;
            default:
                setDraftPosition(DEFAULT_POSITION);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex flex-col bg-stone-950/95 backdrop-blur-xl text-stone-100 select-none animate-fadeIn"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            {/* Top Navigation Bar */}
            <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-stone-800 bg-stone-900/60 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                        <Sliders size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                            Precision Framing Studio
                        </h2>
                        <p className="text-xs text-stone-400">
                            {frameTitle} {sizeLabel && `· ${sizeLabel}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setDraftPosition(DEFAULT_POSITION)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
                        title="Reset to default centered crop"
                    >
                        <RotateCcw size={13} />
                        <span className="hidden sm:inline">Reset</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                        title="Close without saving"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
            </header>

            {/* Main Interactive Studio Canvas */}
            <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden min-h-0">
                {/* The Full Uncropped Image Viewport */}
                <div
                    ref={imageContainerRef}
                    style={{
                        aspectRatio: `${natural.w} / ${natural.h}`,
                        maxHeight: '100%',
                        maxWidth: '100%',
                    }}
                    className="relative shadow-2xl border border-stone-800 rounded-sm overflow-hidden"
                >
                    {/* Full source image */}
                    <img
                        src={image}
                        alt="Full uncropped photo"
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none select-none opacity-40 brightness-75"
                    />

                    {/* Dark scrim cut-out overlay */}
                    {/* Illuminated Aperture Box */}
                    <div
                        onPointerDown={startPan}
                        style={{
                            left: `${cropPct.left}%`,
                            top: `${cropPct.top}%`,
                            width: `${cropPct.width}%`,
                            height: `${cropPct.height}%`,
                        }}
                        className={`absolute z-20 cursor-move border-2 border-amber-400/90 shadow-[0_0_0_9999px_rgba(10,10,10,0.72),0_0_20px_rgba(0,0,0,0.8)] ${
                            activeDrag === 'pan' ? 'ring-2 ring-amber-300 shadow-amber-500/20' : 'hover:border-amber-300'
                        }`}
                        title="Drag inside to pan · Drag corner handles to zoom"
                    >
                        {/* 100% Illuminated Crop Image Content */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <img
                                src={image}
                                alt="Cropped preview"
                                draggable={false}
                                style={{
                                    position: 'absolute',
                                    maxWidth: 'none',
                                    width: `${(natural.w / crop.w) * 100}%`,
                                    height: `${(natural.h / crop.h) * 100}%`,
                                    left: `${(-crop.x / crop.w) * 100}%`,
                                    top: `${(-crop.y / crop.h) * 100}%`,
                                }}
                                className="select-none brightness-105"
                            />
                        </div>

                        {/* Rule of Thirds Inside Illuminated Box */}
                        {showGrid && (
                            <div className="absolute inset-0 pointer-events-none z-10">
                                <div className="absolute top-0 bottom-0 left-1/3 w-px border-l border-dashed border-white/60 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                                <div className="absolute top-0 bottom-0 left-2/3 w-px border-l border-dashed border-white/60 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                                <div className="absolute left-0 right-0 top-1/3 h-px border-t border-dashed border-white/60 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                                <div className="absolute left-0 right-0 top-2/3 h-px border-t border-dashed border-white/60 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />

                                {/* 4 Golden Ratio Crosshair Rings */}
                                <div className="absolute left-1/3 top-1/3 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-amber-300 bg-amber-400/40" />
                                <div className="absolute left-2/3 top-1/3 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-amber-300 bg-amber-400/40" />
                                <div className="absolute left-1/3 top-2/3 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-amber-300 bg-amber-400/40" />
                                <div className="absolute left-2/3 top-2/3 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-amber-300 bg-amber-400/40" />
                            </div>
                        )}

                        {/* 4 Corner Resize Handles */}
                        <div
                            onPointerDown={(e) => startCornerResize(e, 'handle-nw')}
                            className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-white border-2 border-amber-500 shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                            title="Drag corner to zoom"
                        />
                        <div
                            onPointerDown={(e) => startCornerResize(e, 'handle-ne')}
                            className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white border-2 border-amber-500 shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                            title="Drag corner to zoom"
                        />
                        <div
                            onPointerDown={(e) => startCornerResize(e, 'handle-sw')}
                            className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-white border-2 border-amber-500 shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                            title="Drag corner to zoom"
                        />
                        <div
                            onPointerDown={(e) => startCornerResize(e, 'handle-se')}
                            className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-white border-2 border-amber-500 shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                            title="Drag corner to zoom"
                        />
                    </div>
                </div>

                {/* Floating Instruction Tag */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-stone-900/80 backdrop-blur-md border border-stone-700/80 text-stone-300 text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Aperture Cutout shows the exact print crop · Drag to recompose</span>
                </div>
            </div>

            {/* Bottom Tool Deck & Preset Toolbar */}
            <footer className="border-t border-stone-800 bg-stone-900/90 px-4 sm:px-8 py-3.5 shrink-0 flex flex-col gap-3">
                {/* Upper Deck: Composition Presets & DPI Gauge */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Quick Composition Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-stone-400 font-semibold mr-1 flex items-center gap-1">
                            <Sparkles size={12} className="text-amber-400" />
                            Focal Presets:
                        </span>
                        <button
                            type="button"
                            onClick={() => applyPreset('center')}
                            className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 hover:border-stone-500 transition-colors"
                        >
                            Balanced Center
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('headroom')}
                            className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 hover:border-stone-500 transition-colors"
                        >
                            Portrait Headroom
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('horizon')}
                            className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 hover:border-stone-500 transition-colors"
                        >
                            Landscape Horizon
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('rule-left')}
                            className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 hover:border-stone-500 transition-colors"
                        >
                            Golden Left
                        </button>
                        <button
                            type="button"
                            onClick={() => applyPreset('rule-right')}
                            className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 hover:border-stone-500 transition-colors"
                        >
                            Golden Right
                        </button>
                    </div>

                    {/* Live DPI Telemetry Pill */}
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${dpiLevel.badge}`}>
                        <DpiIcon size={14} className="shrink-0" />
                        <span>{effectiveDpi} DPI</span>
                        <span className="opacity-40">·</span>
                        <span>{retainedPct}% Retained</span>
                    </div>
                </div>

                {/* Lower Deck: Zoom Bar & Final Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    {/* Zoom Slider and Grid Toggle */}
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-stone-400 font-medium">Zoom:</span>
                            <button
                                type="button"
                                onClick={() => setDraftPosition(p => ({ ...p, zoom: Math.max(1, (p.zoom || 1) - 0.1) }))}
                                disabled={(draftPosition?.zoom ?? 1) <= 1}
                                className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300 disabled:opacity-40"
                            >
                                <ZoomOut size={12} />
                            </button>
                            <input
                                type="range"
                                min={1}
                                max={maxZoom}
                                step={0.01}
                                value={draftPosition?.zoom ?? 1}
                                onChange={(e) => setDraftPosition(p => ({ ...p, zoom: parseFloat(e.target.value) }))}
                                className="w-24 sm:w-32 accent-amber-400"
                            />
                            <button
                                type="button"
                                onClick={() => setDraftPosition(p => ({ ...p, zoom: Math.min(maxZoom, (p.zoom || 1) + 0.1) }))}
                                disabled={(draftPosition?.zoom ?? 1) >= maxZoom}
                                className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300 disabled:opacity-40"
                            >
                                <ZoomIn size={12} />
                            </button>
                            <span className="font-mono text-stone-300 text-[11px] min-w-[34px]">
                                {Math.round((draftPosition?.zoom ?? 1) * 100)}%
                            </span>
                        </div>

                        {/* Grid Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowGrid(!showGrid)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                                showGrid ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' : 'bg-stone-800 text-stone-400 border border-stone-700'
                            }`}
                        >
                            <Grid3X3 size={13} />
                            <span>Guides</span>
                        </button>
                    </div>

                    {/* Commit & Cancel Actions */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onApply(draftPosition);
                                onClose();
                            }}
                            className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 flex items-center gap-1.5 transition-all"
                        >
                            <Check size={14} className="stroke-[3]" />
                            <span>Apply Composition</span>
                        </button>
                    </div>
                </div>
            </footer>
        </div>,
        document.body
    );
}
