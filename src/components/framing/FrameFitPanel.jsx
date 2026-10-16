import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Focus, RotateCcw, X, Check } from 'lucide-react';
import { FRAME_SIZES, formatDimensions } from '../../data/constants';
import { DEFAULT_POSITION, frameGeometry, imageCrop, cropStyle } from '../../utils/frameFit';
import { getFrameRail, getRailTextureStyle, getRailShading } from '../../utils/frameRail';
import { getFrameInnerShadow, getFrameWallShadow } from '../../utils/frameDepthPresentation';
import { bestFitOptions } from '../../utils/bestFitOptions';
import Price from '../common/Price';

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

export function FitPreview({ image, natural, geometry, position, frame, matColor }) {
    const crop = imageCrop(natural, geometry, position);
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
    availableSizes = FRAME_SIZES, prodigiConfiguration = {}, currency = 'GHS' }) {
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
    }), [availableSizes, natural, size, orientation, mat, rail, frame, price, matPrice, prodigiConfiguration]);
    const applyOption = option => {
        setUndo({ size, orientation, mat, position });
        onApply({ ...option, position: DEFAULT_POSITION });
        setCompare(false);
    };
    const preview = (g, p = position) => <FitPreview image={image} natural={natural} geometry={g}
        position={p} frame={frame} matColor={matColor} />;
    return <section className="space-y-3 text-stone-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex shrink-0 items-center justify-center text-[10px]">{step}</span>
                Image Position
            </h2>
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCompare(true)} className="text-xs text-stone-700 hover:text-stone-950 flex items-center gap-1 font-semibold"><Focus size={15} />Best Fit</button>
                <button type="button" className="w-7 h-7 flex items-center justify-center text-stone-600 hover:text-stone-950" title="Reset image position" aria-label="Reset image position" onClick={() => onPosition(DEFAULT_POSITION)}><RotateCcw size={15} /></button>
            </div>
        </div>
        {[['x', 'Horizontal', 0, 1, 0.01], ['y', 'Vertical', 0, 1, 0.01], ['zoom', 'Zoom', 1, 3, 0.01]].map(([key, label, min, max, step]) =>
            <label key={key} className="flex items-center gap-3 text-xs font-medium text-stone-700"><span className="w-16 shrink-0">{label}</span>
                <input className="w-full min-w-0 accent-fw-gold" aria-label={label} type="range" min={min} max={max} step={step}
                    value={position[key]} onChange={e => onPosition({ ...position, [key]: Number(e.target.value) })} /></label>)}
        {undo && <button type="button" className="text-xs flex items-center gap-1" onClick={() => { onApply(undo); setUndo(null); }}><RotateCcw size={14} />Undo fit change</button>}
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
                        <p className="text-xs">{Math.floor((imageCrop(natural, geometry, position)?.retained || 0) * 100)}% of image visible</p>
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
