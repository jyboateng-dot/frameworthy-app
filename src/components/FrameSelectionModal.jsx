import React, { useState } from 'react';
import { FRAME_STYLES, CATEGORIES } from '../data/constants';

export default function FrameSelectionModal({ isOpen, onClose, selectedFrame, onSelect }) {
    const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);

    if (!isOpen) return null;

    const filteredFrames = activeCategory === 'Most Popular'
        ? [
            FRAME_STYLES.find(f => f.id === 'frame-canvas'), // Gallery Wrapped Canvas
            FRAME_STYLES.find(f => f.id === 'frame-10512'), // Black Contemporary (lead)
            FRAME_STYLES.find(f => f.id === 'frame-10728'), // Flat White Deep
            FRAME_STYLES.find(f => f.id === 'frame-8446'),  // Flat Black Wide
            FRAME_STYLES.find(f => f.id === 'frame-10487'), // Natural Flat
            FRAME_STYLES.find(f => f.id === 'frame-10729'), // Flat Brown Deep
            FRAME_STYLES.find(f => f.id === 'frame-10592'), // Contemporary Walnut
            FRAME_STYLES.find(f => f.id === 'frame-11169'), // Gold Flat
            FRAME_STYLES.find(f => f.id === 'frame-10484'), // Cherry Flat
            FRAME_STYLES.find(f => f.id === 'frame-8752'),  // Flat Walnut Wide
            FRAME_STYLES.find(f => f.id === 'frame-8753'),  // Flat Mahogany Wide
            FRAME_STYLES.find(f => f.id === 'frame-10779'), // Glossy Black
          ].filter(Boolean)
        : FRAME_STYLES.filter(f => f.category === activeCategory);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white">
            <div className="flex justify-between items-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] border-b border-gray-100 shrink-0">
                <h2 className="text-xl font-bold tracking-tight text-stone-900">Select Frame Style</h2>
                <button onClick={onClose} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                    ✕
                </button>
            </div>

            {/* Categories */}
            <div className="flex items-center overflow-x-auto no-scrollbar p-3.5 gap-1.5 border-b border-gray-50 bg-stone-50/50 shrink-0">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCategory === cat ? 'bg-black text-white shadow-md' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-stone-50">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
                    {filteredFrames.map(f => (
                        <button
                            key={f.id}
                            onClick={() => { onSelect(f); onClose(); }}
                            className={`group flex flex-col bg-white rounded-lg overflow-hidden border transition-all ${selectedFrame?.id === f.id ? 'border-black ring-2 ring-black ring-offset-1 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
                        >
                            <div className="aspect-square bg-gray-50 overflow-hidden relative">
                                <img
                                    src={f.previewImg || `/frames/${f.filename}`}
                                    alt={f.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                {selectedFrame?.id === f.id && (
                                    <div className="absolute top-2 right-2 bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</div>
                                )}
                            </div>
                            <div className="p-2 text-left">
                                <h3 className="text-[10px] font-bold text-gray-900 leading-tight uppercase tracking-wider line-clamp-2">{f.name}</h3>
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
