import React, { useState, useRef, useEffect } from 'react';
import { framesForCategory, categoryForFrame, displayCategoryName, displayFrameName, frameStartingPriceDisplay, frameCategoryDescription, PRODIGI_FRAME_CATEGORIES } from '../data/frameBrowsing';

export default function FrameSelectionModal({ isOpen, onClose, selectedFrame, onSelect }) {
    const [activeCategory, setActiveCategory] = useState(() => {
        const savedCategory = categoryForFrame(selectedFrame);
        return PRODIGI_FRAME_CATEGORIES.includes(savedCategory) ? savedCategory : PRODIGI_FRAME_CATEGORIES[0];
    });
    const selectedCardRef = useRef(null);

    // Scrolls the current selection into view once, right after the grid for
    // its category has rendered — same "return to where you were" intent as
    // the category fix above, one level more precise. Empty deps: this
    // should fire once per mount (i.e. once per time the picker opens), not
    // re-fire on every render as the user browses other frames afterward.
    useEffect(() => {
        selectedCardRef.current?.scrollIntoView({ block: 'center' });
    }, []);

    if (!isOpen) return null;

    const filteredFrames = framesForCategory(activeCategory);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white">
            <div className="mx-auto w-full max-w-[2560px] px-6 lg:px-12 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-5 shrink-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Frame Catalogue</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Explore made-to-order frames and canvases across classic wood, deep box, slim aluminium, traditional canvas, floating canvas, recycled canvas and stretched canvas styles.</p>
                    </div>
                    <button onClick={onClose} className="mt-1 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" aria-label="Close">
                    ✕
                    </button>
                </div>
            </div>

            {/* Categories */}
            <div className="border-b border-stone-100 bg-white shrink-0">
                <div className="mx-auto w-full max-w-[2560px] px-6 lg:px-12">
                <div className="flex overflow-x-auto gap-2 pb-3 hide-scrollbar">
                    {PRODIGI_FRAME_CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            aria-pressed={activeCategory === cat}
                            className={`shrink-0 whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${activeCategory === cat ? 'bg-stone-900 text-white shadow-md' : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                        >
                            {displayCategoryName(cat)}
                        </button>
                    ))}
                </div>
                <p aria-live="polite" className="pb-4 text-sm leading-6 text-stone-600">
                    {frameCategoryDescription(activeCategory)}
                </p>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain px-6 lg:px-12 pt-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-white">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-[2560px] mx-auto">
                    {filteredFrames.map(f => (
                        <button
                            key={f.id}
                            ref={selectedFrame?.id === f.id ? selectedCardRef : null}
                            onClick={() => { onSelect(f); onClose(); }}
                            className={`group flex flex-col bg-white text-left transition-all ${selectedFrame?.id === f.id ? 'rounded-2xl ring-2 ring-stone-900 ring-offset-2' : ''}`}
                        >
                            <div className="aspect-square bg-stone-100 overflow-hidden relative rounded-2xl">
                                <img
                                    src={f.thumbnailImage || f.cornerImage || f.previewImg || `/frames/${f.filename}`}
                                    alt={f.name}
                                    loading="lazy"
                                    decoding="async"
                                    style={f.thumbnailCrop ? {
                                        transform: `scale(${f.thumbnailCrop.scale})`,
                                        transformOrigin: f.thumbnailCrop.origin,
                                    } : undefined}
                                    className={f.thumbnailImage && !f.thumbnailCrop
                                        ? 'w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]'
                                        : 'w-full h-full object-cover scale-[1.65] origin-[50%_68%] transition-transform duration-700 group-hover:scale-[1.78]'}
                                />
                                <div className="absolute inset-0 shadow-[inset_0_0_46px_12px_rgba(28,26,23,0.18)] pointer-events-none" />
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/10 transition-opacity duration-300" />
                                {selectedFrame?.id === f.id && (
                                    <div className="absolute top-2 right-2 bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</div>
                                )}
                            </div>
                            <div className="pt-3 text-left">
                                <h3 className="text-sm font-bold text-stone-900 leading-tight line-clamp-2">{displayFrameName(f)}</h3>
                                <p className="mt-1.5 text-xs text-stone-500">{frameStartingPriceDisplay(f)}</p>
                            </div>
                        </button>
                    ))}
                </div>
                {filteredFrames.length === 0 && (
                    <div className="py-20 text-center text-gray-400 text-sm">
                        No frames available in this category.
                    </div>
                )}
            </div>
        </div>
    );
}
