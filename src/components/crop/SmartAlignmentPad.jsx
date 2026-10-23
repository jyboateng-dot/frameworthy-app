import React, { useRef, useState } from 'react';
import {
    Compass,
    RotateCcw,
    ZoomIn,
    ZoomOut,
    Sparkles,
    ShieldCheck,
    AlertTriangle,
    AlertCircle,
    Crosshair
} from 'lucide-react';
import {
    imageCrop,
    maxZoomForMinDpi,
    DEFAULT_POSITION,
    MIN_CROP_DPI
} from '../../utils/frameFit';

const COMPASS_POINTS = [
    { id: 'top-left', label: 'Top Left', icon: '↖', x: 0, y: 0 },
    { id: 'top-center', label: 'Top Center', icon: '↑', x: 0.5, y: 0 },
    { id: 'top-right', label: 'Top Right', icon: '↗', x: 1, y: 0 },
    { id: 'mid-left', label: 'Mid Left', icon: '←', x: 0, y: 0.5 },
    { id: 'center', label: 'Center', icon: '⦿', x: 0.5, y: 0.5 },
    { id: 'mid-right', label: 'Mid Right', icon: '→', x: 1, y: 0.5 },
    { id: 'bottom-left', label: 'Bottom Left', icon: '↙', x: 0, y: 1 },
    { id: 'bottom-center', label: 'Bottom Center', icon: '↓', x: 0.5, y: 1 },
    { id: 'bottom-right', label: 'Bottom Right', icon: '↘', x: 1, y: 1 },
];

/**
 * Concept 3: 9-Point Smart Alignment Pad & Focal Presets
 *
 * Designed specifically for non-modal sidebar integration. Fast, deterministic,
 * touch-friendly 9-point joypad, 2D miniature focal map, and stepped zoom.
 */
export default function SmartAlignmentPad({
    image,
    natural,
    geometry,
    position = DEFAULT_POSITION,
    onPositionChange,
    minimumDpi = MIN_CROP_DPI,
    className = ''
}) {
    const miniPadRef = useRef(null);
    const [isMiniDragging, setIsMiniDragging] = useState(false);

    if (!natural?.w || !natural?.h || !geometry) {
        return null;
    }

    const maxZoom = maxZoomForMinDpi(natural, geometry, minimumDpi);
    const crop = imageCrop(natural, geometry, position, minimumDpi);

    const currentX = position?.x ?? 0.5;
    const currentY = position?.y ?? 0.5;
    const currentZoom = position?.zoom ?? 1;

    // Check which compass point is currently closest
    const activePoint = COMPASS_POINTS.reduce((closest, pt) => {
        const dist = Math.hypot(pt.x - currentX, pt.y - currentY);
        return dist < closest.dist ? { pt, dist } : closest;
    }, { pt: null, dist: Infinity }).pt;

    const isCloseToPoint = (pt) => Math.hypot(pt.x - currentX, pt.y - currentY) < 0.15;

    // Effective DPI
    const effectiveDpi = geometry.apertureWidth > 0 && crop
        ? Math.round(crop.w / geometry.apertureWidth)
        : 300;

    // Handle click/drag on miniature thumbnail pad
    const handleMiniPadPointerDown = (e) => {
        if (!miniPadRef.current) return;
        setIsMiniDragging(true);
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        updateMiniPadFromEvent(e);
    };

    const handleMiniPadPointerMove = (e) => {
        if (!isMiniDragging) return;
        updateMiniPadFromEvent(e);
    };

    const handleMiniPadPointerUp = (e) => {
        if (!isMiniDragging) return;
        setIsMiniDragging(false);
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {}
    };

    const updateMiniPadFromEvent = (e) => {
        if (!miniPadRef.current) return;
        const rect = miniPadRef.current.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        onPositionChange({
            ...position,
            x: Math.round(normX * 100) / 100,
            y: Math.round(normY * 100) / 100
        });
    };

    // Calculate crop rectangle percentages for the mini map
    const miniCropPct = crop ? {
        left: (crop.x / natural.w) * 100,
        top: (crop.y / natural.h) * 100,
        width: (crop.w / natural.w) * 100,
        height: (crop.h / natural.h) * 100,
    } : { left: 0, top: 0, width: 100, height: 100 };

    return (
        <div className={`bg-white rounded-2xl border border-stone-200/90 shadow-sm p-4 sm:p-5 space-y-4 text-stone-900 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Compass size={16} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                            Smart Alignment & Focus
                        </h3>
                        <p className="text-[11px] text-stone-500">
                            9-point directional joypad and focal presets
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onPositionChange(DEFAULT_POSITION)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100 transition-colors"
                    title="Reset to default center"
                >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                </button>
            </div>

            {/* Core Interactive Area: 3x3 Compass Grid + 2D Mini Pad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* 1. 3x3 Tactile Compass Pad */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Tactile Direction Joypad
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-2 bg-stone-50 rounded-xl border border-stone-200/70 shadow-inner">
                        {COMPASS_POINTS.map((pt) => {
                            const isSelected = isCloseToPoint(pt);
                            return (
                                <button
                                    key={pt.id}
                                    type="button"
                                    onClick={() => onPositionChange({ ...position, x: pt.x, y: pt.y })}
                                    className={`h-10 rounded-lg flex flex-col items-center justify-center font-bold text-xs transition-all ${
                                        isSelected
                                            ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/30 ring-2 ring-amber-400'
                                            : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200/80 hover:border-stone-300'
                                    }`}
                                    title={pt.label}
                                    aria-label={pt.label}
                                >
                                    <span className="text-sm leading-none">{pt.icon}</span>
                                    <span className="text-[9px] font-semibold opacity-75 mt-0.5">{pt.id.split('-').pop()}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Interactive 2D Miniature Thumbnail Pad */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                            Interactive 2D Focal Map
                        </label>
                        <span className="text-[10px] text-stone-400 font-mono">
                            X:{Math.round(currentX * 100)}% Y:{Math.round(currentY * 100)}%
                        </span>
                    </div>

                    <div
                        ref={miniPadRef}
                        onPointerDown={handleMiniPadPointerDown}
                        onPointerMove={handleMiniPadPointerMove}
                        onPointerUp={handleMiniPadPointerUp}
                        onPointerCancel={handleMiniPadPointerUp}
                        style={{
                            aspectRatio: `${natural.w} / ${natural.h}`,
                            touchAction: 'none'
                        }}
                        className="relative w-full max-h-[120px] rounded-xl overflow-hidden border border-stone-300 bg-stone-900 shadow-inner cursor-crosshair select-none group"
                        title="Click or drag to target focus"
                    >
                        {/* Miniature photo */}
                        <img
                            src={image}
                            alt="Mini preview"
                            draggable={false}
                            className="w-full h-full object-cover opacity-50 brightness-75 pointer-events-none select-none"
                        />

                        {/* Aperture Crop Cutout Rectangle */}
                        <div
                            style={{
                                left: `${miniCropPct.left}%`,
                                top: `${miniCropPct.top}%`,
                                width: `${miniCropPct.width}%`,
                                height: `${miniCropPct.height}%`,
                            }}
                            className="absolute border-2 border-amber-400 bg-amber-400/20 shadow-[0_0_8px_rgba(0,0,0,0.6)] pointer-events-none transition-all duration-75"
                        >
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Crosshair size={12} className="text-amber-300 animate-pulse" />
                            </div>
                        </div>

                        {/* Hover hint */}
                        <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm text-[9px] text-white/80 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            Click to reposition
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Composition Presets */}
            <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-500" />
                    Composition & Headroom Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                    <button
                        type="button"
                        onClick={() => onPositionChange({ x: 0.5, y: 0.5, zoom: 1 })}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-[11px] font-semibold text-center transition-colors"
                    >
                        Balanced Center
                    </button>
                    <button
                        type="button"
                        onClick={() => onPositionChange({ ...position, y: 0.22 })}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-[11px] font-semibold text-center transition-colors"
                    >
                        Portrait Headroom
                    </button>
                    <button
                        type="button"
                        onClick={() => onPositionChange({ ...position, y: 0.78 })}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-[11px] font-semibold text-center transition-colors"
                    >
                        Horizon Focus
                    </button>
                    <button
                        type="button"
                        onClick={() => onPositionChange({ ...position, zoom: Math.min(maxZoom, 1.35) })}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-[11px] font-semibold text-center transition-colors"
                    >
                        Detail Crop (+35%)
                    </button>
                </div>
            </div>

            {/* Stepped Zoom Control */}
            <div className="space-y-2 pt-1 border-t border-stone-100">
                <div className="flex items-center justify-between text-xs">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        Aperture Zoom Scale
                    </label>
                    <span className="font-mono text-stone-800 font-bold">
                        {Math.round(currentZoom * 100)}%
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onPositionChange({ ...position, zoom: Math.max(1, Math.round((currentZoom - 0.1) * 100) / 100) })}
                        disabled={currentZoom <= 1}
                        className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                        title="Zoom out 10%"
                    >
                        <ZoomOut size={14} />
                    </button>

                    <input
                        type="range"
                        min={1}
                        max={maxZoom}
                        step={0.01}
                        value={currentZoom}
                        onChange={(e) => onPositionChange({ ...position, zoom: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500"
                    />

                    <button
                        type="button"
                        onClick={() => onPositionChange({ ...position, zoom: Math.min(maxZoom, Math.round((currentZoom + 0.1) * 100) / 100) })}
                        disabled={currentZoom >= maxZoom}
                        className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                        title="Zoom in 10%"
                    >
                        <ZoomIn size={14} />
                    </button>
                </div>

                {/* Quick zoom step chips */}
                <div className="flex items-center gap-1.5 pt-0.5">
                    {[1, 1.25, 1.5, 2.0].map((z) => {
                        const isApplicable = z <= maxZoom;
                        const isSelected = Math.abs(currentZoom - z) < 0.05;
                        return (
                            <button
                                key={z}
                                type="button"
                                disabled={!isApplicable}
                                onClick={() => onPositionChange({ ...position, zoom: z })}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                    isSelected
                                        ? 'bg-stone-900 text-white'
                                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-30'
                                }`}
                            >
                                {z.toFixed(2)}×
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Status Pill */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px] text-stone-500">
                <div className="flex items-center gap-1">
                    <ShieldCheck size={13} className={effectiveDpi >= 200 ? 'text-emerald-600' : 'text-amber-600'} />
                    <span>Resolution: <strong className="text-stone-800">{effectiveDpi} DPI</strong></span>
                </div>
                <span>Floor: {minimumDpi} DPI</span>
            </div>
        </div>
    );
}
