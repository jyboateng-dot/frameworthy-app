import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Focus, RotateCcw, X, Check, ZoomIn } from 'lucide-react';
import { FRAME_SIZES, formatDimensions } from '../../data/constants';
import { DEFAULT_POSITION, frameGeometry, imageCrop, cropStyle, maxZoomForMinDpi, isDefaultFitPosition } from '../../utils/frameFit';
import { getFrameRail, getRailTextureStyle, getRailShading } from '../../utils/frameRail';
import { getFrameInnerShadow, getFrameWallShadow } from '../../utils/frameDepthPresentation';
import { bestFitOptions } from '../../utils/bestFitOptions';
import Price from '../common/Price';

export const HorizontalMoveIcon = ({ size = 14, className = "text-stone-500" }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {/* Existing 4-way move crossbars */}
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="4" x2="12" y2="20" />
        {/* Deepened right/left arrow points */}
        <polyline points="7.5 8 2 12 7.5 16" />
        <polyline points="16.5 8 22 12 16.5 16" />
        {/* Subtle north/south arrow points */}
        <polyline points="9.5 4.5 12 2 14.5 4.5" />
        <polyline points="9.5 19.5 12 22 14.5 19.5" />
    </svg>
);

export const VerticalMoveIcon = ({ size = 14, className = "text-stone-500" }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {/* Existing 4-way move crossbars */}
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
        {/* Deepened north/south arrow points */}
        <polyline points="8 7.5 12 2 16 7.5" />
        <polyline points="8 16.5 12 22 16 16.5" />
        {/* Subtle right/left arrow points */}
        <polyline points="4.5 9.5 2 12 4.5 14.5" />
        <polyline points="19.5 9.5 22 12 19.5 14.5" />
    </svg>
);

const FRAME_SIDE_STYLES = {
    top: geometry => ({ top: 0, left: 0, right: 0, height: `${geometry.rail / geometry.outerHeight * 100}%`,
        clipPath: `polygon(0 0, 100% 0, ${100 - geometry.rail / geometry.outerWidth * 100}% 100%, ${geometry.rail / geometry.outerWidth * 100}% 100%)` }),
    bottom: geometry => ({ bottom: 0, left: 0, right: 0, height: `${geometry.rail / geometry.outerHeight * 100}%`,
        clipPath: `polygon(${geometry.rail / geometry.outerWidth * 100}% 0, ${100 - geometry.rail / geometry.outerWidth * 100}% 0, 100% 100%, 0 100%)` }),
    left: geometry => ({ top: 0, bottom: 0, left: 0, width: `${geometry.rail / geometry.outerWidth * 100}%`,
        clipPath: `polygon(0 0, 100% ${geometry.rail / geometry.outerHeight * 100}%, 100% ${100 - geometry.rail / geometry.outerHeight * 100}%, 0 100%)` }),
    right: geometry => ({ top: 0, bottom: 0, right: 0, width: `${geometry.rail / geometry.outerWidth * 100}%`,
        clipPath: `polygon(0 ${geometry.rail / geometry.outerHeight * 100}%, 100% 0, 100% 100%, 0 ${100 - geometry.rail / geometry.outerHeight * 100}%)` }),
};

function FrameSide({ side, frame, geometry }) {
    const rail = getFrameRail(frame);
    const textureStyle = getRailTextureStyle(side, rail);
    return <div className="absolute z-10 overflow-hidden" style={{ ...FRAME_SIDE_STYLES[side](geometry), isolation: 'isolate' }}>
        <div className="absolute inset-0" style={{ backgroundColor: frame.baseColor || '#8b4513' }} />
        {textureStyle && <div className="absolute inset-0 pointer-events-none" style={textureStyle} />}
        <div className="absolute inset-0 pointer-events-none" style={getRailShading(side, frame, rail)} />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),inset_0_-2px_3px_rgba(0,0,0,0.18)]" />
    </div>;
}

export function FitPreview({ image, natural, geometry, position, frame, matColor, minimumDpi, contentBounds = null }) {
    const crop = imageCrop(natural, geometry, position, minimumDpi, contentBounds);
    const railPctX = geometry.rail / geometry.outerWidth * 100;
    const railPctY = geometry.rail / geometry.outerHeight * 100;
    const matPctX = (geometry.rail + geometry.mat) / geometry.outerWidth * 100;
    const matPctY = (geometry.rail + geometry.mat) / geometry.outerHeight * 100;
    const borderSlice = frame?.borderImageSlicePct ?? ((geometry.rail / (8 + 2 * geometry.rail)) * 100);
    return <div className="flex items-center justify-center h-64 w-full">
        <div style={{ aspectRatio: `${geometry.outerWidth} / ${geometry.outerHeight}`,
            width: geometry.outerWidth >= geometry.outerHeight ? '100%' : 'auto',
            height: geometry.outerWidth >= geometry.outerHeight ? 'auto' : '100%', maxHeight: '100%', maxWidth: '100%',
            background: '#fff', boxShadow: getFrameWallShadow(frame) }} className="relative">
            {frame?.borderImageSource && !getFrameRail(frame) ? <div className="absolute inset-0 z-10 pointer-events-none" style={{
                borderStyle: 'solid', borderWidth: '1px', borderColor: 'transparent',
                borderImageWidth: `${railPctY}% ${railPctX}%`,
                borderImageSource: `url(${frame.borderImageSource})`,
                borderImageSlice: `${borderSlice}%`, borderImageRepeat: 'stretch',
            }} /> : <>
                {Object.keys(FRAME_SIDE_STYLES).map(side => <FrameSide key={side} side={side} frame={frame} geometry={geometry} />)}
                <svg className="absolute inset-0 z-20 w-full h-full pointer-events-none" aria-hidden="true">
                    <line x1="0" y1="0" x2={`${railPctX}%`} y2={`${railPctY}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                    <line x1="100%" y1="0" x2={`${100 - railPctX}%`} y2={`${railPctY}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                    <line x1="0" y1="100%" x2={`${railPctX}%`} y2={`${100 - railPctY}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                    <line x1="100%" y1="100%" x2={`${100 - railPctX}%`} y2={`${100 - railPctY}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                </svg>
            </>}
            <div className="absolute z-20 shadow-[0_2px_5px_rgba(0,0,0,0.15),_0_1px_2px_rgba(0,0,0,0.1)]" style={{
                background: matColor, inset: `${railPctY}% ${railPctX}%` }}>
                {geometry.mat > 0 && <div className="absolute inset-0 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.14)]" />}
            </div>
            <div className="absolute z-30 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.16)]" style={{
                inset: `${matPctY}% ${matPctX}%` }}>
                <img src={image} alt="Frame composition" style={cropStyle(natural, crop)} />
            </div>
            <div className="absolute inset-0 z-40 pointer-events-none" style={{ boxShadow: getFrameInnerShadow(frame) }} />
        </div>
    </div>;
}

export default function FrameFitPanel({ image, natural, size, orientation, mat, rail, frame, matColor,
    unit, position, onPosition, onApply, error, price, matPrice, step,
    availableSizes = FRAME_SIZES, prodigiConfiguration = {}, currency = 'GHS', minimumDpi,
    contentBounds = null }) {
    const [compare, setCompare] = useState(false);
    const [undo, setUndo] = useState(null);
    const dialogRef = useRef(null);
    const open = compare;
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement;
        dialogRef.current?.querySelector('button')?.focus();
        return () => previous?.focus();
    }, [open]);

    const geometry = frameGeometry(size, orientation, mat, rail);
    const activeNatural = contentBounds || natural;
    const maxZoom = maxZoomForMinDpi(activeNatural, geometry, minimumDpi);

    const aspect = (geometry?.apertureWidth && geometry?.apertureHeight)
        ? geometry.apertureWidth / geometry.apertureHeight
        : 1;
    const baseW = Math.min(activeNatural?.w || 1000, (activeNatural?.h || 1000) * aspect);
    const baseH = baseW / aspect;
    const currentZoom = Math.max(1, Math.min(maxZoom, Number(position?.zoom) || 1));
    const cropW = baseW / currentZoom;
    const cropH = cropW / aspect;
    const overflowX = Math.max(0, (activeNatural?.w || 1000) - cropW);
    const overflowY = Math.max(0, (activeNatural?.h || 1000) - cropH);

    const posX = Number.isFinite(Number(position?.x)) ? Number(position.x) : 0.5;
    const posY = Number.isFinite(Number(position?.y)) ? Number(position.y) : 0.5;
    const isDefault = isDefaultFitPosition(position);

    let horizontalBadge;
    if (overflowX <= 1 && currentZoom <= 1.02) {
        horizontalBadge = 'Full width';
    } else if (Math.abs(posX - 0.5) < 0.02) {
        horizontalBadge = 'Center';
    } else if (posX < 0.48) {
        horizontalBadge = `${Math.round((0.5 - posX) * 200)}% Left`;
    } else {
        horizontalBadge = `${Math.round((posX - 0.5) * 200)}% Right`;
    }

    let verticalBadge;
    if (overflowY <= 1 && currentZoom <= 1.02) {
        verticalBadge = 'Full height';
    } else if (Math.abs(posY - 0.5) < 0.02) {
        verticalBadge = 'Center';
    } else if (posY < 0.48) {
        verticalBadge = `${Math.round((0.5 - posY) * 200)}% Top`;
    } else {
        verticalBadge = `${Math.round((posY - 0.5) * 200)}% Bottom`;
    }

    const handleHorizontalChange = (val) => {
        const newX = Number(val);
        if (overflowX <= 1 && currentZoom <= 1.02 && maxZoom > 1.05) {
            const autoZoom = Math.min(maxZoom, 1.15);
            onPosition({ ...position, x: newX, zoom: autoZoom });
        } else {
            onPosition({ ...position, x: newX });
        }
    };

    const handleVerticalChange = (val) => {
        const newY = Number(val);
        if (overflowY <= 1 && currentZoom <= 1.02 && maxZoom > 1.05) {
            const autoZoom = Math.min(maxZoom, 1.15);
            onPosition({ ...position, y: newY, zoom: autoZoom });
        } else {
            onPosition({ ...position, y: newY });
        }
    };

    const handleZoomChange = (val) => {
        onPosition({ ...position, zoom: Number(val) });
    };

    const options = useMemo(() => bestFitOptions({
        sizes: availableSizes,
        natural,
        size,
        orientation,
        mat,
        rail,
        frame,
        price,
        matPrice,
        prodigiConfiguration,
        minimumDpi,
    }), [availableSizes, natural, size, orientation, mat, rail, frame, price, matPrice, prodigiConfiguration, minimumDpi]);

    const applyOption = option => {
        setUndo({ size, orientation, mat, position });
        onApply({ ...option, position: DEFAULT_POSITION });
        setCompare(false);
    };

    const preview = (g, p = position) => <FitPreview image={image} natural={natural} geometry={g}
        position={p} frame={frame} matColor={matColor} minimumDpi={minimumDpi} contentBounds={contentBounds} />;

    return <section className="space-y-3 text-stone-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex shrink-0 items-center justify-center text-[10px]">{step}</span>
                Image Position & Crop
            </h2>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setCompare(true)}
                    className="text-xs text-stone-700 hover:text-stone-950 flex items-center gap-1 font-semibold transition-colors"
                >
                    <Focus size={14} />
                    Best Fit
                </button>
                <button
                    type="button"
                    className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        !isDefault
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'text-stone-400 hover:text-stone-600'
                    }`}
                    title="Reset image position to center"
                    aria-label="Reset image position"
                    onClick={() => onPosition(DEFAULT_POSITION)}
                >
                    <RotateCcw size={14} />
                </button>
            </div>
        </div>

        <div className="space-y-3.5 bg-stone-50/70 p-3.5 rounded-xl border border-stone-200/80">
            {/* Zoom Slider */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <ZoomIn size={14} className="text-stone-500" />
                        Zoom
                    </span>
                    <span className="text-[11px] font-bold text-stone-800 tabular-nums bg-white px-2 py-0.5 rounded shadow-xs border border-stone-200">
                        {currentZoom.toFixed(2)}×
                    </span>
                </div>
                <input
                    className="w-full h-1.5 accent-fw-gold cursor-pointer bg-stone-200 rounded-lg appearance-none disabled:opacity-40"
                    aria-label="Zoom artwork"
                    type="range"
                    min={1}
                    max={maxZoom}
                    step={0.01}
                    disabled={maxZoom <= 1.01}
                    value={currentZoom}
                    onChange={e => handleZoomChange(e.target.value)}
                />
                <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                    <span>1.0× (Fit)</span>
                    <span>{maxZoom.toFixed(1)}× Max</span>
                </div>
            </div>

            {/* Horizontal Slider */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <HorizontalMoveIcon size={14} className="text-stone-500" />
                        Horizontal
                    </span>
                    <span className="text-[11px] font-medium text-stone-700 tabular-nums bg-white px-2 py-0.5 rounded shadow-xs border border-stone-200">
                        {horizontalBadge}
                    </span>
                </div>
                <div className="relative flex items-center">
                    <input
                        className="w-full h-1.5 accent-fw-gold cursor-pointer bg-stone-200 rounded-lg appearance-none"
                        aria-label="Horizontal position"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={posX}
                        onChange={e => handleHorizontalChange(e.target.value)}
                    />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-stone-400/80 pointer-events-none rounded-full" />
                </div>
                <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                    <span>Left</span>
                    <button
                        type="button"
                        aria-label="Center horizontally"
                        onClick={() => onPosition({ ...position, x: 0.5 })}
                        className="hover:text-stone-800 underline decoration-dotted transition-colors"
                    >
                        Center
                    </button>
                    <span>Right</span>
                </div>
            </div>

            {/* Vertical Slider */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <VerticalMoveIcon size={14} className="text-stone-500" />
                        Vertical
                    </span>
                    <span className="text-[11px] font-medium text-stone-700 tabular-nums bg-white px-2 py-0.5 rounded shadow-xs border border-stone-200">
                        {verticalBadge}
                    </span>
                </div>
                <div className="relative flex items-center">
                    <input
                        className="w-full h-1.5 accent-fw-gold cursor-pointer bg-stone-200 rounded-lg appearance-none"
                        aria-label="Vertical position"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={posY}
                        onChange={e => handleVerticalChange(e.target.value)}
                    />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-stone-400/80 pointer-events-none rounded-full" />
                </div>
                <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                    <span>Top</span>
                    <button
                        type="button"
                        aria-label="Center vertically"
                        onClick={() => onPosition({ ...position, y: 0.5 })}
                        className="hover:text-stone-800 underline decoration-dotted transition-colors"
                    >
                        Center
                    </button>
                    <span>Bottom</span>
                </div>
            </div>

            {/* Quick Presets */}
            <div className="pt-2 border-t border-stone-200/70 flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        aria-label="Center artwork"
                        onClick={() => onPosition({ ...position, x: 0.5, y: 0.5 })}
                        className="px-2 py-1 text-[11px] font-semibold bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-200 shadow-xs transition-colors"
                    >
                        Center
                    </button>
                    <button
                        type="button"
                        onClick={() => onPosition({ ...position, zoom: 1 })}
                        className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                            Math.abs(currentZoom - 1) < 0.02
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 shadow-xs'
                        }`}
                    >
                        Fit (1.0×)
                    </button>
                    {maxZoom >= 1.25 && (
                        <button
                            type="button"
                            onClick={() => onPosition({ ...position, zoom: 1.25 })}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                                Math.abs(currentZoom - 1.25) < 0.05
                                    ? 'bg-stone-900 text-white border-stone-900'
                                    : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 shadow-xs'
                            }`}
                        >
                            1.25×
                        </button>
                    )}
                    {maxZoom >= 1.5 && (
                        <button
                            type="button"
                            onClick={() => onPosition({ ...position, zoom: 1.5 })}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                                Math.abs(currentZoom - 1.5) < 0.05
                                    ? 'bg-stone-900 text-white border-stone-900'
                                    : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 shadow-xs'
                            }`}
                        >
                            1.5×
                        </button>
                    )}
                    {maxZoom >= 2 && (
                        <button
                            type="button"
                            onClick={() => onPosition({ ...position, zoom: 2 })}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                                Math.abs(currentZoom - 2) < 0.05
                                    ? 'bg-stone-900 text-white border-stone-900'
                                    : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 shadow-xs'
                            }`}
                        >
                            2.0×
                        </button>
                    )}
                </div>
                {!isDefault && (
                    <button
                        type="button"
                        onClick={() => onPosition(DEFAULT_POSITION)}
                        className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </div>
        </div>

        {undo && <button type="button" className="text-xs flex items-center gap-1 text-stone-600 hover:text-stone-900" onClick={() => { onApply(undo); setUndo(null); }}><RotateCcw size={14} />Undo fit change</button>}

        {compare && createPortal(<div className="fixed inset-0 z-[200] text-stone-900 bg-black/50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === 'Escape') setCompare(false); }}>
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Best fit options" onKeyDown={event => {
                if (event.key !== 'Tab') return;
                const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
                const first = buttons[0], last = buttons.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }} className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-auto p-5 space-y-4">
                <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Best Fit</h2>
                    <button type="button" aria-label="Close best fit options" onClick={() => setCompare(false)}><X size={20} /></button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="space-y-3">{preview(geometry)}<p className="text-sm font-semibold">Current Frame</p>
                        <p className="text-xs">{formatDimensions(size.label, unit, orientation)} · {geometry.width === geometry.height ? 'Square' : orientation === 'landscape' ? 'Landscape' : 'Portrait'} · {mat === 'none' ? 'No Mount' : `${(Number(mat) * (unit === 'cm' ? 2.54 : 1)).toFixed(1)} ${unit} mount`}</p>
                        <Price amount={price} currency={currency} />
                        <p className="text-xs">{Math.floor((imageCrop(natural, geometry, position, minimumDpi)?.retained || 0) * 100)}% of image visible</p>
                    </div>
                    {options.map((option, i) => <div key={i} className="space-y-3">
                        <button type="button" className="block w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-stone-900 hover:opacity-90"
                            aria-label={`Apply ${formatDimensions(option.size.label, unit, option.orientation)}, ${option.mat === 'none' ? 'no mount' : 'with mount'}`}
                            onClick={() => applyOption(option)}>{preview(option.geometry, DEFAULT_POSITION)}</button>
                        <p className="text-sm font-semibold">{formatDimensions(option.size.label, unit, option.orientation)} · {option.geometry.width === option.geometry.height ? 'Square' : option.orientation === 'landscape' ? 'Landscape' : 'Portrait'}</p>
                        <p className="text-xs">{Math.floor(option.retained * 100)}% of image visible · {option.mat === 'none' ? 'No Mount' : `${(Number(option.mat) * (unit === 'cm' ? 2.54 : 1)).toFixed(1)} ${unit} mount`}</p>
                        {option.price !== null ? (
                            <Price amount={option.price} currency={currency} />
                        ) : (
                            <span className="text-xs font-semibold text-stone-600">Live quote on apply</span>
                        )}
                        <button type="button" className="flex items-center gap-1 text-sm font-semibold" onClick={() => applyOption(option)}><Check size={15} />Apply</button>
                    </div>)}
                </div>
                {options.length === 0 && <p className="text-sm text-stone-600">No alternative fits available.</p>}
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            </div>
        </div>, document.body)}
    </section>;
}
