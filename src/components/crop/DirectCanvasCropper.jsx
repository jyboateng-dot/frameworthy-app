import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Grid3X3, Hand, Move, Sparkles } from 'lucide-react';
import { imageCrop, cropStyle, maxZoomForMinDpi, DEFAULT_POSITION, MIN_CROP_DPI } from '../../utils/frameFit';
import { getFrameRail, getRailTextureStyle, getRailShading } from '../../utils/frameRail';
import { getFrameInnerShadow, getFrameWallShadow } from '../../utils/frameDepthPresentation';

const FRAME_SIDE_STYLES = {
    top: geometry => ({
        top: 0, left: 0, right: 0,
        height: `${geometry.rail / geometry.outerHeight * 100}%`,
        clipPath: `polygon(0 0, 100% 0, ${100 - geometry.rail / geometry.outerWidth * 100}% 100%, ${geometry.rail / geometry.outerWidth * 100}% 100%)`
    }),
    bottom: geometry => ({
        bottom: 0, left: 0, right: 0,
        height: `${geometry.rail / geometry.outerHeight * 100}%`,
        clipPath: `polygon(${geometry.rail / geometry.outerWidth * 100}% 0, ${100 - geometry.rail / geometry.outerWidth * 100}% 0, 100% 100%, 0 100%)`
    }),
    left: geometry => ({
        top: 0, bottom: 0, left: 0,
        width: `${geometry.rail / geometry.outerWidth * 100}%`,
        clipPath: `polygon(0 0, 100% ${geometry.rail / geometry.outerHeight * 100}%, 100% ${100 - geometry.rail / geometry.outerHeight * 100}%, 0 100%)`
    }),
    right: geometry => ({
        top: 0, bottom: 0, right: 0,
        width: `${geometry.rail / geometry.outerWidth * 100}%`,
        clipPath: `polygon(0 ${geometry.rail / geometry.outerHeight * 100}%, 100% 0, 100% 100%, 0 ${100 - geometry.rail / geometry.outerHeight * 100}%)`
    }),
};

function FrameSide({ side, frame, geometry }) {
    const rail = getFrameRail(frame);
    const textureStyle = getRailTextureStyle(side, rail);
    return (
        <div className="absolute z-10 overflow-hidden" style={{ ...FRAME_SIDE_STYLES[side](geometry), isolation: 'isolate' }}>
            <div className="absolute inset-0" style={{ backgroundColor: frame?.baseColor || '#242321' }} />
            {textureStyle && <div className="absolute inset-0 pointer-events-none" style={textureStyle} />}
            <div className="absolute inset-0 pointer-events-none" style={getRailShading(side, frame, rail)} />
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),inset_0_-2px_3px_rgba(0,0,0,0.18)]" />
        </div>
    );
}

/**
 * Concept 1: Direct On-Frame Canvas Manipulation
 *
 * Provides tactile drag-to-pan directly on the framed picture with 1:1 pixel tracking,
 * mouse-wheel / trackpad zoom, auto-fading rule-of-thirds grid, and a sleek floating mini-HUD.
 */
export default function DirectCanvasCropper({
    image,
    natural,
    geometry,
    position = DEFAULT_POSITION,
    onPositionChange,
    frame,
    matColor = '#faf9f5',
    minimumDpi = MIN_CROP_DPI,
    className = ''
}) {
    const apertureRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);
    const [alwaysShowGrid, setAlwaysShowGrid] = useState(false);
    const fadeTimerRef = useRef(null);
    const dragStartRef = useRef({ clientX: 0, clientY: 0, startPos: { ...position } });

    const maxZoom = maxZoomForMinDpi(natural, geometry, minimumDpi);
    const crop = imageCrop(natural, geometry, position, minimumDpi);

    const railPctX = (geometry.rail / geometry.outerWidth) * 100;
    const railPctY = (geometry.rail / geometry.outerHeight) * 100;
    const matPctX = ((geometry.rail + geometry.mat) / geometry.outerWidth) * 100;
    const matPctY = ((geometry.rail + geometry.mat) / geometry.outerHeight) * 100;
    const borderSlice = frame?.borderImageSlicePct ?? ((geometry.rail / (8 + 2 * geometry.rail)) * 100);

    // Trigger grid display and schedule fade-out
    const triggerInteractionNotice = useCallback(() => {
        setIsInteracting(true);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => {
            setIsInteracting(false);
        }, 850);
    }, []);

    useEffect(() => {
        return () => {
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        };
    }, []);

    // Pointer event handlers for 1:1 tactile drag-to-pan
    const handlePointerDown = (e) => {
        if (!apertureRef.current || !crop || !natural) return;
        // Only react to primary mouse button or touch
        if (e.button !== undefined && e.button !== 0) return;

        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // Ignore capture error if unsupported
        }

        setIsDragging(true);
        triggerInteractionNotice();

        dragStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            startPos: {
                x: position?.x ?? 0.5,
                y: position?.y ?? 0.5,
                zoom: position?.zoom ?? 1
            }
        };
    };

    const handlePointerMove = (e) => {
        if (!isDragging || !apertureRef.current || !crop || !natural) return;
        triggerInteractionNotice();

        const rect = apertureRef.current.getBoundingClientRect();
        const apertureDomW = rect.width;
        const apertureDomH = rect.height;

        // Calculate rendered overflow in CSS pixels
        // overflowX = apertureDomW * (natural.w - crop.w) / crop.w
        const overflowXDom = crop.w > 0 ? apertureDomW * ((natural.w - crop.w) / crop.w) : 0;
        const overflowYDom = crop.h > 0 ? apertureDomH * ((natural.h - crop.h) / crop.h) : 0;

        const deltaX = e.clientX - dragStartRef.current.clientX;
        const deltaY = e.clientY - dragStartRef.current.clientY;

        const nextPos = { ...dragStartRef.current.startPos };

        if (overflowXDom > 0.5) {
            // Moving pointer right (deltaX > 0) pulls the photo right, which decreases x
            const deltaNormalizedX = -deltaX / overflowXDom;
            nextPos.x = Math.max(0, Math.min(1, dragStartRef.current.startPos.x + deltaNormalizedX));
        }

        if (overflowYDom > 0.5) {
            // Moving pointer down (deltaY > 0) pulls photo down, which decreases y
            const deltaNormalizedY = -deltaY / overflowYDom;
            nextPos.y = Math.max(0, Math.min(1, dragStartRef.current.startPos.y + deltaNormalizedY));
        }

        onPositionChange(nextPos);
    };

    const handlePointerUp = (e) => {
        if (!isDragging) return;
        setIsDragging(false);
        triggerInteractionNotice();
        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {
            // Safe fallback
        }
    };

    // Wheel zoom handling
    const handleWheel = (e) => {
        if (!natural || !geometry) return;
        e.preventDefault();
        triggerInteractionNotice();

        const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
        const currentZoom = position?.zoom ?? 1;
        const newZoom = Math.max(1, Math.min(maxZoom, Math.round((currentZoom + zoomDelta) * 100) / 100));

        if (newZoom !== currentZoom) {
            onPositionChange({
                ...position,
                zoom: newZoom
            });
        }
    };

    // Zoom nudger
    const handleZoomStep = (delta) => {
        triggerInteractionNotice();
        const currentZoom = position?.zoom ?? 1;
        const newZoom = Math.max(1, Math.min(maxZoom, Math.round((currentZoom + delta) * 100) / 100));
        onPositionChange({ ...position, zoom: newZoom });
    };

    const handleReset = () => {
        triggerInteractionNotice();
        onPositionChange(DEFAULT_POSITION);
    };

    const showGrid = alwaysShowGrid || isDragging || isInteracting;

    return (
        <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
            {/* Visualizer Frame Container */}
            <div className="relative w-full flex items-center justify-center p-4 sm:p-8 min-h-[420px] max-h-[580px]">
                <div
                    style={{
                        aspectRatio: `${geometry.outerWidth} / ${geometry.outerHeight}`,
                        width: geometry.outerWidth >= geometry.outerHeight ? '100%' : 'auto',
                        height: geometry.outerWidth >= geometry.outerHeight ? 'auto' : '100%',
                        maxHeight: '480px',
                        maxWidth: '100%',
                        background: '#fff',
                        boxShadow: getFrameWallShadow(frame)
                    }}
                    className="relative group transition-all duration-300"
                >
                    {/* Frame Moulding */}
                    {frame?.borderImageSource && !getFrameRail(frame) ? (
                        <div
                            className="absolute inset-0 z-10 pointer-events-none"
                            style={{
                                borderStyle: 'solid',
                                borderWidth: '1px',
                                borderColor: 'transparent',
                                borderImageWidth: `${railPctY}% ${railPctX}%`,
                                borderImageSource: `url(${frame.borderImageSource})`,
                                borderImageSlice: `${borderSlice}%`,
                                borderImageRepeat: 'stretch',
                            }}
                        />
                    ) : (
                        <>
                            {Object.keys(FRAME_SIDE_STYLES).map(side => (
                                <FrameSide key={side} side={side} frame={frame} geometry={geometry} />
                            ))}
                            <svg className="absolute inset-0 z-20 w-full h-full pointer-events-none" aria-hidden="true">
                                <line x1="0" y1="0" x2={`${railPctX}%`} y2={`${railPctY}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                <line x1="100%" y1="0" x2={`${100 - railPctX}%`} y2={`${railPctY}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                <line x1="0" y1="100%" x2={`${railPctX}%`} y2={`${100 - railPctY}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                <line x1="100%" y1="100%" x2={`${100 - railPctX}%`} y2={`${100 - railPctY}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                            </svg>
                        </>
                    )}

                    {/* Mat Board / Mount */}
                    <div
                        className="absolute z-20 shadow-[0_2px_5px_rgba(0,0,0,0.15),_0_1px_2px_rgba(0,0,0,0.1)] pointer-events-none"
                        style={{
                            background: matColor,
                            inset: `${railPctY}% ${railPctX}%`
                        }}
                    >
                        {geometry.mat > 0 && (
                            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.14)]" />
                        )}
                    </div>

                    {/* Active Aperture Window with Direct Pointer & Drag Handling */}
                    <div
                        ref={apertureRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onWheel={handleWheel}
                        className={`absolute z-30 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] ${
                            isDragging ? 'cursor-grabbing' : 'cursor-grab hover:ring-2 hover:ring-amber-500/50'
                        }`}
                        style={{
                            inset: `${matPctY}% ${matPctX}%`,
                            touchAction: 'none'
                        }}
                        title="Click and drag to pan · Scroll to zoom"
                    >
                        {/* 45-degree Bevel Cut Mat Core Detailing */}
                        {geometry.mat > 0 && (
                            <>
                                <div className="absolute inset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.22),_inset_0_0_1px_rgba(0,0,0,0.15)] pointer-events-none z-30" />
                                <div className="absolute inset-0 border border-[#f7f4ee]/90 pointer-events-none z-30" />
                                <div className="absolute inset-0 border-t border-l border-white/70 pointer-events-none z-30" />
                                <div className="absolute inset-0 border-b border-r border-black/15 pointer-events-none z-30" />
                            </>
                        )}

                        {/* The Artwork Photo */}
                        <img
                            src={image}
                            alt="Framed artwork"
                            draggable={false}
                            className="pointer-events-none select-none"
                            style={{
                                ...cropStyle(natural, crop),
                                imageRendering: '-webkit-optimize-contrast',
                                transition: isDragging ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out'
                            }}
                        />

                        {/* Interactive 3x3 Rule-of-Thirds Grid Overlay */}
                        <div
                            className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 ${
                                showGrid ? 'opacity-100' : 'opacity-0'
                            }`}
                        >
                            {/* Vertical Guidelines */}
                            <div className="absolute top-0 bottom-0 left-1/3 w-px border-l border-dashed border-white/70 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                            <div className="absolute top-0 bottom-0 left-2/3 w-px border-l border-dashed border-white/70 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />

                            {/* Horizontal Guidelines */}
                            <div className="absolute left-0 right-0 top-1/3 h-px border-t border-dashed border-white/70 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                            <div className="absolute left-0 right-0 top-2/3 h-px border-t border-dashed border-white/70 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />

                            {/* 4 Golden Intersection Crosshair Points */}
                            <div className="absolute left-1/3 top-1/3 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-amber-300/90 bg-amber-400/30 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
                            <div className="absolute left-2/3 top-1/3 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-amber-300/90 bg-amber-400/30 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
                            <div className="absolute left-1/3 top-2/3 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-amber-300/90 bg-amber-400/30 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
                            <div className="absolute left-2/3 top-2/3 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-amber-300/90 bg-amber-400/30 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
                        </div>

                        {/* Subtle Floating Drag Prompt (fades out once user interacts) */}
                        {!isInteracting && !isDragging && (
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-25 pointer-events-none bg-black/60 backdrop-blur-sm text-white/90 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <Move size={12} className="text-amber-300" />
                                <span>Drag to reposition · Scroll to zoom</span>
                            </div>
                        )}
                    </div>

                    {/* Overall Frame Depth Inner Shadow */}
                    <div className="absolute inset-0 z-40 pointer-events-none" style={{ boxShadow: getFrameInnerShadow(frame) }} />
                </div>
            </div>

            {/* Floating Glassmorphic Mini-HUD Control Pill */}
            <div className="mt-3 flex items-center justify-center">
                <div className="bg-stone-900/85 backdrop-blur-md text-white border border-stone-700/60 shadow-xl rounded-full px-4 py-2 flex items-center gap-3 text-xs">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1.5 border-r border-stone-700 pr-3">
                        <button
                            type="button"
                            onClick={() => handleZoomStep(-0.1)}
                            disabled={(position?.zoom ?? 1) <= 1}
                            aria-label="Zoom out"
                            title="Zoom out"
                            className="w-7 h-7 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 disabled:opacity-40 transition-colors"
                        >
                            <ZoomOut size={14} />
                        </button>
                        <span className="font-mono text-[11px] text-stone-200 min-w-[36px] text-center font-semibold">
                            {Math.round((position?.zoom ?? 1) * 100)}%
                        </span>
                        <button
                            type="button"
                            onClick={() => handleZoomStep(0.1)}
                            disabled={(position?.zoom ?? 1) >= maxZoom}
                            aria-label="Zoom in"
                            title="Zoom in"
                            className="w-7 h-7 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 disabled:opacity-40 transition-colors"
                        >
                            <ZoomIn size={14} />
                        </button>
                    </div>

                    {/* Rule of Thirds Grid Toggle */}
                    <button
                        type="button"
                        onClick={() => setAlwaysShowGrid(!alwaysShowGrid)}
                        aria-pressed={alwaysShowGrid}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-colors ${
                            alwaysShowGrid ? 'bg-amber-500/25 text-amber-300 font-semibold' : 'text-stone-300 hover:text-white hover:bg-stone-800'
                        }`}
                        title={alwaysShowGrid ? 'Grid locked on' : 'Click to lock grid overlay'}
                    >
                        <Grid3X3 size={13} />
                        <span>Grid</span>
                    </button>

                    {/* Reset Button */}
                    <button
                        type="button"
                        onClick={handleReset}
                        className="flex items-center gap-1 text-stone-300 hover:text-white hover:bg-stone-800 px-2 py-1 rounded-full text-[11px] transition-colors"
                        title="Reset to center and 100% zoom"
                    >
                        <RotateCcw size={12} />
                        <span>Reset</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
