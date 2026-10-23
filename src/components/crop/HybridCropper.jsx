import React, { useState } from 'react';
import { Sliders, Maximize2, Sparkles, Move, Compass, Check } from 'lucide-react';
import DirectCanvasCropper from './DirectCanvasCropper';
import CropStudioModal from './CropStudioModal';
import SmartAlignmentPad from './SmartAlignmentPad';
import { DEFAULT_POSITION, MIN_CROP_DPI } from '../../utils/frameFit';

/**
 * Concept 4: The Hybrid Flow
 *
 * Seamlessly combines:
 * 1. Immediate tactile on-frame canvas dragging & wheel zoom for fast natural adjustments.
 * 2. On-frame "Precision Studio" button launching the dedicated aperture modal for uncropped context & corner handles.
 * 3. Compact sidebar alignment joypad for structured 1-click positioning.
 */
export default function HybridCropper({
    image,
    natural,
    geometry,
    position = DEFAULT_POSITION,
    onPositionChange,
    frame,
    matColor = '#faf9f5',
    minimumDpi = MIN_CROP_DPI,
    frameTitle = 'Custom Frame',
    sizeLabel = '',
    className = ''
}) {
    const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
    const [showSidebarPad, setShowSidebarPad] = useState(true);

    return (
        <div className={`relative flex flex-col gap-6 ${className}`}>
            {/* Top Toolbar / Mode Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                        Hybrid Canvas & Precision Studio
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Toggle Sidebar Joypad */}
                    <button
                        type="button"
                        onClick={() => setShowSidebarPad(!showSidebarPad)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                            showSidebarPad
                                ? 'bg-stone-200 text-stone-900'
                                : 'bg-stone-100 text-stone-600 hover:text-stone-900'
                        }`}
                        title="Toggle 9-point joypad drawer"
                    >
                        <Compass size={14} />
                        <span>{showSidebarPad ? 'Hide Joypad' : 'Show Joypad'}</span>
                    </button>

                    {/* Launch Studio Modal */}
                    <button
                        type="button"
                        onClick={() => setIsStudioModalOpen(true)}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all hover:scale-105"
                        title="Open full precision studio with uncropped context and DPI meter"
                    >
                        <Maximize2 size={13} />
                        <span>Precision Studio</span>
                    </button>
                </div>
            </div>

            {/* Split / Main Stage */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Visualizer Canvas Area (Direct On-Frame Dragging) */}
                <div className={`${showSidebarPad ? 'lg:col-span-8' : 'lg:col-span-12'} relative`}>
                    <div className="relative group">
                        <DirectCanvasCropper
                            image={image}
                            natural={natural}
                            geometry={geometry}
                            position={position}
                            onPositionChange={onPositionChange}
                            frame={frame}
                            matColor={matColor}
                            minimumDpi={minimumDpi}
                        />

                        {/* Top-Right Quick Studio Pill directly on the visualizer */}
                        <div className="absolute top-6 right-6 z-40 hidden sm:block">
                            <button
                                type="button"
                                onClick={() => setIsStudioModalOpen(true)}
                                className="bg-stone-900/85 hover:bg-stone-900 backdrop-blur-md text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-400/60 shadow-xl px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all hover:scale-105"
                            >
                                <Sliders size={13} />
                                <span>Adjust in Studio</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Collapsible Sidebar: 9-Point Smart Pad */}
                {showSidebarPad && (
                    <div className="lg:col-span-4 space-y-4">
                        <SmartAlignmentPad
                            image={image}
                            natural={natural}
                            geometry={geometry}
                            position={position}
                            onPositionChange={onPositionChange}
                            minimumDpi={minimumDpi}
                        />
                    </div>
                )}
            </div>

            {/* Dedicated Precision Studio Modal (Concept 2 integration) */}
            <CropStudioModal
                isOpen={isStudioModalOpen}
                onClose={() => setIsStudioModalOpen(false)}
                onApply={(newPos) => onPositionChange(newPos)}
                image={image}
                natural={natural}
                geometry={geometry}
                initialPosition={position}
                frameTitle={frameTitle}
                sizeLabel={sizeLabel}
                minimumDpi={minimumDpi}
            />
        </div>
    );
}
