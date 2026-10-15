import React, { useState, useRef, useEffect } from 'react';
import { framesForCategory, categoryForFrame, displayCategoryName, displayFrameName, PRODIGI_FRAME_CATEGORIES } from '../data/frameBrowsing';
import { getFrameDepthPresentation } from '../utils/frameDepthPresentation';

function FrameDepthIndicator({ frame }) {
    const { depthRatio, label } = getFrameDepthPresentation(frame);
    const side = 3 + depthRatio * 8;

    return (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-stone-700 shadow-sm backdrop-blur-sm">
            <svg aria-hidden="true" viewBox="0 0 30 20" className="h-3.5 w-5 overflow-visible">
                <rect x="2" y="2" width="14" height="14" rx="1" fill="white" stroke="currentColor" strokeWidth="1.2" />
                <path d={`M16 2 L${16 + side} 5 L${16 + side} 19 L16 16 Z`} fill="currentColor" opacity="0.3" />
                <path d={`M16 2 L${16 + side} 5 M${16 + side} 5 V19 L16 16`} fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span>{label}</span>
        </div>
    );
}

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!isOpen) return null;

    const filteredFrames = framesForCategory(activeCategory);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white">
            <div className="mx-auto w-full max-w-6xl px-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 shrink-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Curated Frame Collection</h2>
                        <p className="mt-2 max-w-xl text-sm leading-5 text-stone-500">Browse our frame collection, organized by design and material.</p>
                    </div>
                    <button onClick={onClose} className="mt-1 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" aria-label="Close">
                    ✕
                    </button>
                </div>
            </div>

            {/* Categories */}
            <div className="flex items-center overflow-x-auto no-scrollbar p-3.5 gap-1.5 border-b border-gray-50 bg-stone-50/50 shrink-0">
                {PRODIGI_FRAME_CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        aria-pressed={activeCategory === cat}
                        className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCategory === cat ? 'bg-black text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                    >
                        {displayCategoryName(cat)}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-white">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-6 max-w-6xl mx-auto">
                    {filteredFrames.map(f => (
                        <button
                            key={f.id}
                            ref={selectedFrame?.id === f.id ? selectedCardRef : null}
                            onClick={() => { onSelect(f); onClose(); }}
                            className={`group flex flex-col bg-white rounded-2xl overflow-hidden text-left transition-all ${selectedFrame?.id === f.id ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`}
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
                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                />
                                <FrameDepthIndicator frame={f} />
                                {selectedFrame?.id === f.id && (
                                    <div className="absolute top-2 right-2 bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</div>
                                )}
                            </div>
                            <div className="pt-3 text-left">
                                <h3 className="text-sm font-bold text-stone-900 leading-tight line-clamp-2">{displayFrameName(f)}</h3>
                                <p className="mt-1.5 text-xs text-stone-500">{displayCategoryName(f.category)}</p>
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
