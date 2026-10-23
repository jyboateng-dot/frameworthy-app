import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Crop,
    Sliders,
    Maximize2,
    Compass,
    Grid3X3,
    Layers,
    Image as ImageIcon,
    Upload,
    ArrowLeft,
    Check,
    RotateCcw,
    Sparkles,
    ShieldCheck,
    Smartphone,
    Monitor,
    Zap,
    LayoutGrid
} from 'lucide-react';

import DirectCanvasCropper from '../../components/crop/DirectCanvasCropper';
import CropStudioModal from '../../components/crop/CropStudioModal';
import SmartAlignmentPad from '../../components/crop/SmartAlignmentPad';
import HybridCropper from '../../components/crop/HybridCropper';
import CropMetricsBar from '../../components/crop/CropMetricsBar';

import {
    DEFAULT_POSITION,
    frameGeometry,
    imageCrop,
    MIN_CROP_DPI
} from '../../utils/frameFit';
import { getFrameRail } from '../../utils/frameRail';
import { PRODIGI_FRAME_STYLES, DEFAULT_PRODIGI_FRAME } from '../../data/frameBrowsing';

// Sample curated images with diverse aspect ratios & resolutions
const SAMPLE_PHOTOS = [
    {
        id: 'portrait',
        title: 'Editorial Portrait',
        ratioLabel: '3:4 Portrait',
        w: 2400,
        h: 3200,
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=2400&h=3200',
        desc: 'Vertical composition ideal for testing facial headroom and upper-third focal rules.'
    },
    {
        id: 'landscape',
        title: 'Coastal Valley Horizon',
        ratioLabel: '16:9 Landscape',
        w: 3840,
        h: 2160,
        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=3840&h=2160',
        desc: 'Wide panoramic landscape ideal for horizontal rule-of-thirds panning.'
    },
    {
        id: 'square',
        title: 'Minimalist Architecture',
        ratioLabel: '1:1 Square',
        w: 2400,
        h: 2400,
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=2400&h=2400',
        desc: 'Symmetrical square image to test aspect ratio transitions into rectangular frames.'
    },
    {
        id: 'panorama',
        title: 'Alpine Panorama',
        ratioLabel: '21:9 Ultra-Wide',
        w: 4200,
        h: 1800,
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=4200&h=1800',
        desc: 'Extreme wide aspect ratio testing maximum horizontal drag bounds.'
    }
];

const SANDBOX_SIZES = [
    { id: '8x10', width: 8, height: 10, label: '8 × 10 in (20 × 25 cm)' },
    { id: '12x18', width: 12, height: 18, label: '12 × 18 in (30 × 45 cm)' },
    { id: '16x20', width: 16, height: 20, label: '16 × 20 in (40 × 50 cm)' },
    { id: '24x36', width: 24, height: 36, label: '24 × 36 in (60 × 90 cm)' },
];

const CONCEPT_TABS = [
    {
        id: 'canvas',
        title: '1. Direct Canvas',
        icon: Zap,
        badge: 'Tactile 1:1 Drag',
        summary: 'Direct on-frame drag-to-pan, 1:1 pixel tracking, mouse-wheel zoom & auto-fading rule-of-thirds grid.'
    },
    {
        id: 'modal',
        title: '2. Precision Studio',
        icon: Maximize2,
        badge: 'Full Modal',
        summary: 'Dedicated darkroom aperture modal showing the entire uncropped image, illuminated cutout & live DPI gauge.'
    },
    {
        id: 'pad',
        title: '3. 9-Point Smart Pad',
        icon: Compass,
        badge: 'Sidebar Joypad',
        summary: 'Tactile 3×3 joypad and 2D miniature focal map for fast, deterministic 1-click positioning without dragging.'
    },
    {
        id: 'hybrid',
        title: '4. Hybrid Flow',
        icon: Sparkles,
        badge: 'Ultimate Flow',
        summary: 'Seamless union: direct on-frame canvas drag for quick tweaks + instant "Precision Studio" button for uncropped context.'
    },
    {
        id: 'compare',
        title: 'Compare All 4',
        icon: LayoutGrid,
        badge: 'Side-by-Side',
        summary: 'Review and compare all 4 cropping architectures side-by-side to evaluate ergonomics and user experience.'
    }
];

export default function CropSandboxPage() {
    const [activeTab, setActiveTab] = useState('canvas');
    const [selectedPhoto, setSelectedPhoto] = useState(SAMPLE_PHOTOS[0]);
    const [customPhotoUrl, setCustomPhotoUrl] = useState(null);
    const [customPhotoNatural, setCustomPhotoNatural] = useState(null);

    const [selectedSize, setSelectedSize] = useState(SANDBOX_SIZES[2]); // 16x20
    const [orientation, setOrientation] = useState('portrait');
    const [matWidth, setMatWidth] = useState(2); // 2 inches
    const [selectedFrame, setSelectedFrame] = useState(
        PRODIGI_FRAME_STYLES.find(f => f.id === 'prodigi-box-natural') || DEFAULT_PRODIGI_FRAME
    );

    // Crop position state
    const [fitPosition, setFitPosition] = useState(DEFAULT_POSITION);

    // For Concept 2 direct modal test in the tab
    const [isDedicatedModalOpen, setIsDedicatedModalOpen] = useState(false);

    const fileInputRef = useRef(null);

    // Active image data
    const activeImage = customPhotoUrl || selectedPhoto.url;
    const activeNatural = customPhotoNatural || { w: selectedPhoto.w, h: selectedPhoto.h };

    // Geometry & Crop calculations
    const railWidthIn = selectedFrame?.mouldingWidthIn || getFrameRail(selectedFrame)?.widthIn || (20 / 25.4);
    const geometry = useMemo(() => {
        return frameGeometry(selectedSize, orientation, matWidth === 0 ? 'none' : matWidth, railWidthIn);
    }, [selectedSize, orientation, matWidth, railWidthIn]);

    const crop = useMemo(() => {
        return imageCrop(activeNatural, geometry, fitPosition, MIN_CROP_DPI);
    }, [activeNatural, geometry, fitPosition]);

    // Handle custom image file upload
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result;
            const img = new Image();
            img.onload = () => {
                setCustomPhotoUrl(dataUrl);
                setCustomPhotoNatural({ w: img.naturalWidth, h: img.naturalHeight });
                setFitPosition(DEFAULT_POSITION);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="min-h-screen bg-stone-100 text-stone-900 pb-20">
            {/* Top Navigation Bar */}
            <div className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/frame/customize"
                            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
                            title="Return to Frame Customizer"
                        >
                            <ArrowLeft size={16} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-stone-950">
                                    UI Sandbox
                                </span>
                                <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                                    Cropping & Composition Lab
                                </h1>
                            </div>
                            <p className="text-xs text-stone-500 hidden sm:block">
                                Interactive evaluation of 4 distinct cropping UX patterns for FrameWorthy
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFitPosition(DEFAULT_POSITION)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 transition-colors"
                            title="Reset position to default center"
                        >
                            <RotateCcw size={13} />
                            <span>Reset Crop</span>
                        </button>
                        <Link
                            to="/frame/customize"
                            className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-colors"
                        >
                            Back to Studio
                        </Link>
                    </div>
                </div>

                {/* Concept Selector Tabs */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 border-t border-stone-100">
                        {CONCEPT_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                        isActive
                                            ? 'bg-amber-500 text-stone-950 shadow-sm'
                                            : 'bg-stone-50 hover:bg-stone-200/60 text-stone-600 hover:text-stone-900'
                                    }`}
                                >
                                    <Icon size={15} />
                                    <span>{tab.title}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${
                                        isActive ? 'bg-stone-950/20 text-stone-950' : 'bg-stone-200 text-stone-600'
                                    }`}>
                                        {tab.badge}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content Container */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
                {/* Active Concept Info Banner */}
                {activeTab !== 'compare' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-900 text-sm">
                                    {CONCEPT_TABS.find(t => t.id === activeTab)?.title}
                                </span>
                                <span className="text-xs text-amber-700 font-semibold bg-amber-500/20 px-2 py-0.5 rounded-full">
                                    {CONCEPT_TABS.find(t => t.id === activeTab)?.badge}
                                </span>
                            </div>
                            <p className="text-xs text-stone-700 max-w-3xl">
                                {CONCEPT_TABS.find(t => t.id === activeTab)?.summary}
                            </p>
                        </div>

                        {activeTab === 'modal' && (
                            <button
                                type="button"
                                onClick={() => setIsDedicatedModalOpen(true)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/25 flex items-center gap-1.5 transition-all"
                            >
                                <Maximize2 size={14} />
                                <span>Launch Studio Modal</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Configuration Controls Bar */}
                <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-4 sm:p-5 space-y-4">
                    {/* 1. Sample Image Picker & Upload */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                                <ImageIcon size={14} className="text-amber-500" />
                                <span>Test Artwork & Aspect Ratio</span>
                            </label>
                            <span className="text-xs text-stone-400">
                                Native: {activeNatural.w} × {activeNatural.h} px
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {SAMPLE_PHOTOS.map((photo) => {
                                const isSelected = !customPhotoUrl && selectedPhoto.id === photo.id;
                                return (
                                    <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => {
                                            setCustomPhotoUrl(null);
                                            setSelectedPhoto(photo);
                                            setFitPosition(DEFAULT_POSITION);
                                        }}
                                        className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                                            isSelected
                                                ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-400/40 shadow-sm'
                                                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                                        }`}
                                    >
                                        <img
                                            src={photo.url}
                                            alt={photo.title}
                                            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-stone-200"
                                        />
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-stone-900 truncate">
                                                {photo.ratioLabel}
                                            </div>
                                            <div className="text-[10px] text-stone-500 truncate">
                                                {photo.title}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {/* Upload Custom Image */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                                    customPhotoUrl
                                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-400/40 shadow-sm'
                                        : 'border-dashed border-stone-300 hover:border-stone-400 hover:bg-stone-50'
                                }`}
                            >
                                <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 shrink-0 border border-stone-200">
                                    <Upload size={18} />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-stone-900 truncate">
                                        {customPhotoUrl ? 'Custom File' : 'Upload Art'}
                                    </div>
                                    <div className="text-[10px] text-stone-500 truncate">
                                        {customPhotoUrl ? 'Active' : 'Test any image'}
                                    </div>
                                </div>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* 2. Frame & Size Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-stone-100 text-xs">
                        {/* Frame Finish */}
                        <div className="space-y-1.5">
                            <label className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                                Frame Moulding
                            </label>
                            <select
                                value={selectedFrame.id}
                                onChange={(e) => {
                                    const found = PRODIGI_FRAME_STYLES.find(f => f.id === e.target.value);
                                    if (found) setSelectedFrame(found);
                                }}
                                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            >
                                {PRODIGI_FRAME_STYLES.slice(0, 10).map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Frame Size */}
                        <div className="space-y-1.5">
                            <label className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                                Frame Size
                            </label>
                            <select
                                value={selectedSize.id}
                                onChange={(e) => {
                                    const found = SANDBOX_SIZES.find(s => s.id === e.target.value);
                                    if (found) setSelectedSize(found);
                                }}
                                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            >
                                {SANDBOX_SIZES.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Mount & Orientation */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                                <label className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                                    Orientation
                                </label>
                                <div className="flex rounded-lg border border-stone-200 overflow-hidden bg-stone-50">
                                    <button
                                        type="button"
                                        onClick={() => setOrientation('portrait')}
                                        className={`flex-1 py-1.5 text-center font-medium transition-colors ${
                                            orientation === 'portrait' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                    >
                                        Portrait
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOrientation('landscape')}
                                        className={`flex-1 py-1.5 text-center font-medium transition-colors ${
                                            orientation === 'landscape' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                    >
                                        Landscape
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">
                                    Mount (Mat)
                                </label>
                                <select
                                    value={matWidth}
                                    onChange={(e) => setMatWidth(parseFloat(e.target.value))}
                                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-stone-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                >
                                    <option value={0}>None (Full Bleed)</option>
                                    <option value={2}>Standard 2″ (~50mm)</option>
                                    <option value={3}>Wide 3″ (~75mm)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Telemetry Bar */}
                <CropMetricsBar
                    imageNatural={activeNatural}
                    geometry={geometry}
                    crop={crop}
                    position={fitPosition}
                />

                {/* Interactive Sandbox Canvas per Tab */}
                {activeTab === 'canvas' && (
                    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                            <div>
                                <h3 className="text-sm font-bold text-stone-900">
                                    Interactive Direct On-Frame Canvas
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Drag the photo directly inside the aperture to pan · Scroll wheel or pinch to zoom
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-stone-500">
                                <Monitor size={14} />
                                <span className="hidden sm:inline">Desktop</span>
                                <span className="opacity-40">/</span>
                                <Smartphone size={14} />
                                <span className="hidden sm:inline">Mobile Touch</span>
                            </div>
                        </div>

                        <DirectCanvasCropper
                            image={activeImage}
                            natural={activeNatural}
                            geometry={geometry}
                            position={fitPosition}
                            onPositionChange={setFitPosition}
                            frame={selectedFrame}
                            matColor="#faf9f5"
                            minimumDpi={MIN_CROP_DPI}
                        />
                    </div>
                )}

                {activeTab === 'modal' && (
                    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 space-y-6 text-center">
                        <div className="max-w-lg mx-auto space-y-3 py-6">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center mx-auto shadow-inner">
                                <Maximize2 size={32} />
                            </div>
                            <h3 className="text-base font-bold text-stone-900">
                                Dedicated Focus Crop Studio Modal
                            </h3>
                            <p className="text-xs text-stone-600 leading-relaxed">
                                Ideal for users seeking precision alignment. Opens an immersive darkroom studio showing the entire uncropped image, illuminated aperture cutout, rule-of-thirds grid, live print resolution DPI meter, and composition presets.
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsDedicatedModalOpen(true)}
                                className="px-6 py-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 flex items-center gap-2 mx-auto transition-all hover:scale-105"
                            >
                                <Maximize2 size={16} />
                                <span>Open Precision Framing Studio</span>
                            </button>
                        </div>

                        {/* Static preview of current framing */}
                        <div className="border-t border-stone-100 pt-6">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-4">
                                Resulting Framed Piece
                            </h4>
                            <div className="max-w-md mx-auto">
                                <DirectCanvasCropper
                                    image={activeImage}
                                    natural={activeNatural}
                                    geometry={geometry}
                                    position={fitPosition}
                                    onPositionChange={setFitPosition}
                                    frame={selectedFrame}
                                    matColor="#faf9f5"
                                    minimumDpi={MIN_CROP_DPI}
                                />
                            </div>
                        </div>

                        <CropStudioModal
                            isOpen={isDedicatedModalOpen}
                            onClose={() => setIsDedicatedModalOpen(false)}
                            onApply={(pos) => setFitPosition(pos)}
                            image={activeImage}
                            natural={activeNatural}
                            geometry={geometry}
                            initialPosition={fitPosition}
                            frameTitle={selectedFrame.name}
                            sizeLabel={selectedSize.label}
                            minimumDpi={MIN_CROP_DPI}
                        />
                    </div>
                )}

                {activeTab === 'pad' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Frame Visualizer Preview */}
                        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6">
                            <div className="pb-3 border-b border-stone-100 mb-4">
                                <h3 className="text-sm font-bold text-stone-900">
                                    Frame Visualizer Result
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Live presentation responding instantly to joypad selections
                                </p>
                            </div>
                            <DirectCanvasCropper
                                image={activeImage}
                                natural={activeNatural}
                                geometry={geometry}
                                position={fitPosition}
                                onPositionChange={setFitPosition}
                                frame={selectedFrame}
                                matColor="#faf9f5"
                                minimumDpi={MIN_CROP_DPI}
                            />
                        </div>

                        {/* 9-Point Smart Pad in the Sidebar */}
                        <div className="lg:col-span-5">
                            <SmartAlignmentPad
                                image={activeImage}
                                natural={activeNatural}
                                geometry={geometry}
                                position={fitPosition}
                                onPositionChange={setFitPosition}
                                minimumDpi={MIN_CROP_DPI}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'hybrid' && (
                    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6">
                        <HybridCropper
                            image={activeImage}
                            natural={activeNatural}
                            geometry={geometry}
                            position={fitPosition}
                            onPositionChange={setFitPosition}
                            frame={selectedFrame}
                            matColor="#faf9f5"
                            minimumDpi={MIN_CROP_DPI}
                            frameTitle={selectedFrame.name}
                            sizeLabel={selectedSize.label}
                        />
                    </div>
                )}

                {activeTab === 'compare' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6">
                            <h3 className="text-base font-bold text-stone-900 mb-1">
                                Comprehensive Architecture Evaluation
                            </h3>
                            <p className="text-xs text-stone-500 mb-6">
                                Side-by-side comparison of UX trade-offs, ergonomics, and implementation considerations.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Concept 1 Card */}
                                <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Zap size={16} className="text-amber-500" />
                                        <h4 className="font-bold text-xs text-stone-900">1. Direct Canvas</h4>
                                    </div>
                                    <ul className="text-[11px] text-stone-600 space-y-1.5 list-disc pl-4">
                                        <li><strong>Ergonomics:</strong> Highest natural feel, instant gratification.</li>
                                        <li><strong>Mobile:</strong> Excellent touch pinch & drag.</li>
                                        <li><strong>Context:</strong> Cannot see cropped-out image bounds.</li>
                                        <li><strong>Best For:</strong> Everyday users wanting quick centering.</li>
                                    </ul>
                                </div>

                                {/* Concept 2 Card */}
                                <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Maximize2 size={16} className="text-amber-500" />
                                        <h4 className="font-bold text-xs text-stone-900">2. Precision Studio</h4>
                                    </div>
                                    <ul className="text-[11px] text-stone-600 space-y-1.5 list-disc pl-4">
                                        <li><strong>Ergonomics:</strong> Highest precision, no bounds ambiguity.</li>
                                        <li><strong>Context:</strong> Shows 100% of the uncropped source image.</li>
                                        <li><strong>Mobile:</strong> Requires full-screen takeover modal.</li>
                                        <li><strong>Best For:</strong> Fine art, high-res prints & exact framing.</li>
                                    </ul>
                                </div>

                                {/* Concept 3 Card */}
                                <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Compass size={16} className="text-amber-500" />
                                        <h4 className="font-bold text-xs text-stone-900">3. 9-Point Smart Pad</h4>
                                    </div>
                                    <ul className="text-[11px] text-stone-600 space-y-1.5 list-disc pl-4">
                                        <li><strong>Ergonomics:</strong> Zero drag fussiness, 1-click deterministic.</li>
                                        <li><strong>Mobile:</strong> Flawless on compact phones.</li>
                                        <li><strong>Context:</strong> 2D miniature focal map provides spatial awareness.</li>
                                        <li><strong>Best For:</strong> Fast sidebar navigation & accessibility.</li>
                                    </ul>
                                </div>

                                {/* Concept 4 Card */}
                                <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3 border-amber-300 bg-amber-50/40">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-amber-600" />
                                        <h4 className="font-bold text-xs text-stone-950">4. Hybrid Flow (Recommended)</h4>
                                    </div>
                                    <ul className="text-[11px] text-stone-700 space-y-1.5 list-disc pl-4">
                                        <li><strong>Ergonomics:</strong> Casual drag on canvas + studio modal when needed.</li>
                                        <li><strong>Synergy:</strong> Combines best elements of all approaches.</li>
                                        <li><strong>Flexibility:</strong> Satisfies both casual and professional framers.</li>
                                        <li><strong>Best For:</strong> Production deployment in Frame Studio.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
