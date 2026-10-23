import React from 'react';
import {
    MoveHorizontal,
    MoveVertical,
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    RotateCcw,
    CheckCircle2,
    Info,
    Sparkles
} from 'lucide-react';
import {
    imageCrop,
    maxZoomForMinDpi,
    DEFAULT_POSITION,
    MIN_CROP_DPI
} from '../../utils/frameFit';

/**
 * Attractive, intuitive, and context-aware sliders for positioning artwork in a frame.
 *
 * Solves the critical UX issue where moving a slider causes no effect because the image
 * doesn't overflow along that axis at the current zoom level.
 */
export default function SmartCropSliders({
    natural,
    geometry,
    position = DEFAULT_POSITION,
    onPosition,
    minimumDpi = MIN_CROP_DPI,
    className = ''
}) {
    if (!natural?.w || !natural?.h || !geometry) {
        return null;
    }

    const currentX = Number.isFinite(position?.x) ? position.x : 0.5;
    const currentY = Number.isFinite(position?.y) ? position.y : 0.5;
    const currentZoom = Number.isFinite(position?.zoom) ? position.zoom : 1;

    const maxZoom = maxZoomForMinDpi(natural, geometry, minimumDpi);
    const crop = imageCrop(natural, geometry, position, minimumDpi);

    // Precise overflow detection
    // If overflow is <= 1.5 pixels, moving that slider produces NO visible change!
    const overflowX = crop ? Math.max(0, natural.w - crop.w) : 0;
    const overflowY = crop ? Math.max(0, natural.h - crop.h) : 0;

    const hasHorizontalOverflow = overflowX > 1.5;
    const hasVerticalOverflow = overflowY > 1.5;

    // Helper to nudge position by a small delta
    const nudge = (key, delta, min = 0, max = 1) => {
        const currentVal = position?.[key] ?? (key === 'zoom' ? 1 : 0.5);
        const nextVal = Math.max(min, Math.min(max, Math.round((currentVal + delta) * 100) / 100));
        onPosition({ ...position, [key]: nextVal });
    };

    // Calculate human-friendly positioning readouts
    const getHorizontalLabel = () => {
        if (!hasHorizontalOverflow) return 'Fits width exactly';
        if (Math.abs(currentX - 0.5) < 0.05) return 'Centered';
        if (currentX < 0.45) return `${Math.round((0.5 - currentX) * 200)}% Left`;
        return `${Math.round((currentX - 0.5) * 200)}% Right`;
    };

    const getVerticalLabel = () => {
        if (!hasVerticalOverflow) return 'Fits height exactly';
        if (Math.abs(currentY - 0.5) < 0.05) return 'Centered';
        if (currentY < 0.45) return `${Math.round((0.5 - currentY) * 200)}% Top`;
        return `${Math.round((currentY - 0.5) * 200)}% Bottom`;
    };

    // Dynamic framing context message
    const getContextNotice = () => {
        if (!hasHorizontalOverflow && !hasVerticalOverflow) {
            return {
                type: 'exact',
                text: 'Photo aspect ratio matches the frame opening. Increase zoom if you wish to crop in or pan.'
            };
        }
        if (hasHorizontalOverflow && !hasVerticalOverflow) {
            return {
                type: 'horizontal',
                text: 'Photo is wider than the frame. Slide Horizontal to choose which part is shown.'
            };
        }
        if (!hasHorizontalOverflow && hasVerticalOverflow) {
            return {
                type: 'vertical',
                text: 'Photo is taller than the frame. Slide Vertical to adjust headroom and vertical focus.'
            };
        }
        return {
            type: 'both',
            text: 'Image is zoomed in. Both horizontal and vertical sliders are active for custom framing.'
        };
    };

    const contextNotice = getContextNotice();

    return (
        <div className={`space-y-4 text-stone-900 ${className}`}>
            {/* Dynamic Context Notice */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-900">
                <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{contextNotice.text}</span>
            </div>

            {/* 1. HORIZONTAL SLIDER CARD */}
            <div
                className={`rounded-2xl border p-4 transition-all ${
                    hasHorizontalOverflow
                        ? 'bg-white border-stone-200 shadow-sm'
                        : 'bg-stone-50/70 border-dashed border-stone-200/80 opacity-75'
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                hasHorizontalOverflow
                                    ? 'bg-amber-500/15 text-amber-700'
                                    : 'bg-stone-200 text-stone-500'
                            }`}
                        >
                            <MoveHorizontal size={14} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                            Horizontal Position
                        </span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                                hasHorizontalOverflow
                                    ? 'bg-amber-100 text-amber-800 font-mono'
                                    : 'bg-stone-200/80 text-stone-600 flex items-center gap-1'
                            }`}
                        >
                            {!hasHorizontalOverflow && <CheckCircle2 size={12} className="text-emerald-600" />}
                            {getHorizontalLabel()}
                        </span>
                        {hasHorizontalOverflow && Math.abs(currentX - 0.5) > 0.02 && (
                            <button
                                type="button"
                                onClick={() => onPosition({ ...position, x: 0.5 })}
                                className="text-[10px] text-stone-500 hover:text-stone-900 underline ml-1"
                                title="Center horizontally"
                            >
                                Center
                            </button>
                        )}
                    </div>
                </div>

                {/* Slider Control Row */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                        {/* Nudge Left */}
                        <button
                            type="button"
                            onClick={() => nudge('x', -0.05, 0, 1)}
                            disabled={!hasHorizontalOverflow || currentX <= 0}
                            aria-label="Nudge image left"
                            title="Nudge left"
                            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {/* Visual Slider Track */}
                        <div className="relative flex-1 flex items-center">
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={currentX}
                                disabled={!hasHorizontalOverflow}
                                onChange={(e) => onPosition({ ...position, x: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#c9a84c] disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Horizontal position"
                            />
                            {/* Center detent mark */}
                            <div
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-3 bg-stone-400/60 rounded-full pointer-events-none"
                                title="Center"
                            />
                        </div>

                        {/* Nudge Right */}
                        <button
                            type="button"
                            onClick={() => nudge('x', 0.05, 0, 1)}
                            disabled={!hasHorizontalOverflow || currentX >= 1}
                            aria-label="Nudge image right"
                            title="Nudge right"
                            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Directional Labels */}
                    <div className="flex justify-between text-[10px] text-stone-400 font-medium px-1">
                        <span>◀ Show Left</span>
                        <span className="text-stone-400">Center</span>
                        <span>Show Right ▶</span>
                    </div>
                </div>

                {/* Inactive Helper Note */}
                {!hasHorizontalOverflow && (
                    <div className="mt-2 text-[11px] text-stone-500 bg-white/70 rounded-lg p-2 border border-stone-100 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>Photo fills the width completely without cropping. Zoom in below to adjust.</span>
                    </div>
                )}
            </div>

            {/* 2. VERTICAL SLIDER CARD */}
            <div
                className={`rounded-2xl border p-4 transition-all ${
                    hasVerticalOverflow
                        ? 'bg-white border-stone-200 shadow-sm'
                        : 'bg-stone-50/70 border-dashed border-stone-200/80 opacity-75'
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                hasVerticalOverflow
                                    ? 'bg-amber-500/15 text-amber-700'
                                    : 'bg-stone-200 text-stone-500'
                            }`}
                        >
                            <MoveVertical size={14} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                            Vertical Position
                        </span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                                hasVerticalOverflow
                                    ? 'bg-amber-100 text-amber-800 font-mono'
                                    : 'bg-stone-200/80 text-stone-600 flex items-center gap-1'
                            }`}
                        >
                            {!hasVerticalOverflow && <CheckCircle2 size={12} className="text-emerald-600" />}
                            {getVerticalLabel()}
                        </span>
                        {hasVerticalOverflow && Math.abs(currentY - 0.5) > 0.02 && (
                            <button
                                type="button"
                                onClick={() => onPosition({ ...position, y: 0.5 })}
                                className="text-[10px] text-stone-500 hover:text-stone-900 underline ml-1"
                                title="Center vertically"
                            >
                                Center
                            </button>
                        )}
                    </div>
                </div>

                {/* Slider Control Row */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                        {/* Nudge Up */}
                        <button
                            type="button"
                            onClick={() => nudge('y', -0.05, 0, 1)}
                            disabled={!hasVerticalOverflow || currentY <= 0}
                            aria-label="Nudge image up"
                            title="Nudge up (show top / faces)"
                            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                            <ChevronUp size={16} />
                        </button>

                        {/* Visual Slider Track */}
                        <div className="relative flex-1 flex items-center">
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={currentY}
                                disabled={!hasVerticalOverflow}
                                onChange={(e) => onPosition({ ...position, y: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#c9a84c] disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Vertical position"
                            />
                            {/* Center detent mark */}
                            <div
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-3 bg-stone-400/60 rounded-full pointer-events-none"
                                title="Center"
                            />
                        </div>

                        {/* Nudge Down */}
                        <button
                            type="button"
                            onClick={() => nudge('y', 0.05, 0, 1)}
                            disabled={!hasVerticalOverflow || currentY >= 1}
                            aria-label="Nudge image down"
                            title="Nudge down"
                            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                            <ChevronDown size={16} />
                        </button>
                    </div>

                    {/* Directional Labels */}
                    <div className="flex justify-between text-[10px] text-stone-400 font-medium px-1">
                        <span>▲ Show Top (Headroom)</span>
                        <span className="text-stone-400">Center</span>
                        <span>Show Bottom ▼</span>
                    </div>
                </div>

                {/* Inactive Helper Note */}
                {!hasVerticalOverflow && (
                    <div className="mt-2 text-[11px] text-stone-500 bg-white/70 rounded-lg p-2 border border-stone-100 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>Photo fills the height completely without cropping. Zoom in below to adjust.</span>
                    </div>
                )}
            </div>

            {/* 3. ZOOM & SCALE CARD */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center">
                            <ZoomIn size={14} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                            Scale & Zoom
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2.5 py-0.5 rounded-full">
                            {Math.round(currentZoom * 100)}%
                        </span>
                        {currentZoom > 1.02 && (
                            <button
                                type="button"
                                onClick={() => onPosition({ ...position, zoom: 1 })}
                                className="text-[10px] text-stone-500 hover:text-stone-900 underline"
                                title="Reset zoom to 100%"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Slider Row */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => nudge('zoom', -0.1, 1, maxZoom)}
                            disabled={currentZoom <= 1}
                            aria-label="Zoom out"
                            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                            <ZoomOut size={14} />
                        </button>

                        <div className="relative flex-1 flex items-center">
                            <input
                                type="range"
                                min={1}
                                max={maxZoom}
                                step={0.01}
                                value={currentZoom}
                                onChange={(e) => onPosition({ ...position, zoom: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#c9a84c]"
                                aria-label="Zoom scale"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => nudge('zoom', 0.1, 1, maxZoom)}
                            disabled={currentZoom >= maxZoom}
                            aria-label="Zoom in"
                            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                            <ZoomIn size={14} />
                        </button>
                    </div>

                    {/* Quick Zoom Chips */}
                    <div className="flex items-center gap-1.5 pt-1">
                        {[1, 1.25, 1.5, 2.0].map((z) => {
                            if (z > maxZoom) return null;
                            const isSelected = Math.abs(currentZoom - z) < 0.04;
                            return (
                                <button
                                    key={z}
                                    type="button"
                                    onClick={() => onPosition({ ...position, zoom: z })}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                        isSelected
                                            ? 'bg-stone-900 text-white shadow-sm'
                                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                                    }`}
                                >
                                    {z === 1 ? '1.0× (Fit)' : `${z.toFixed(2)}×`}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
