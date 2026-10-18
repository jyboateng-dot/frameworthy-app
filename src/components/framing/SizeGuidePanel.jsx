import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SIZE_GUIDE_ENTRIES, SCALE_REFERENCES } from '../../data/sizeGuide';
import { formatDimensions } from '../../data/constants';
import { MIN_PRINT_DPI, doesSizeMeetMinDpi } from '../../utils/museumArtwork';
import womanFigure from '../../assets/scaleFigures/woman.png';
import manFigure from '../../assets/scaleFigures/man.png';

// Layout (percentage-based scene, fixed scale-then-grow illustration box,
// sticky-then-lock scroll behavior on mobile) is bespoke to this panel,
// but the surface styling — white panel, stone-200 borders, stone-900/500
// text, fw-gold accents, rounded-2xl/rounded-full, lucide close icon —
// matches the rest of the app's modals (see AuthModal, MetArtSelectionModal,
// OrderDetailModal) rather than a standalone palette.

const toInchesQuotes = (label, orientation) => {
    const words = formatDimensions(label, 'in', orientation);
    const match = words.match(/^(-?\d+(?:\.\d+)?) × (-?\d+(?:\.\d+)?) in(.*)$/);
    if (!match) return words;
    return `${match[1]}" × ${match[2]}"${match[3]}`;
};

// Same trailing-".00" stripping as bymuseum's own money(), in GHS rather
// than USD.
const money = (n) => `GHS ${n.toFixed(2).replace(/\.00$/, '')}`;

// Real reference-figure illustrations rather than a hand-built vector
// shape — each is a tightly-cropped standing-figure silhouette (head to
// feet, no baked-in margin) so the image's own height maps directly onto
// the scale below with nothing to measure/crop for floor alignment.
// nativeAspect (width/height) comes straight from each PNG's own pixel
// dimensions and is used to size the figure without distortion — the box
// is driven by height (from the real-world scale) with width following
// the image's actual proportions, not a shared/guessed silhouette width.
const REFERENCE_FIGURES = {
    man: { src: manFigure, nativeAspect: 55 / 208, shortLabel: '5\'11"' },
    woman: { src: womanFigure, nativeAspect: 66 / 197, shortLabel: '5\'7"' },
};

// Virtual scene coordinate space the whole illustration is laid out in,
// then converted to percentages of the scene box — the same technique
// bymuseum's own render() uses (setDim() writes left/top/height as
// percentages of its reference image's pixel dimensions). Width is fixed;
// height is computed per render from the fixed scale (see PX_PER_IN)
// since it's the box that adapts to a large frame, not the scale.
const SCENE_W = 300;

const DimLine = ({ leftPct, topPct, heightPct, label, side, dotted }) => (
    <div
        className={`fw-dimline${dotted ? ' dotted' : ''} ${side === 'left' ? 'label-left' : 'label-right'}`}
        style={{ left: `${leftPct}%`, top: `${topPct}%`, height: `${heightPct}%` }}
    >
        <span className="fw-dimline-label">{label}</span>
    </div>
);

// One constant real-world-to-pixel scale, calibrated once from the taller
// of the two reference people — not recalculated per selected size. That
// matters: an earlier version derived the scale from
// max(personHeight, frameHeight) each render, so a large frame shrank the
// *scale itself*, making the person and console look smaller too. That
// breaks the entire point of a scale reference — comparing two different
// frame sizes has to hold the person and console fixed and let only the
// frame change, the same way bymuseum's own render() derives its
// px-per-cm once from the reference photo's fixed calibration, never from
// the currently selected size. Also fixed to the *taller* person (not
// whichever is currently toggled) so switching W/M changes who's shown,
// not the ruler both are measured against.
const TALLEST_PERSON_IN = Math.max(SCALE_REFERENCES.man.heightIn, SCALE_REFERENCES.woman.heightIn);
const HEADROOM_IN = 10;
const ILLUSTRATION_HEIGHT_PX = 260;
const PX_PER_IN = ILLUSTRATION_HEIGHT_PX / (TALLEST_PERSON_IN + HEADROOM_IN);

const Scene = ({ selectedSize, reference, orientation }) => {
    const ref = SCALE_REFERENCES[reference];
    const figure = REFERENCE_FIGURES[reference] || REFERENCE_FIGURES.woman;
    const consoleHeightIn = SCALE_REFERENCES.consoleHeightIn;
    const frameWidthIn = orientation === 'landscape'
        ? (selectedSize?.height || 20)
        : (selectedSize?.width || 16);
    const frameHeightIn = orientation === 'landscape'
        ? (selectedSize?.width || 16)
        : (selectedSize?.height || 20);
    const wallMountHeightIn = consoleHeightIn + 6;

    // The scene's own height is what adapts — not the scale — so an
    // oversized frame simply makes the illustration box taller (the card
    // around it already scrolls) rather than shrinking everyone else to
    // force a fit.
    const requiredHeightIn = Math.max(TALLEST_PERSON_IN, wallMountHeightIn + frameHeightIn) + HEADROOM_IN;
    const sceneHeightPx = requiredHeightIn * PX_PER_IN;
    const pxPerIn = PX_PER_IN;

    const floorY = sceneHeightPx;
    const personHeightPx = ref.heightIn * pxPerIn;
    const personWidthPx = personHeightPx * figure.nativeAspect;
    const consoleHeightPx = consoleHeightIn * pxPerIn;
    const tableTopPx = Math.max(consoleHeightPx * 0.06, 3);
    const frameWidthPx = frameWidthIn * pxPerIn;
    const frameHeightPx = frameHeightIn * pxPerIn;
    const frameBottomY = floorY - wallMountHeightIn * pxPerIn;
    const frameTopY = frameBottomY - frameHeightPx;

    const consoleWidthPx = 100;
    const consoleX = 150;
    const frameX = consoleX + consoleWidthPx / 2 - frameWidthPx / 2;
    const personX = 70;
    const personLeftPx = personX - personWidthPx / 2;

    const pct = (v, axis) => (v / (axis === 'x' ? SCENE_W : sceneHeightPx)) * 100;

    return (
        <div className="fw-scene-wrap" style={{ aspectRatio: `${SCENE_W} / ${sceneHeightPx}` }}>
            {/* Floor line */}
            <div style={{ position: 'absolute', left: `${pct(10, 'x')}%`, right: `${100 - pct(290, 'x')}%`, top: `${pct(floorY, 'y')}%`, borderTop: '1.5px solid #d6d3d1' }} />

            {/* Person — a real reference-figure illustration, cropped tight
                to head-and-feet so it sits flush on the floor line with no
                extra measuring. bymuseum's equivalent is a baked photo of
                a person standing next to a console; that asset is theirs,
                so the console/frame here are drawn as their own
                absolutely-positioned elements below, using the same
                percentage-of-scene layout as bymuseum's actual render()
                logic. */}
            <img
                src={figure.src}
                alt=""
                style={{
                    position: 'absolute',
                    left: `${pct(personLeftPx, 'x')}%`,
                    top: `${pct(floorY - personHeightPx, 'y')}%`,
                    width: `${pct(personWidthPx, 'x')}%`,
                    height: `${pct(personHeightPx, 'y')}%`,
                }}
            />
            <DimLine
                leftPct={pct(personLeftPx - 12, 'x')}
                topPct={pct(floorY - personHeightPx, 'y')}
                heightPct={pct(personHeightPx, 'y')}
                label={figure.shortLabel}
                side="left"
                dotted
            />

            {/* Console */}
            <div style={{
                position: 'absolute',
                left: `${pct(consoleX, 'x')}%`,
                top: `${pct(floorY - consoleHeightPx - tableTopPx, 'y')}%`,
                width: `${pct(consoleWidthPx, 'x')}%`,
                height: `${pct(tableTopPx, 'y')}%`,
                background: '#44403c',
            }} />
            <div style={{ position: 'absolute', left: `${pct(consoleX + 8, 'x')}%`, top: `${pct(floorY - consoleHeightPx, 'y')}%`, height: `${pct(consoleHeightPx, 'y')}%`, borderLeft: '3px solid #44403c' }} />
            <div style={{ position: 'absolute', left: `${pct(consoleX + consoleWidthPx - 8, 'x')}%`, top: `${pct(floorY - consoleHeightPx, 'y')}%`, height: `${pct(consoleHeightPx, 'y')}%`, borderLeft: '3px solid #44403c' }} />
            <DimLine
                leftPct={pct(consoleX + consoleWidthPx + 12, 'x')}
                topPct={pct(floorY - consoleHeightPx, 'y')}
                heightPct={pct(consoleHeightPx, 'y')}
                label={SCALE_REFERENCES.consoleDisplay.split(' (')[0]}
                side="right"
            />

            {/* Painting — repositions/resizes with a transition when the
                selected size changes, matching bymuseum's own overlay. */}
            <div
                className="fw-painting-overlay"
                style={{
                    left: `${pct(frameX, 'x')}%`,
                    top: `${pct(frameTopY, 'y')}%`,
                    width: `${pct(frameWidthPx, 'x')}%`,
                    height: `${pct(frameHeightPx, 'y')}%`,
                }}
            />
            <DimLine
                leftPct={pct(frameX + frameWidthPx + 12, 'x')}
                topPct={pct(frameTopY, 'y')}
                heightPct={pct(frameHeightPx, 'y')}
                label={`${frameWidthIn}" × ${frameHeightIn}"`}
                side="right"
            />
        </div>
    );
};

const SizeGuidePanel = ({ currentSize, orientation, imageNaturalSize = null, onSelect, unit, onClose }) => {
    const [reference, setReference] = useState('woman');
    const [customWidthCm, setCustomWidthCm] = useState('');
    const [customHeightCm, setCustomHeightCm] = useState('');
    const rowRefs = useRef({});
    const tableScrollRef = useRef(null);
    const dialogRef = useRef(null);
    const closeButtonRef = useRef(null);

    const availableEntries = SIZE_GUIDE_ENTRIES.filter(
        (entry) => !imageNaturalSize || doesSizeMeetMinDpi(entry, imageNaturalSize, MIN_PRINT_DPI)
    );
    const sameSize = (a, b) => a && b && a.width === b.width && a.height === b.height;
    const selectedEntry = currentSize ? availableEntries.find(e => sameSize(e, currentSize)) : null;

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButtonRef.current?.focus();

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) return;
            const focusable = dialogRef.current.querySelectorAll(
                'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousBodyOverflow;
            if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
        };
    }, [onClose]);

    useEffect(() => {
        const key = selectedEntry?.id;
        const row = key && rowRefs.current[key];
        const container = tableScrollRef.current;
        if (row && container) {
            container.scrollTop = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2;
        }
    }, [selectedEntry?.id]);

    const ref = SCALE_REFERENCES[reference];
    const currentOrientation = currentSize?.width === currentSize?.height
        ? 'square'
        : (orientation || currentSize?.orientation || 'portrait');
    const parsedCustomWidth = Number(customWidthCm);
    const parsedCustomHeight = Number(customHeightCm);
    const customSizeInBounds = Number.isFinite(parsedCustomWidth) && Number.isFinite(parsedCustomHeight)
        && parsedCustomWidth >= 13 && parsedCustomWidth <= 180
        && parsedCustomHeight >= 13 && parsedCustomHeight <= 180;
    const customCandidate = customSizeInBounds ? {
        id: `custom-preview-${parsedCustomWidth}x${parsedCustomHeight}`,
        width: Math.min(parsedCustomWidth, parsedCustomHeight) / 2.54,
        height: Math.max(parsedCustomWidth, parsedCustomHeight) / 2.54,
        label: `${parsedCustomWidth} x ${parsedCustomHeight} cm`,
        orientation: parsedCustomWidth === parsedCustomHeight
            ? 'square'
            : (parsedCustomWidth > parsedCustomHeight ? 'landscape' : 'portrait'),
    } : null;
    const customMeetsDpi = !customCandidate || !imageNaturalSize || doesSizeMeetMinDpi(customCandidate, imageNaturalSize, MIN_PRINT_DPI);
    const customSizeIsValid = customSizeInBounds && customMeetsDpi;
    const customPreview = customSizeIsValid ? customCandidate : null;
    const previewSize = customPreview || currentSize;
    const previewOrientation = customPreview?.orientation || currentOrientation;
    const previewOrientationLabel = previewOrientation.charAt(0).toUpperCase() + previewOrientation.slice(1);

    // Portaled to document.body rather than rendered in place: this panel
    // is triggered from deep inside CustomizeFramePage's visualizer/
    // dashboard tree, where an ancestor's transform/blur/shadow can open a
    // new stacking context and cap this panel's effective z-index below
    // sibling UI (e.g. the sticky checkout footer) despite z-[200] here.
    // Portaling to body escapes that entirely.
    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-[10px] sm:p-7 overflow-y-auto bg-black/40 backdrop-blur-sm"
            style={{ animation: 'fwScrimIn .18s ease' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <style>{`
                @keyframes fwScrimIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes fwPanelIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
                /* overflow stays visible, not hidden — the left dimline
                   label sits close enough to the scene's own left edge
                   that its text (e.g. "5'7"") got clipped by a hidden
                   overflow before the browser even had a chance to lay
                   the rest of it out. Nothing else in the scene is meant
                   to extend past 0-100% of this box (the person, console,
                   and painting are all kept in bounds by construction),
                   so nothing else relies on the clip -- except the right-
                   side frame-size label for an oversized frame selection,
                   which has the same latent overflow risk this also
                   fixes. */
                .fw-scene-wrap { position: relative; width: 100%; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 8px; overflow: visible; }
                .fw-painting-overlay { position: absolute; background: #ffffff; border: 2px solid #c9a84c; box-shadow: 0 4px 16px rgba(0,0,0,.18); transition: left .18s ease, top .18s ease, width .18s ease, height .18s ease; }
                .fw-dimline { position: absolute; width: 0; border-left: 1.5px solid #a8a29e; transition: left .18s ease, top .18s ease, height .18s ease; }
                .fw-dimline.dotted { border-left-style: dotted; }
                .fw-dimline::before, .fw-dimline::after { content: ''; position: absolute; left: -4px; width: 8px; height: 0; border-top: 1.5px solid #a8a29e; }
                .fw-dimline::before { top: 0; }
                .fw-dimline::after { bottom: 0; }
                .fw-dimline-label { position: absolute; font-size: 11px; color: #78716c; white-space: nowrap; top: 50%; transform: translateY(-50%); }
                .fw-dimline.label-left .fw-dimline-label { right: 8px; }
                .fw-dimline.label-right .fw-dimline-label { left: 8px; }
                .fw-row:hover { background: #f5f5f4; }
                .fw-row.is-active { background: rgba(201, 168, 76, .14); }
                .fw-row.is-active:hover { background: rgba(201, 168, 76, .2); }
                /* The accent bar lives in the table's own left gutter (the
                   surrounding px-[26px] padding) via a negative offset,
                   rather than inset on the row itself — the first column
                   has no left padding of its own (it's flush against the
                   row edge, same edge an inset box-shadow would sit on),
                   so the bar was drawn right on top of the size text. */
                .fw-row.is-active td:first-child { color: #a3812f; font-weight: 600; position: relative; }
                .fw-row.is-active td:first-child::before { content: ''; position: absolute; left: -14px; top: 0; bottom: 0; width: 3px; background: #c9a84c; }
            `}</style>
            <div
                className="relative w-full max-w-[1160px] max-h-[86vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-white text-stone-900 border border-stone-200 shadow-2xl"
                style={{ animation: 'fwPanelIn .22s cubic-bezier(.2,.8,.2,1)' }}
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="size-guide-title"
            >
                <button
                    onClick={onClose}
                    aria-label="Close size guide"
                    ref={closeButtonRef}
                    className="absolute top-[18px] right-[18px] z-30 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer bg-white border border-stone-300 shadow-sm hover:bg-stone-100 hover:border-stone-400 text-stone-600 transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Not sticky on mobile — the scene section below is what
                    should lock at the top there (see below), and it needs
                    the header to actually scroll away first rather than
                    permanently occupying top:0, or the two would compete
                    for the same space. Desktop keeps the header pinned as
                    before: its own content there doesn't scroll far enough
                    for this to come up in practice, but it matches the
                    original always-visible title bar. */}
                <div className="md:sticky md:top-0 md:z-20 bg-white border-b border-stone-200 pt-[22px] pr-20 pb-4 pl-[26px] flex items-start justify-between gap-2.5 flex-wrap">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-fw-gold m-0 mb-1.5">Size guide</p>
                        <h2 id="size-guide-title" className="font-serif text-[22px] font-bold text-stone-900 mb-1" style={{ letterSpacing: '-.01em' }}>Find the right frame size</h2>
                        <p className="text-[12.5px] text-stone-500 m-0">See this piece next to a reference figure and a {SCALE_REFERENCES.consoleDisplay} console, at every size.</p>
                    </div>
                    <div className="inline-flex shrink-0 rounded-full p-0.5 border border-stone-200 bg-white">
                        <button
                            onClick={() => setReference('woman')}
                            className={`text-[11px] font-semibold px-[11px] py-[5px] min-w-[30px] text-center rounded-full transition-colors ${reference === 'woman' ? 'bg-stone-900 text-white' : 'bg-transparent text-stone-500'}`}
                            aria-label="Woman"
                        >W</button>
                        <button
                            onClick={() => setReference('man')}
                            className={`text-[11px] font-semibold px-[11px] py-[5px] min-w-[30px] text-center rounded-full transition-colors ${reference === 'man' ? 'bg-stone-900 text-white' : 'bg-transparent text-stone-500'}`}
                            aria-label="Man"
                        >M</button>
                    </div>
                </div>

                {/* md:h-[520px] bounds this row so each column scrolls on
                    its own — without a bounded height, overflow-y-auto on
                    the table column has nothing to trigger against, so the
                    whole card scrolled as one unit and dragged the scene
                    column up out of view along with the table. Below md
                    (stacked layout) there's no side-by-side column to keep
                    bounded — instead the scene section itself is sticky at
                    top:0 (see below), and the header above it is plain
                    flow rather than sticky there, so scrolling starts out
                    moving the whole page normally (header, readout, scene,
                    table all together) and only locks the scene in place
                    once its own top edge reaches the very top of the
                    screen, rather than pinning it under a permanently
                    visible header from the first pixel of scroll. That
                    needs plain flex-column here rather than grid: CSS Grid
                    auto-places each child into its own implicit row, so a
                    sticky grid item's containing block is confined to just
                    its own row — which is exactly its own height, leaving
                    no room to actually stick. A flex column's containing
                    block is the whole flex container (scene + table
                    combined), so the scene section has real room to stay
                    pinned while the table scrolls past underneath it. */}
                <div className="flex flex-col md:grid md:grid-cols-[1.05fr_1fr] md:h-[520px] md:overflow-hidden min-w-0">
                    <div
                        className="sticky top-0 z-10 md:static min-w-0 md:h-full md:overflow-y-auto bg-white border-b border-stone-200 px-[26px] pt-[26px] pb-[18px] flex flex-col gap-[14px]"
                    >
                        {previewSize && (
                            <div className="flex items-baseline gap-[10px]">
                                <span className="font-serif font-bold text-[22px] text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
                                    {unit === 'in' ? toInchesQuotes(previewSize.label, previewOrientation) : formatDimensions(previewSize.label, 'cm', previewOrientation)}
                                </span>
                                <span className="text-[11px] uppercase tracking-[.08em] text-stone-400">{previewOrientationLabel}</span>
                                {customPreview
                                    ? <span className="text-[12.5px] text-fw-gold" style={{ letterSpacing: '.02em' }}>Custom preview</span>
                                    : selectedEntry?.bestFor && <span className="text-[12.5px] text-fw-gold" style={{ letterSpacing: '.02em' }}>{selectedEntry.bestFor}</span>}
                            </div>
                        )}
                        <Scene selectedSize={previewSize} reference={reference} orientation={previewOrientation} />
                        <p className="text-[12px] text-stone-500 m-0">
                            Reference figure: <b>{ref.label}, {ref.heightDisplay}</b> · console at <b>{SCALE_REFERENCES.consoleDisplay}</b>
                        </p>
                    </div>

                    <div ref={tableScrollRef} className="min-w-0 md:h-full overflow-y-auto px-[26px] pt-[26px] pb-[18px]">
                        <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="m-0 text-sm font-semibold text-stone-800">Try a custom size</p>
                                    <p className="m-0 mt-1 text-[12px] leading-4 text-stone-500">Preview any frame between 13 and 180 cm.</p>
                                </div>
                                {customPreview && <span className="rounded-full bg-fw-gold px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-white">Previewing</span>}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <label className="text-[11px] font-medium text-stone-600">Width (cm)
                                    <input type="number" min="13" max="180" step="0.1" inputMode="decimal" value={customWidthCm} onChange={(event) => setCustomWidthCm(event.target.value)} placeholder="Width" className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-colors focus:border-fw-gold focus:ring-2 focus:ring-fw-gold/20" />
                                </label>
                                <label className="text-[11px] font-medium text-stone-600">Height (cm)
                                    <input type="number" min="13" max="180" step="0.1" inputMode="decimal" value={customHeightCm} onChange={(event) => setCustomHeightCm(event.target.value)} placeholder="Height" className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-colors focus:border-fw-gold focus:ring-2 focus:ring-fw-gold/20" />
                                </label>
                            </div>
                            {((customWidthCm || customHeightCm) && !customSizeInBounds) && <p className="m-0 mt-2 text-[11px] text-red-700" role="alert">Enter both dimensions from 13 to 180 cm.</p>}
                            {(customSizeInBounds && !customMeetsDpi) && <p className="m-0 mt-2 text-[11px] text-red-700" role="alert">This image's resolution cannot support that size at {MIN_PRINT_DPI} DPI.</p>}
                            {customPreview && <button type="button" onClick={() => onSelect(customPreview)} className="mt-3 w-full cursor-pointer rounded-lg bg-stone-900 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-stone-700">Use this custom size</button>}
                        </div>
                        <p className="text-[12.5px] text-stone-500 m-0 mb-2">All sizes for this piece</p>
                        <table className="w-full border-collapse table-fixed">
                            <colgroup>
                                <col className="w-[80px] md:w-[132px]" />
                                <col className="w-[72px] md:w-[118px]" />
                                <col className="w-[56px] md:w-[76px]" />
                                <col className="md:w-[190px]" />
                            </colgroup>
                            <thead><tr>
                                <th className="text-left font-medium text-sm text-stone-500 pb-2 pr-2.5 border-b border-stone-200 md:whitespace-nowrap">Size</th>
                                <th className="text-left font-medium text-sm text-stone-500 pb-2 pr-2.5 border-b border-stone-200 md:whitespace-nowrap">Inches</th>
                                <th className="text-left font-medium text-sm text-stone-500 pb-2 pr-2.5 border-b border-stone-200 md:whitespace-nowrap">Price</th>
                                <th className="text-left font-medium text-sm text-stone-500 pb-2 border-b border-stone-200 md:whitespace-nowrap">Best for</th>
                            </tr></thead>
                            <tbody>{availableEntries.map(entry => {
                                const isSelected = sameSize(entry, currentSize);
                                return <tr key={entry.id} ref={el => { rowRefs.current[entry.id] = el; }} onClick={() => onSelect(entry)} onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(entry); }
                                }} tabIndex={0} aria-label={`${formatDimensions(entry.label, 'cm', entry.orientation)}, ${money(entry.price)}, best for ${entry.bestFor}`} aria-selected={isSelected} className={`fw-row cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fw-gold${isSelected ? ' is-active' : ''}`}>
                                    <td className="py-[11px] pr-2.5 align-top text-sm border-b border-stone-200 md:whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDimensions(entry.label, 'cm', entry.orientation)}</td>
                                    <td className="py-[11px] pr-2.5 align-top text-sm border-b border-stone-200 md:whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{toInchesQuotes(entry.label, entry.orientation)}</td>
                                    <td className="py-[11px] pr-2.5 align-top text-sm border-b border-stone-200 md:whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(entry.price)}</td>
                                    <td className="py-[11px] align-top text-[12.5px] text-stone-500 border-b border-stone-200 md:whitespace-nowrap">{entry.bestFor}</td>
                                </tr>;
                            })}</tbody>
                        </table>
                        <div className="pt-4 mt-4 text-xs text-stone-500 border-t border-stone-200" style={{ lineHeight: 1.6 }}>
                            Every frame is built custom to fit. Moulding, matting, and glazing options are available in the steps below.
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SizeGuidePanel;
