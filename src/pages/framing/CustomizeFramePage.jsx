import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
    ImagePlus,
    Check,
    Ruler,
    Palette,
    Frame,
    ImageUp,
    ChevronDown,
    Info,
    Loader,
    Maximize2,
    X
} from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES, MAT_COLORS, formatDimensions, findSizeByDimension, parseCustomSize, DEFAULT_DEMO_IMAGE } from '../../data/constants';
import { ROOM_SCENES, computeRoomPlacement } from '../../data/roomScenes';
import StudioLoftScene from '../../components/framing/StudioLoftScene';
import { getFrameTextureAnchor, TEXTURE_ZOOM_PCT, basenameOf } from '../../utils/frameTexture';
import FRAME_STRIP_MANIFEST from '../../data/frameStrips.json';
import WEB_MET_DIMS from '../../data/web_met_dims.json';
import { useUnit } from '../../context/UnitContext';
import { useCart } from '../../context/CartContext';
import { uploadImageToCloud, getThumbnailUrl } from '../../services/storage';
import FrameSelectionModal from '../../components/FrameSelectionModal';
import SizeGuidePanel from '../../components/framing/SizeGuidePanel';
import MetArtSelectionModal from '../../components/MetArtSelectionModal';
import { renderAlbumPoster } from '../../utils/albumPoster';
import { renderMoviePoster } from '../../utils/moviePoster';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../../components/AuthModal';
import Price from '../../components/common/Price';
import { visualizerFullScreenState } from '../../utils/visualizerFullScreenState';
import { firebaseProjectId } from '../../services/firebase';
import { createAndroidSceneViewerIntent, createArPreviewUrls, getArPlatform } from '../../utils/arPreview';

// High-fidelity 3D side gradients for the frame
const getSideBackground = (side, frame) => {
    let hex = frame.baseColor || '#8b4513';
    const adjustBrightness = (col, amt) => {
        let usePound = false;
        if (col[0] === '#') {
            col = col.slice(1);
            usePound = true;
        }
        let num = parseInt(col, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255; else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255; else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    };

    const light = adjustBrightness(hex, 40);
    const midLight = adjustBrightness(hex, 10);
    const midDark = adjustBrightness(hex, -20);
    const dark = adjustBrightness(hex, -50);

    const gradientStr = `${light} 0%, ${midLight} 40%, ${midDark} 70%, ${dark} 100%`;

    if (side === 'top') return `linear-gradient(to bottom, ${gradientStr})`;
    if (side === 'bottom') return `linear-gradient(to top, ${gradientStr})`;
    if (side === 'left') return `linear-gradient(to right, ${gradientStr})`;
    if (side === 'right') return `linear-gradient(to left, ${gradientStr})`;

    return hex;
};

// Directional bevel shading, as an `overlay`-blended gradient over a texture
// photo rather than baked into a flat colour — mid-grey (#808080) is the
// identity colour for `overlay`, so this sweeps from a highlight through
// true no-op to a shadow without needing alpha transparency, and applies the
// same regardless of the photo's own material colour underneath.
const BEVEL_SHADE_DIR = { top: 'to bottom', bottom: 'to top', left: 'to right', right: 'to left' };

// The catalogue's corner photos are 3D product shots — most show the front-
// facing moulding profile ("face") AND, along the outer edge, a sliver of
// the frame's side wall, which is very often a plain, different colour (a
// glossy near-black edge on an otherwise wood-grain face is typical). The
// live visualizer is a flat frontal view — only the face is ever real — so
// a crop that reaches the side band is wrong regardless of how good it
// looks in isolation. Zoom alone doesn't fully solve this (swept up to
// 3000% across the catalogue and dozens of anchors were still too close to
// a seam for any window size to avoid it), so utils/frameTexture.js checks
// the actual crop each anchor will render at THIS_ZOOM and rejects any
// anchor whose crop spans two distinct surfaces, falling back to the
// gradient for that frame — see that file for the full history of what was
// tried and why it wasn't enough on its own. TEXTURE_ZOOM_PCT is imported
// rather than redefined here so detection and rendering can't drift apart.

// Returns a tightly cropped sample of real moulding material. A raw corner
// photo is deliberately treated as non-directional: its grain/profile has
// not been rectified into a reliable strip, so rotating it would invent
// seams. A reviewed strip can opt in through `textureOrientation` later.
const getFrameFaceTextureStyle = (frame, anchor) => {
    if (!anchor || !frame?.previewImg) return null;
    return {
        backgroundImage: `url(${frame.previewImg})`,
        backgroundSize: `${TEXTURE_ZOOM_PCT}% ${TEXTURE_ZOOM_PCT}%`,
        backgroundPosition: `${anchor.xPct}% ${anchor.yPct}%`,
        backgroundRepeat: 'no-repeat',
    };
};

// Real tileable moulding strips (see scripts/generate-frame-strips.mjs and
// src/data/frameStrips.json) for the subset of the catalogue — mostly the
// ornate/carved frames — where they've been generated AND manually
// reviewed. Everything else keeps the single-patch anchor crop below,
// which is the only honest option for a frame with no strip: repeating a
// motif that was never verified to tile would risk the exact silent-defect
// failure the strip pipeline's review process exists to catch.
const getFrameStripEntry = (frame) => {
    if (!frame?.previewImg) return null;
    return FRAME_STRIP_MANIFEST[basenameOf(frame.previewImg)] || null;
};

// Unlike the anchor crop (one static patch, `no-repeat`), a strip is built
// to repeat: `-h.webp` for top/bottom, pre-rotated `-v.webp` for left/right
// (rotated at generation time with sharp, not via a CSS transform — a real
// rotated image needs no overscan hack to hide a transformed bounding box,
// unlike the raw-crop rotation path below). `auto <axis>` keeps the
// strip's own aspect ratio while its other axis fills the moulding's
// actual rendered thickness, so it tiles correctly at any frame size.
const getFrameStripTextureStyle = (side, stripEntry) => {
    if (!stripEntry) return null;
    const isHorizontal = side === 'top' || side === 'bottom';
    const file = isHorizontal ? stripEntry.h : stripEntry.v;
    if (!file) return null;
    return {
        backgroundImage: `url(/frames/strips/${file})`,
        backgroundRepeat: isHorizontal ? 'repeat-x' : 'repeat-y',
        backgroundSize: isHorizontal ? 'auto 100%' : '100% auto',
        backgroundPosition: 'center',
    };
};

// Catalogue styling is intentionally inferred from a frame's own name and
// description rather than from its broad browsing category. That lets every
// existing SKU participate immediately, while an eventual measured profile
// (for example `renderProfile: 'scoop'`) can override the inference without
// changing the renderer.
const getFrameVisualProfile = (frame) => {
    const label = `${frame?.name || ''} ${frame?.desc || ''}`.toLowerCase();
    const explicitProfile = frame?.renderProfile;
    const profile = explicitProfile || (
        /floater|float frame/.test(label) ? 'floater' :
        /scoop|reverse/.test(label) ? 'scoop' :
        /deep|shadow/.test(label) ? 'deep' :
        /bevel|angled|lip/.test(label) ? 'bevel' :
        /ornate|renaissance|embossed|carved|bamboo/.test(label) ? 'raised' :
        'flat'
    );
    const finish = /gold|silver|pewter|metallic|chrome|bronze|copper|rose gold/.test(label)
        ? 'metallic'
        : /glossy|lacquer/.test(label)
            ? 'gloss'
            : 'matte';

    return { profile, finish };
};

const getProfileLightOverlay = (side, visualProfile) => {
    const direction = BEVEL_SHADE_DIR[side];
    const stops = {
        // Scoop and deep mouldings need the highlight to fall away then return
        // toward the inside edge. Raised/ornate mouldings retain a gentler
        // highlight so their real captured detail remains the focal point.
        scoop: 'rgba(255,255,255,0.34) 0%, rgba(30,30,30,0.18) 28%, rgba(255,255,255,0.12) 57%, rgba(0,0,0,0.48) 100%',
        deep: 'rgba(255,255,255,0.24) 0%, rgba(0,0,0,0.06) 35%, rgba(0,0,0,0.60) 100%',
        bevel: 'rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.46) 100%',
        raised: 'rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0.32) 100%',
        floater: 'rgba(255,255,255,0.16) 0%, rgba(0,0,0,0.38) 100%',
        flat: 'rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.26) 100%',
    }[visualProfile.profile] || 'rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.26) 100%';

    const sheen = visualProfile.finish === 'metallic'
        ? `, linear-gradient(${direction}, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 24%, rgba(255,255,255,0.18) 52%, rgba(0,0,0,0.14) 100%)`
        : visualProfile.finish === 'gloss'
            ? `, linear-gradient(${direction}, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 32%)`
            : '';

    return `linear-gradient(${direction}, ${stops})${sheen}`;
};

// A single physical moulding side. The parent supplies the computed visual
// geometry and mitre clip; this component handles the material/lighting
// layers. Keeping texture and bevel as separate layers is important: the
// photograph supplies the finish, while the side determines where light
// catches the profile.
//
// Two different texture sources, in preference order:
//   1. A reviewed tileable strip (getFrameStripEntry) — real repeating
//      material, pre-rotated per side at generation time, so it needs
//      neither a CSS rotation transform nor overscan.
//   2. The single-patch anchor crop (getFrameFaceTextureStyle) — the
//      fallback for every frame without a strip. `textureOrientation`
//      controls ITS rotation only: a raw catalogue crop was never
//      verified to survive rotation without exposing its own mitre or
//      studio background (see the module comment above), so nothing
//      currently sets that field and this path stays unrotated in
//      practice — kept for a future per-frame override, not dead code to
//      remove.
const FrameMouldingSide = ({ side, frame, textureAnchor, style }) => {
    const stripEntry = getFrameStripEntry(frame);
    const stripStyle = getFrameStripTextureStyle(side, stripEntry);
    const textureStyle = stripStyle || getFrameFaceTextureStyle(frame, textureAnchor);
    const visualProfile = getFrameVisualProfile(frame);
    const hasDirectionalTexture = !stripStyle && frame?.textureOrientation === 'along-frame';
    const rotation = hasDirectionalTexture && side === 'left'
        ? 'rotate(-90deg)'
        : hasDirectionalTexture && side === 'right'
            ? 'rotate(90deg)'
            : 'none';

    return (
        <div
            className="absolute z-10 overflow-hidden transition-all duration-300"
            style={{
                ...style,
                backgroundImage: getSideBackground(side, frame),
                isolation: 'isolate',
            }}
        >
            {textureStyle && (
                <div
                    className="absolute pointer-events-none"
                    style={{
                        // Overscan is only valid for the raw-crop rotation path.
                        // A strip is already correctly oriented per side, and
                        // applying this would just crop most of the tiling away.
                        inset: hasDirectionalTexture && (side === 'left' || side === 'right') ? '-65%' : '0',
                        ...textureStyle,
                        transform: rotation,
                        transformOrigin: 'center',
                    }}
                />
            )}
            {textureStyle && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: getProfileLightOverlay(side, visualProfile),
                        backgroundBlendMode: visualProfile.finish === 'metallic' ? 'screen, overlay' : 'normal',
                        mixBlendMode: visualProfile.finish === 'matte' ? 'overlay' : 'soft-light',
                    }}
                />
            )}
            {!textureStyle && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: getProfileLightOverlay(side, visualProfile),
                        opacity: 0.72,
                    }}
                />
            )}
            {/* A restrained inner falloff makes a flat material crop read as
                a real face receding into the rabbet, without inventing a new
                profile that isn't present in the selected moulding. */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),inset_0_-2px_3px_rgba(0,0,0,0.18)]" />
        </div>
    );
};

// Wall Paint Colors
const WALL_COLORS = [
    { id: 'pure-white', name: 'Pure White', hex: '#f4f4f4' },
    { id: 'alabaster', name: 'Alabaster', hex: '#f2f0e6' },
    { id: 'swiss-coffee', name: 'Swiss Coffee', hex: '#e1dbd0' },
    { id: 'accessible-beige', name: 'Accessible Beige', hex: '#d5cfc4' },
    { id: 'repose-gray', name: 'Repose Gray', hex: '#cccccc' },
    { id: 'sage', name: 'Sage Green', hex: '#8a9a86' },
    { id: 'aegean-teal', name: 'Aegean Teal', hex: '#4f6c75' },
    { id: 'hale-navy', name: 'Hale Navy', hex: '#2b3749' },
    { id: 'naval', name: 'Naval', hex: '#2b3541' },
    { id: 'terracotta', name: 'Terracotta', hex: '#c07c66' },
    { id: 'urbane-bronze', name: 'Urbane Bronze', hex: '#54504a' },
    { id: 'charcoal', name: 'Charcoal', hex: '#333333' },
];

// Reusable micro-interaction glassmorphic info tooltip
const InfoTooltip = ({ text }) => {
    return (
        <div className="group relative inline-block cursor-help ml-[2px] align-super select-none -translate-y-[1.5px] opacity-35 hover:opacity-85 transition-opacity">
            <Info size={9} strokeWidth={2.5} className="text-stone-600" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-52 p-3 bg-stone-900/95 backdrop-blur-sm text-stone-100 text-[10px] font-normal leading-relaxed rounded-xl shadow-xl border border-stone-850 pointer-events-none z-50 text-center normal-case tracking-normal">
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900/95" />
                {text}
            </div>
        </div>
    );
};


const CustomizeFramePage = ({
    uploadedImage,
    setUploadedImage,
    productionImage,
    setProductionImage,
    selectedFrame,
    setSelectedFrame,
    selectedSize,
    setSelectedSize,
    setTotalPrice,
    navigate,
    orientation,
    setOrientation,
    matColor,
    setMatColor,
    matWidth,
    setMatWidth,
    glassType,
    setGlassType,
    hardwareType,
    setHardwareType,
    activeLayout,
    setActiveLayout,
    collageImages,
    frameThickness,
    setFrameThickness,
    isPreset,
    setIsPreset,
    presetTitle,
    setPresetTitle,
    presetDims,
    setPresetDims
}) => {
    const location = useLocation();
    const { unit, setUnit } = useUnit();
    const { addToCart, toggleAllSelection } = useCart();
    const { user } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    
    const isPlaceholder = uploadedImage === 'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1600&q=80&sat=-20&con=-10';
    const hasImage = Boolean((uploadedImage && !isPlaceholder) || productionImage || (collageImages && collageImages.length > 0));
    
    // Core State
    const [isAlbumArt, setIsAlbumArt] = useState(false);
    const [isAlbumPoster, setIsAlbumPoster] = useState(false);
    const [isMoviePoster, setIsMoviePoster] = useState(false);
    const [isMoviePosterPrint, setIsMoviePosterPrint] = useState(false);
    const [posterData, setPosterData] = useState(null);
    const [wallColor, setWallColor] = useState(WALL_COLORS[0]);
    // null = the plain wall-colour backdrop with the sofa scale cue. Set to a
    // ROOM_SCENES id to swap in a full room, where the artwork is sized
    // against the room's own real-world wall span instead of the sofa.
    const [roomSceneId, setRoomSceneId] = useState(null);
    // Resolved async per selectedFrame — see utils/frameTexture.js. Stays
    // null (falls back to the synthesized-gradient moulding) until/unless a
    // confident on-material anchor is found for this frame's corner photo.
    const [frameTextureAnchor, setFrameTextureAnchor] = useState(null);
    const [showDimensions, setShowDimensions] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    // True while the background Cloudinary upload for the current image is
    // in flight — until it resolves, `uploadedImage` is a blob: URL that
    // won't survive a page reload, so Add to Cart/Buy Now must wait for it.
    const [isCloudUploadPending, setIsCloudUploadPending] = useState(false);
    const [isFrameModalOpen, setIsFrameModalOpen] = useState(false);
    const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
    const [isWallPickerOpen, setIsWallPickerOpen] = useState(false);
    const [isMetModalOpen, setIsMetModalOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isMaxZoom, setIsMaxZoom] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [arPreviewUrls, setArPreviewUrls] = useState(null);
    const [arPreviewMessage, setArPreviewMessage] = useState('');
    const arPlatform = getArPlatform({ capacitorPlatform: Capacitor.getPlatform() });
    // Decoupled from isFullScreen so entering/exiting can crossfade instead
    // of hard-cutting: isFullScreen controls which layout (docked vs.
    // full-screen) is mounted, paneVisible controls that pane's own
    // opacity/scale, applied to BOTH layouts — see enterFullScreen/
    // exitFullScreen below. Defaults true because the docked pane needs no
    // fade-in on the very first render, only right after returning from
    // full screen.
    const [paneVisible, setPaneVisible] = useState(true);
    const fullScreenCloseTimeoutRef = useRef(null);
    const hoverTimeoutRef = useRef(null);
    const lastTapRef = useRef(0);
    const zoneRef = useRef(null);
    const [loadingAction, setLoadingAction] = useState(null);
    const [wasAddedToCart, setWasAddedToCart] = useState(false);
    // Always holds the uploadedImage value from the most recent render, updated
    // synchronously (not via an effect) so a stale image-load callback can tell
    // it's no longer for the current image even before its effect's own cleanup
    // has had a chance to run (see the image-load effect below).
    const latestUploadedImageRef = useRef(uploadedImage);
    latestUploadedImageRef.current = uploadedImage;
    const initialPresetImageRef = useRef(null);
    const [zoneSize, setZoneSize] = useState({ width: 1000, height: 500 }); // Default fallback
    const [isRendering, setIsRendering] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [isFrameLoading, setIsFrameLoading] = useState(false);

    // Drives the visualizer loading ring so its fill actually corresponds to
    // completion rather than looping on its own independent timer: it creeps
    // toward (but never quite reaches) full while any of the three loading
    // flags above are true, then snaps to 100% the instant they all clear,
    // holds briefly so that's visible, and only then fades the overlay out.
    const isVisualizerLoading = isRendering || isImageLoading || isFrameLoading;
    const [ringComplete, setRingComplete] = useState(false);
    const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false);
    useEffect(() => {
        if (isVisualizerLoading) {
            setLoadingOverlayVisible(true);
            setRingComplete(false);
            return;
        }
        if (!loadingOverlayVisible) return;
        setRingComplete(true);
        const hideTimer = setTimeout(() => setLoadingOverlayVisible(false), 350);
        return () => clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisualizerLoading]);
    const [showAllSizes, setShowAllSizes] = useState(false);
    const [showCustomSizeForm, setShowCustomSizeForm] = useState(false);
    const [customWidthInput, setCustomWidthInput] = useState('');
    const [customHeightInput, setCustomHeightInput] = useState('');
    const [customSizeError, setCustomSizeError] = useState('');
    // Kept separate from selectedSize so the user's custom size stays visible
    // in the list (in its last-position slot) even after they pick a
    // different size — otherwise it'd vanish the moment it's no longer active.
    const [customSizeEntry, setCustomSizeEntry] = useState(null);
    const [isOptimized, setIsOptimized] = useState(false);
    const [imageNaturalSize, setImageNaturalSize] = useState(null);   // { w, h }
    const [savedSettings, setSavedSettings] = useState(() => ({
        orientation: orientation || 'portrait',
        matWidth: matWidth || 'none'
    }));

    // Dynamically access the device screen to optimize visualizer height on mobile
    const [windowSize, setWindowSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1200,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
    });

    const prepareArPreview = () => {
        const sourceImage = productionImage || uploadedImage;
        const previewUrls = createArPreviewUrls({
            projectId: firebaseProjectId,
            frame: selectedFrame,
            size: selectedSize,
            orientation,
            artworkUrl: sourceImage,
        });
        if (!previewUrls) {
            setArPreviewMessage('Finish uploading an image before preparing an AR preview.');
            return;
        }
        setArPreviewUrls(previewUrls);
        setArPreviewMessage('Preview ready. Open it to place the frame on a wall.');
    };

    // The generated Quick Look URL represents one exact configuration. Clear
    // it as soon as any physical or visual property changes so customers can
    // never open a stale AR object after changing their frame or dimensions.
    useEffect(() => {
        setArPreviewUrls(null);
        setArPreviewMessage('');
    }, [selectedFrame?.id, selectedSize?.width, selectedSize?.height, orientation, productionImage, uploadedImage]);

    useEffect(() => {
        const handleResize = () => setWindowSize({
            width: window.innerWidth,
            height: window.innerHeight
        });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Side-by-side mode applies to large desktop displays or tablets in landscape orientation
    const isSideBySide = windowSize.width >= 1024;
    
    // The visualizer height is now calculated dynamically further down to fit the frame

    // Sync saved manual settings whenever isOptimized is false
    useEffect(() => {
        if (!isOptimized) {
            setSavedSettings({ orientation, matWidth });
        }
    }, [isOptimized, orientation, matWidth]);
    
    // Canonical interpretation of an Inspiration selection ("Get This" from any
    // category). This is THE single place that maps a selection's state object
    // onto the Frame Studio — reached via real navigation (any entry point,
    // including the in-studio Inspiration trigger below, → /inspiration →
    // navigate here with location.state), picked up by the Initial Setup
    // effect below. Add new fields/categories HERE and it's picked up
    // automatically regardless of which entry point led here.
    const applyInspirationSelection = (state) => {
        if (!state) return;

        if (state.presetImage) {
            setUploadedImage(state.presetImage);
            initialPresetImageRef.current = state.presetImage;
        }
        if (state.productionImage || state.presetImage) {
            setProductionImage(state.productionImage || state.presetImage);
        }
        if (state.initialFrame) setSelectedFrame(state.initialFrame);
        if (state.initialSize) setSelectedSize(state.initialSize);
        if (state.orientation) setOrientation(state.orientation);
        if (state.initialMatWidth) setMatWidth(state.initialMatWidth);
        if (state.initialThickness) setFrameThickness(state.initialThickness);
        if (state.initialLayout) setActiveLayout(state.initialLayout);

        // Only the Framed Prints category locks the studio as a preset (fixed
        // frame/mat, edge-to-edge print). Paintings, canvas/glossy art, web and
        // Met images arrive fully editable — their presetTitle is still kept
        // for cart/checkout naming. Flags are set unconditionally so picking a
        // new item always clears the previous selection's mode.
        setIsPreset(!!state.isPresetFramedPrint);
        setPresetTitle(state.presetTitle || '');
        setPresetDims(state.presetDims || '');
        setIsAlbumArt(!!state.isAlbumArt);
        setIsAlbumPoster(!!state.isAlbumPoster);
        setIsMoviePoster(!!state.isMoviePoster);
        setIsMoviePosterPrint(!!state.isMoviePosterPrint);
        setPosterData((state.isAlbumPoster || state.isMoviePosterPrint) ? state.posterData : null);

        if (state.openMetArt) setIsMetModalOpen(true);
    };

    // Initial Setup
    useEffect(() => {
        // React Router doesn't reset scroll position on navigation — landing
        // here from partway down a long Inspiration/catalogue grid otherwise
        // carries that scroll offset over, so the visualizer (first in the
        // DOM on every layout) can end up scrolled out of view on arrival.
        window.scrollTo(0, 0);

        if (!selectedFrame) setSelectedFrame(FRAME_STYLES[0]);
        if (!selectedSize) setSelectedSize(FRAME_SIZES[2]); // 16x20 default

        // Sync state if coming from Inspiration 'Get This' or Landings — same
        // handler the in-studio Inspiration modal uses, so both entry points
        // behave identically.
        if (location.state && Object.keys(location.state).length > 0) {
            applyInspirationSelection(location.state);

            // React Router doesn't reset scroll position on navigation — if the
            // user was scrolled down browsing Inspiration, arriving here would
            // otherwise leave them scrolled into the configuration dashboard
            // instead of seeing the visualizer with their new selection.
            window.scrollTo(0, 0);

            // clear state to prevent re-applying the selection on remounts
            navigate(location.pathname, { replace: true, state: {} });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    // --- Effects ---

    // Generate the album/movie poster whenever the source data or size changes.
    // Mirrors the instant-local-preview + background-cloud-upload pattern used
    // in handleImageUpload below, so the production image gets set the same way.
    useEffect(() => {
        let isMounted = true;
        if ((isAlbumPoster || isMoviePosterPrint) && posterData && selectedSize) {
            setIsImageLoading(true);
            setIsRendering(true);
            // Use standard 300 DPI print resolution for crisp text in both the visualizer and
            // the final production print — but cap the resulting canvas's total pixel area,
            // since mobile Safari/WebView impose a hard ceiling around 16.7M px (roughly
            // 4096x4096) and silently produce a blank canvas past it. A flat 300 DPI already
            // blows past that for common poster sizes (24x36in @ 300 DPI = 7200x10800 =
            // 77.76M px), so DPI must scale down with physical size, not stay fixed. This is
            // safe for the final print too: getPrintQualityJpegUrl always requests the true
            // 300 DPI print target dimensions from Cloudinary regardless of this canvas's
            // resolution, so this only affects the on-screen preview / local-render fallback —
            // actual print sharpness is a catalogue-level DPI-floor concern (and the print
            // house's own upscaling), not something this render path controls.
            //
            // The 16M cap only exists to protect the memory-constrained mobile case — on a
            // real desktop browser there's no such ceiling, and capping there too was leaving
            // poster text visibly soft once zoomed/full-screen (the preview simply didn't have
            // the pixels to support the on-screen magnification). Raise the budget there.
            const isMobilePlatform = Capacitor.isNativePlatform() || windowSize.width < 1024;
            const MAX_CANVAS_PIXELS = isMobilePlatform ? 16_000_000 : 60_000_000;
            let physW = selectedSize.width, physH = selectedSize.height;
            if (physW > physH) [physW, physH] = [physH, physW]; // posters always render portrait
            const idealPixels = (physW * 300) * (physH * 300);
            const previewDPI = idealPixels > MAX_CANVAS_PIXELS
                ? Math.floor(300 * Math.sqrt(MAX_CANVAS_PIXELS / idealPixels))
                : 300;
            const renderPoster = isAlbumPoster ? renderAlbumPoster : renderMoviePoster;
            const fileLabel = isAlbumPoster ? 'album-poster.png' : 'movie-poster.png';
            renderPoster(posterData, selectedSize, previewDPI)
                .then(dataUrl => {
                    if (!isMounted) return;
                    setUploadedImage(dataUrl);
                    setIsRendering(false);

                    fetch(dataUrl)
                        .then(res => res.blob())
                        .then(blob => uploadImageToCloud(new File([blob], fileLabel, { type: 'image/png' })))
                        .then(cloudUrl => {
                            if (isMounted && setProductionImage) setProductionImage(cloudUrl);
                        })
                        .catch(err => {
                            console.warn('Background poster cloud upload failed, using local render:', err);
                        });
                })
                .catch(err => {
                    console.error('Failed to render poster:', err);
                    if (isMounted) setIsRendering(false);
                });
        }
        return () => { isMounted = false; };
    }, [isAlbumPoster, isMoviePosterPrint, posterData, selectedSize]);

    // Track loading states for images and frames
    useEffect(() => {
        if (uploadedImage) setIsImageLoading(true);
    }, [uploadedImage]);

    useEffect(() => {
        if (!selectedFrame || isPreset || selectedFrame.id === 'frame-canvas') {
            setIsFrameLoading(false);
            return;
        }
        const bg = getSideBackground('top', selectedFrame);
        const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1]) {
            setIsFrameLoading(true);
            const img = new Image();
            img.onload = () => setIsFrameLoading(false);
            img.onerror = () => setIsFrameLoading(false);
            img.src = match[1];
        } else {
            setIsFrameLoading(false);
        }
    }, [selectedFrame, isPreset]);

    // Resolve a real-texture anchor for the selected frame's corner photo —
    // see utils/frameTexture.js. Guarded against races: if the user flips
    // through frame styles quickly, only the response matching the frame
    // that's still selected when it resolves gets applied.
    useEffect(() => {
        if (!selectedFrame?.previewImg || selectedFrame.id === 'frame-canvas') return;
        let cancelled = false;
        getFrameTextureAnchor(selectedFrame.previewImg).then((anchor) => {
            if (!cancelled) setFrameTextureAnchor(anchor);
        });
        return () => {
            cancelled = true;
            setFrameTextureAnchor(null);
        };
    }, [selectedFrame]);

    // Real-time ResizeObserver for the Frame Positioning Zone to guarantee no overlap/clipping on zoom
    useEffect(() => {
        if (!zoneRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setZoneSize({
                    width: entries[0].contentRect.width,
                    height: entries[0].contentRect.height
                });
            }
        });
        observer.observe(zoneRef.current);
        return () => observer.disconnect();
    }, []);

    // Full-screen visualizer: reset hover/max-zoom on every transition so
    // zoom state computed against one container size (pane vs. viewport)
    // never carries over into the other.
    // Deliberately quicker than the frame's own hover-zoom (duration-700) —
    // entering/exiting full screen is a mode switch the user wants to
    // happen right away, not a leisurely hover effect, so it uses a
    // brisker pace. Must match the pane's own duration-300 transition class
    // below (and the dashboard's), since this is also how long enter/exit
    // waits before actually swapping the docked/full-screen layout.
    const FULL_SCREEN_TRANSITION_MS = 300;

    const enterFullScreen = () => {
        if (fullScreenCloseTimeoutRef.current) {
            clearTimeout(fullScreenCloseTimeoutRef.current);
            fullScreenCloseTimeoutRef.current = null;
        }
        setIsHovered(false);
        setIsMaxZoom(false);
        // Fade the CURRENT docked view out first — dashboard included,
        // since it shares paneVisible — then swap to the full-screen layout
        // only once that's finished. Mirrors exitFullScreen so both
        // directions are symmetric: the hard cut (dashboard un/remounting,
        // fixed vs. relative positioning, which can't itself be animated)
        // always happens while nothing is visible. This used to flip
        // isFullScreen instantly in the same tick as paneVisible, which
        // yanked the dashboard out of the DOM with no fade at all (it can
        // only fade while still mounted) at the exact instant the pane's
        // own geometry snapped to full-screen — that combination was the
        // glitchy entry transition.
        setPaneVisible(false);
        fullScreenCloseTimeoutRef.current = setTimeout(() => {
            setIsFullScreen(true);
            fullScreenCloseTimeoutRef.current = null;
        }, FULL_SCREEN_TRANSITION_MS);
    };
    const exitFullScreen = () => {
        if (fullScreenCloseTimeoutRef.current) {
            clearTimeout(fullScreenCloseTimeoutRef.current);
            fullScreenCloseTimeoutRef.current = null;
        }
        setIsHovered(false);
        setIsMaxZoom(false);
        // Fade/scale out first, then swap back to the docked layout only
        // once that's finished, so the hard cut (fixed-position pane
        // collapsing back into the normal flex layout, dashboard
        // remounting) always happens while fully invisible instead of
        // mid-transition. paneVisible stays false across that swap — see
        // the effect below, which is what actually fades the docked view
        // back in afterward. Without that, the docked branch would render
        // at full opacity the instant it remounts (it has no "just
        // arrived" state of its own), snapping straight to its final size
        // right as everything else pops back in — the glitch this fixes.
        setPaneVisible(false);
        fullScreenCloseTimeoutRef.current = setTimeout(() => {
            setIsFullScreen(false);
            fullScreenCloseTimeoutRef.current = null;
        }, FULL_SCREEN_TRANSITION_MS);
    };

    // Whichever layout we just switched to (full-screen on enter, docked on
    // exit) was mounted invisible — see enterFullScreen/exitFullScreen above
    // — so it can fade in the same way in both directions. Runs on every
    // isFullScreen flip, not just entering: React bails out harmlessly if
    // paneVisible is already true (e.g. on initial mount).
    //
    // A single requestAnimationFrame isn't reliably enough of a delay
    // either — it can still land in the same paint as the state change
    // that mounted the invisible layout, so that starting state never
    // actually gets painted and the fade-in silently no-ops. The standard
    // fix is a double rAF: the first callback runs right before a repaint
    // (guaranteeing the invisible state has been painted by the time it
    // fires), and only the SECOND rAF — scheduled from inside the first —
    // reliably lands on the next-next frame, after that paint has happened.
    useEffect(() => {
        let raf2 = null;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setPaneVisible(true));
        });
        return () => {
            cancelAnimationFrame(raf1);
            if (raf2 !== null) cancelAnimationFrame(raf2);
        };
    }, [isFullScreen]);

    useEffect(() => {
        return () => {
            if (fullScreenCloseTimeoutRef.current) clearTimeout(fullScreenCloseTimeoutRef.current);
        };
    }, []);

    // Escape closes full screen on desktop (mirrors the X button).
    useEffect(() => {
        if (!isFullScreen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') exitFullScreen();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullScreen]);

    // Lets App.jsx's Android hardware-back-button handler close full screen
    // instead of navigating back a page — see visualizerFullScreenState.js.
    useEffect(() => {
        visualizerFullScreenState.isActive = isFullScreen;
        visualizerFullScreenState.close = isFullScreen ? exitFullScreen : null;
        return () => {
            visualizerFullScreenState.isActive = false;
            visualizerFullScreenState.close = null;
        };
    }, [isFullScreen]);

    // Met Selection handler — routes through applyInspirationSelection (the
    // file's single canonical selection handler) instead of only setting
    // uploadedImage/orientation directly, which used to leave productionImage
    // and the preset/poster flags stale from whatever was loaded before, and
    // never resolved a frame/size for the newly-selected artwork at all.
    const handleMetArtSelect = (art) => {
        const filename = art.image.split('/').pop();
        const dims = WEB_MET_DIMS[filename] || '40 x 50 cm';
        const frameObj = FRAME_STYLES.find(f => f.id === 'frame-10512') || FRAME_STYLES[0];
        const sizeObj = findSizeByDimension(dims) || FRAME_SIZES.find(s => s.id === '16x20') || FRAME_SIZES[0];

        applyInspirationSelection({
            presetImage: art.image,
            presetTitle: art.title,
            initialFrame: frameObj || null,
            initialSize: sizeObj || null,
            orientation: art.orientation || sizeObj?.orientation
        });
        setIsMetModalOpen(false);
    };

    // Reset 'Added to cart' state when any configuration changes
    useEffect(() => {
        setWasAddedToCart(false);
    }, [selectedSize, selectedFrame, matWidth, matColor, glassType, hardwareType, uploadedImage, collageImages, activeLayout, orientation]);

    // Pricing Calculation
    useEffect(() => {
        if (!selectedSize || !selectedFrame) return;
        let base = Math.round(selectedSize.price * (selectedFrame.priceMod || 1));
        if (selectedFrame.id !== 'frame-canvas' && glassType !== 'canvas-floater' && glassType !== 'canvas-traditional' && matWidth !== 'none') base += (matColor.price || 75);
        // Guarded behind frame-canvas the same way buildCartItem/the footer
        // total are — this copy previously wasn't, so switching to a canvas
        // frame after selecting non-glare/museum glazing silently kept
        // charging for glazing a canvas frame doesn't have.
        if (selectedFrame.id !== 'frame-canvas' && glassType === 'non-glare') base += 100;
        if (selectedFrame.id !== 'frame-canvas' && glassType === 'museum') base += 200;
        if (glassType === 'canvas-floater') base += 400;
        if (glassType === 'canvas-traditional') base += 350;
        if (hardwareType === 'french-cleat') base += 50;
        setTotalPrice(base);
    }, [selectedSize, selectedFrame, matWidth, matColor, glassType, hardwareType, setTotalPrice]);

    // Dimension Helpers
    const wInch = orientation === 'portrait' ? selectedSize?.width : selectedSize?.height;
    const hInch = orientation === 'portrait' ? selectedSize?.height : selectedSize?.width;

    const visualizerMetrics = (() => {
        if (!wInch || !hInch) return { height: undefined, scale: 1 };
        // Constants matching the visualizer's rendering math
        const SOFA_CM = 160;
        const SOFA_BODY_PCT = 42; 
        const innerWidthCm = wInch * 2.54;
        
        const containerWidth = isSideBySide ? windowSize.width * 0.70 : windowSize.width;
        
        // Calculate frame width in pixels
        const frameWidthPct = (innerWidthCm / SOFA_CM) * SOFA_BODY_PCT;
        const frameWidthPx = (frameWidthPct / 100) * containerWidth;
        const frameHeightPx = frameWidthPx * (hInch / wInch);
        
        // Calculate sofa height in pixels (SVG aspect ratio is 800/300, width is 48% of screen)
        const sofaWidthPx = containerWidth * 0.48;
        const sofaHeightPx = sofaWidthPx * (300 / 800);
        
        // Add proportional padding: small frames get a tighter crop to pull menus up, large frames get more breathing room
        const dynamicPadding = Math.min(140, 60 + frameHeightPx * 0.8);

        // The sofa's own position is computed elsewhere (search SOFA_GAP_PX)
        // from the ZONE's height, not from this container height directly —
        // it sits at zoneTop + zoneHeight/2 + frameHeight/2 + gap, since the
        // frame is centered in a zone that's a fixed 65% of this container.
        // That means this container must be tall enough for the zone's 65%
        // to leave room below the frame for the sofa (plus its own dimension
        // overlay and note text) — otherwise the sofa/note render past this
        // container's bottom edge and get cut off by its sibling below,
        // invisible without the container itself growing to compensate.
        // Solving zoneTop + zoneHeight/2 + frameHeight/2 + gap + sofaBlock <= H
        // (with zoneHeight = 0.65*H - zoneTop) for H gives the formula below.
        // These constants MUST match the sofa's own (search SOFA_GAP_PX).
        const ZONE_TOP_PX = windowSize.width >= 640 ? 56 : 48; // matches top-14 / top-12
        const SOFA_GAP_PX = 24;
        const ZONE_HEIGHT_PCT = 0.65; // matches h-[calc(65%-3rem)]
        const NOTE_RESERVE_PX = 60; // sofa's dimension-overlay line + 2-line note beneath the SVG, plus safety margin (this formula's other inputs are pre-scale estimates, so verified empirically rather than solved exactly)
        const sofaBlockHeight = sofaHeightPx + NOTE_RESERVE_PX;
        const minHeightForSofaFit = (ZONE_TOP_PX / 2 + frameHeightPx / 2 + SOFA_GAP_PX + sofaBlockHeight) / (1 - ZONE_HEIGHT_PCT / 2);

        const calculatedHeight = Math.max(frameHeightPx + sofaHeightPx + dynamicPadding, minHeightForSofaFit);

        // Ensure it doesn't get ridiculously small (lowered to 180px) or impossibly tall
        // Mobile max height is 65%, Desktop side-by-side uses ~80vh for the visualizer
        const maxHeight = isSideBySide ? windowSize.height * 0.80 : windowSize.height * 0.65;
        const finalHeight = Math.max(180, Math.min(calculatedHeight, maxHeight));
        
        const scale = calculatedHeight > maxHeight ? finalHeight / calculatedHeight : 1;
        
        return { height: finalHeight, scale };
    })();

    // Dynamically calculate the actual physical inch size of the mat based on the qualitative choice and frame size
    const getMatSizeInches = () => {
        if (matWidth === 'none' || !selectedSize) return 0;
        const maxDim = Math.max(selectedSize.width, selectedSize.height);
        
        if (maxDim <= 12) { // Small
            if (matWidth === 'narrow') return 1.0;
            if (matWidth === 'standard') return 1.5;
            if (matWidth === 'wide') return 2.0;
        } else if (maxDim <= 20) { // Medium
            if (matWidth === 'narrow') return 1.5;
            if (matWidth === 'standard') return 2.0;
            if (matWidth === 'wide') return 3.0;
        } else { // Large
            if (matWidth === 'narrow') return 2.0;
            if (matWidth === 'standard') return 3.0;
            if (matWidth === 'wide') return 4.0;
        }
        return 1.5;
    };
    const currentMatInches = getMatSizeInches();
    

    useEffect(() => {
        if (!uploadedImage) {
            setImageNaturalSize(null);
            setIsOptimized(false);
            return;
        }
        // This effect and the "Initial Setup" mount effect both run in the same
        // initial commit (mount effect runs first, since it's declared first).
        // On that first commit, `uploadedImage` here is still the App-level
        // DEFAULT placeholder — the mount effect's setUploadedImage/
        // setIsMoviePoster calls won't be reflected until the NEXT render.
        // `location.state` in THIS render's closure still holds the original
        // (not-yet-cleared) preset payload though, so its presence reliably
        // means the current `uploadedImage` is about to be superseded — skip
        // processing it entirely rather than risk setting orientation based on
        // a placeholder image that's already obsolete. Album/movie poster
        // prints don't carry `presetImage` (their image is generated async
        // from `posterData`), so that must be checked too, or this effect
        // races the isAlbumPoster/isMoviePosterPrint flags being set true and
        // auto-detects orientation off the stale placeholder image instead.
        //
        // Checking the actual VALUE (not just presence) is what makes this
        // reliable: location.state (via router navigation) and uploadedImage
        // (via plain useState) update through two different mechanisms that
        // don't necessarily land in the same commit — uploadedImage can
        // already reflect the incoming preset image for one or more renders
        // before location.state actually clears. Skipping on mere presence
        // caused this whole effect (imageNaturalSize included) to never run
        // at all for a real, already-applied selection. Comparing values
        // sidesteps that race: once uploadedImage matches what
        // location.state says it should become, it's current, not stale,
        // regardless of whether location.state has cleared yet.
        const pendingPresetImage = location.state?.presetImage;
        if ((pendingPresetImage && pendingPresetImage !== uploadedImage) || location.state?.posterData) {
            return;
        }
        // Album/movie poster prints are always portrait and are re-generated
        // at exactly `selectedSize`'s aspect ratio, so orientation-detection
        // and square-snap are both irrelevant for them — skip entirely rather
        // than decode the (often 50MB+) generated canvas data URL a second
        // time purely to compute values this flow never uses. That redundant
        // decode ran on every single size change, competing with the visible
        // <img> tag's own decode of the identical string.
        if (isAlbumPoster || isMoviePosterPrint) {
            return;
        }
        // Preset/Inspiration selections (Original Paintings, Canvas Art, etc.)
        // already specify their own orientation via the selection itself, so
        // auto-detect and square-snap must not override that choice — but
        // imageNaturalSize still needs computing for these (it now also
        // drives whether a no-mat frame fills edge-to-edge or letterboxes),
        // so this only skips the auto-detect/square-snap portion below rather
        // than returning early and skipping the whole effect. Returning early
        // here used to silently leave imageNaturalSize null forever for every
        // preset image, not just the one loaded on mount as intended.
        const isPresetImage = uploadedImage === initialPresetImageRef.current;
        const effectImage = uploadedImage;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (cancelled || effectImage !== latestUploadedImageRef.current) return;
            setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            setIsImageLoading(false); // Hide spinner safely even if cached
            if (isPresetImage) return;

            // Album posters and movie posters are always portrait, regardless of
            // the source image's actual pixel aspect ratio — don't let
            // auto-detection override the intentional portrait lock for these
            // flows. Same reasoning for the starting demo photo itself: it's
            // landscape-shaped, but nobody has actually chosen it — the app's
            // own portrait default shouldn't be silently overridden by it on
            // a fresh session before the user has picked anything.
            if (!isAlbumPoster && !isMoviePoster && !isMoviePosterPrint && uploadedImage !== DEFAULT_DEMO_IMAGE) {
                const isLandscape = img.naturalWidth > img.naturalHeight;
                setOrientation(isLandscape ? 'landscape' : 'portrait');
            }
            setIsOptimized(false); // Reset optimization state for new image

            // Auto-snap to square size if the image is square
            const isSq = Math.abs(img.naturalWidth - img.naturalHeight) <= 5;
            if (isSq) {
                setSelectedSize(prevSize => {
                    if (prevSize && prevSize.width !== prevSize.height) {
                        return FRAME_SIZES.find(s => s.width === s.height && s.id === '12x12') || prevSize;
                    }
                    return prevSize;
                });
            }
        };
        img.onerror = () => {
            if (cancelled) return;
            setIsImageLoading(false);
        };
        // Only need this for aspect ratio (orientation-match / square-snap),
        // not pixel-perfect dimensions, so load the same thumbnail-sized
        // transform the visible <img> already uses (getThumbnailUrl no-ops
        // for blob:/data: URLs, so direct uploads are unaffected — this only
        // changes behavior for Cloudinary-hosted preset/Inspiration images).
        // Previously this always downloaded the full-resolution original a
        // second time in the background just to measure it, which competed
        // with the visible thumbnail for bandwidth on slower connections.
        img.src = getThumbnailUrl(uploadedImage, 1400);
        return () => {
            cancelled = true;
        };
    }, [uploadedImage, setOrientation, setSelectedSize, isAlbumPoster, isMoviePoster, isMoviePosterPrint]);

    const handleImageUpload = async (e) => {
        setIsPreset(false);
        setPresetTitle('');
        setIsAlbumArt(false);
        setIsAlbumPoster(false);
        setIsMoviePoster(false);
        setIsMoviePosterPrint(false);
        setPosterData(null);
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            // Instantly generate local URL for immediate visual rendering in the frame studio
            const localUrl = URL.createObjectURL(file);
            setUploadedImage(localUrl);
            setIsUploading(false); // Stop spinner immediately once local preview is ready

            // Perform cloud upload asynchronously in the background so the UI is never blocked
            setIsCloudUploadPending(true);
            uploadImageToCloud(file)
                .then(cloudUrl => {
                    setUploadedImage(cloudUrl);
                    if (setProductionImage) setProductionImage(cloudUrl);
                })
                .catch(error => {
                    console.warn('Background cloud upload failed, falling back to local preview:', error);
                })
                .finally(() => setIsCloudUploadPending(false));
        } catch (error) {
            console.error('Failed to create local preview:', error);
            setIsUploading(false);
        }
    };

    // Optimize toggle: computes best orientation + mat from image aspect ratio
    const handleOptimizeToggle = () => {
        if (isOptimized) {
            // Restore saved manual settings
            if (savedSettings) {
                setOrientation(savedSettings.orientation);
                setMatWidth(savedSettings.matWidth);
            }
            setIsOptimized(false);
            return;
        }

        const applyOptimization = (w, h) => {
            const imageRatio = w / h;

            // Frame ratios in portrait and landscape
            const widthDim = selectedSize?.width ?? 8;
            const heightDim = selectedSize?.height ?? 10;
            const ratioPortrait = Math.min(widthDim, heightDim) / Math.max(widthDim, heightDim);
            const ratioLandscape = Math.max(widthDim, heightDim) / Math.min(widthDim, heightDim);

            // Mismatches
            const mismatchPortrait = Math.abs(imageRatio - ratioPortrait) / ratioPortrait;
            const mismatchLandscape = Math.abs(imageRatio - ratioLandscape) / ratioLandscape;

            let recOrientation = 'portrait';
            let recMismatch = mismatchPortrait;

            // Choose the orientation that yields the closest fit
            if (mismatchLandscape < mismatchPortrait) {
                recOrientation = 'landscape';
                recMismatch = mismatchLandscape;
            } else {
                recOrientation = 'portrait';
                recMismatch = mismatchPortrait;
            }

            setOrientation(recOrientation);

            // Decide mat width based on the optimal orientation's mismatch
            if (recMismatch < 0.08) {
                setMatWidth('none');      // Perfect or near-perfect fit — fill the frame (No Mat)
            } else if (recMismatch < 0.22) {
                setMatWidth('narrow');    // Minor aspect ratio mismatch
            } else {
                setMatWidth('standard');  // Significant aspect ratio mismatch
            }

            setIsOptimized(true);
        };

        if (imageNaturalSize) {
            applyOptimization(imageNaturalSize.w, imageNaturalSize.h);
        } else if (uploadedImage) {
            // Load size dynamically on demand if not yet available in state
            setIsRendering(true);
            const img = new Image();
            img.onload = () => {
                const size = { w: img.naturalWidth, h: img.naturalHeight };
                setImageNaturalSize(size);
                applyOptimization(size.w, size.h);
                setIsRendering(false);
            };
            img.onerror = () => {
                setIsRendering(false);
                // Fallback to portrait 4:5 if image fails to load
                applyOptimization(8, 10);
            };
            img.src = uploadedImage;
        }
    };

    // Builds a fair representation of the configured item — artwork + mat +
    // a flat frame-color border, matching the visualizer's layout — and
    // uploads it to Cloudinary. This becomes the canonical thumbnail for the
    // item everywhere downstream (cart, checkout, admin fulfillment) instead
    // of just the raw uploaded photo on its own. It isn't a photographic
    // replica of the physical moulding — that's covered separately by the
    // Frame Style reference image in the admin fulfillment view. Best-effort:
    // if generation or upload fails, downstream code falls back to the plain
    // artwork image rather than blocking checkout.
    const captureVisualizerImage = async () => {
        const sourceImage = productionImage || uploadedImage;
        if (!sourceImage) return null;

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = sourceImage;
            });

            const isCanvasPrint = selectedFrame?.id === 'frame-canvas';
            // A regular frame with "Canvas Print" glazing — mirrors the live
            // visualizer's isCanvasGlazing flag, so the order thumbnail
            // reflects the same Floater reveal-gap / Traditional overlap
            // instead of rendering as a plain matted print.
            const isTraditionalCanvas = glassType === 'canvas-traditional' && !isCanvasPrint;
            const isFloaterCanvas = glassType === 'canvas-floater' && !isCanvasPrint;
            const isCanvasGlazing = isTraditionalCanvas || isFloaterCanvas;
            // selectedSize's width/height are the size preset's canonical
            // (portrait) dimensions — swap them for landscape, same as the
            // live on-screen visualizer (wInch/hInch above), otherwise the
            // captured thumbnail renders in the wrong orientation whenever
            // the user has flipped to landscape.
            const sizeW = selectedSize ? (orientation === 'portrait' ? selectedSize.width : selectedSize.height) : null;
            const sizeH = selectedSize ? (orientation === 'portrait' ? selectedSize.height : selectedSize.width) : null;
            const frameAspect = sizeW && sizeH ? sizeW / sizeH : img.naturalWidth / img.naturalHeight;

            // Every thumbnail slot that displays this capture (cart, admin
            // dashboard, checkout, admin fulfillment) is a fixed square box
            // using object-cover — a non-square capture gets its long edges
            // cropped off there, hiding two of the frame's four sides. So the
            // capture itself is always a square canvas with the framed piece
            // fully contained (never cropped) inside it, whatever its own
            // portrait/landscape aspect ratio actually is.
            const CANVAS_SIZE = 1200;
            const canvas = document.createElement('canvas');
            canvas.width = CANVAS_SIZE;
            canvas.height = CANVAS_SIZE;
            const ctx = canvas.getContext('2d');

            const maxDim = CANVAS_SIZE * 0.88; // margin so the frame isn't flush with the thumbnail edge
            const w = frameAspect >= 1 ? maxDim : maxDim * frameAspect;
            const h = frameAspect >= 1 ? maxDim / frameAspect : maxDim;
            const offsetX = (CANVAS_SIZE - w) / 2;
            const offsetY = (CANVAS_SIZE - h) / 2;

            const borderW = isCanvasPrint ? 0 : Math.round(w * 0.06);
            const borderH = isCanvasPrint ? 0 : Math.round(h * 0.06);
            // Traditional canvas mount: the frame's inner lip overlaps the
            // canvas edges, so the border is painted AFTER the image (below,
            // deferred) instead of before, letting it visually crop the
            // artwork's bleeding edge rather than just framing beside it.
            if (!isCanvasPrint && !isTraditionalCanvas) {
                ctx.fillStyle = selectedFrame?.baseColor || '#342e2b';
                ctx.fillRect(offsetX, offsetY, w, h);
            }

            const matPct = (!isCanvasPrint && !isCanvasGlazing && matWidth !== 'none') ? ({ narrow: 0.04, standard: 0.06, wide: 0.08 }[matWidth] || 0.04) : 0;
            const matW = Math.round(w * matPct);
            const matH = Math.round(h * matPct);
            const matLeft = offsetX + borderW, matTop = offsetY + borderH, matRight = offsetX + w - borderW, matBottom = offsetY + h - borderH;
            if (matPct > 0) {
                ctx.fillStyle = matColor?.hex || '#ffffff';
                ctx.fillRect(matLeft, matTop, matRight - matLeft, matBottom - matTop);
            }

            // Floater canvas mount: reveal a thin gap between the frame's
            // inner wall and the canvas edge, mirroring the live
            // visualizer's reveal gap.
            const gapPx = isFloaterCanvas ? Math.round(Math.min(w, h) * 0.02) : 0;
            if (gapPx > 0) {
                ctx.fillStyle = '#78716c';
                ctx.fillRect(matLeft, matTop, matRight - matLeft, matBottom - matTop);
            }
            // Traditional canvas mount: let the artwork bleed slightly
            // further than the border's inner edge so the border (painted
            // after, below) crops it.
            const overlapPx = isTraditionalCanvas ? Math.round(Math.min(borderW, borderH) * 0.5) : 0;

            const artLeft = matLeft + matW + gapPx - overlapPx;
            const artTop = matTop + matH + gapPx - overlapPx;
            const artW = Math.max(1, (matRight - matW - gapPx + overlapPx) - artLeft);
            const artH = Math.max(1, (matBottom - matH - gapPx + overlapPx) - artTop);

            // Canvas prints (both the frame-less Gallery Wrap and a regular
            // frame with Canvas Print glazing) wrap edge-to-edge (cover);
            // framed art is letterboxed within the mat opening (contain) —
            // mirrors the object-fit rules used in the live visualizer.
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const boxAspect = artW / artH;
            let drawW, drawH;
            const widthConstrained = imgAspect > boxAspect;
            if ((isCanvasPrint || isCanvasGlazing) ? widthConstrained : !widthConstrained) {
                drawH = artH;
                drawW = artH * imgAspect;
            } else {
                drawW = artW;
                drawH = artW / imgAspect;
            }
            const drawX = artLeft + (artW - drawW) / 2;
            const drawY = artTop + (artH - drawH) / 2;

            ctx.save();
            ctx.beginPath();
            ctx.rect(artLeft, artTop, artW, artH);
            ctx.clip();
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.restore();

            // Traditional canvas mount: paint the border ring last so it
            // sits on top of and crops the artwork's bleeding edge (deferred
            // from above, where it was skipped).
            if (isTraditionalCanvas) {
                ctx.fillStyle = selectedFrame?.baseColor || '#342e2b';
                ctx.fillRect(offsetX, offsetY, w, borderH); // top
                ctx.fillRect(offsetX, offsetY + h - borderH, w, borderH); // bottom
                ctx.fillRect(offsetX, offsetY, borderW, h); // left
                ctx.fillRect(offsetX + w - borderW, offsetY, borderW, h); // right
            }

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) return null;
            const file = new File([blob], 'order-thumbnail.png', { type: 'image/png' });
            return await uploadImageToCloud(file);
        } catch (err) {
            console.warn('Order thumbnail generation failed, falling back to raw artwork image:', err);
            return null;
        }
    };

    const buildCartItem = (visualizerImage) => {
        const calculatedTotal = Math.round((selectedSize?.price || 0) * (selectedFrame?.priceMod || 1)) +
            (selectedFrame?.id !== 'frame-canvas' && glassType !== 'canvas-floater' && glassType !== 'canvas-traditional' && matWidth !== 'none' ? (matColor.price || 75) : 0) +
            (selectedFrame?.id !== 'frame-canvas' ? (glassType === 'non-glare' ? 100 : glassType === 'museum' ? 200 : 0) : 0) +
            (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-floater' ? 400 : 0) +
            (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-traditional' ? 350 : 0) +
            (hardwareType === 'french-cleat' ? 50 : 0);

        return {
            productMode: 'frame',
            uploadedImage,
            productionImage,
            visualizerImage,
            selectedFrame,
            selectedSize,
            totalPrice: calculatedTotal,
            orientation,
            matColor,
            matWidth,
            glassType,
            hardwareType,
            activeLayout,
            collageImages,
            frameThickness,
            isPreset,
            presetTitle,
            presetDims,
            isAlbumArt,
            isAlbumPoster,
            isMoviePoster,
            isMoviePosterPrint,
            posterMeta: isAlbumPoster && posterData ? {
                title: posterData.product.title,
                artist: posterData.product.artist,
                trackCount: posterData.tracksInfo.tracks.length
            } : isMoviePosterPrint && posterData ? {
                title: posterData.movie.title,
                director: posterData.details.director
            } : null
        };
    };

    // Filter and sort sizes so more "popular" sizes — a small footprint and
    // a close-to-square, standard-print ratio — surface first. Primary key
    // is the longer side (the dimension that actually reads as "how big is
    // this on my wall"), so a 10x60cm strip sorts alongside other ~60cm
    // pieces rather than jumping the queue on its modest area; secondary key
    // is the aspect ratio itself, so among same-footprint sizes the more
    // square/standard one ranks first, ahead of an equally-tall but skinnier
    // alternative; area is the final tiebreaker for genuine ties.
    // This sort/filter/dedup runs over the entire FRAME_SIZES catalog, so it's
    // memoized against just the flags/image data that actually change its
    // output — without this it was recomputing from scratch on every render
    // (every keystroke in the custom-size inputs, every unrelated state
    // change), which is the single most render-heavy page in the app.
    const { finalSizesList, leftColumnCollapsed, rightColumnCollapsed } = useMemo(() => {
        const uniqueSizes = [];
        const sizeSeen = new Set();
        const sortedSizes = [...FRAME_SIZES].sort((a, b) => {
            const aMax = Math.max(a.width, a.height), aMin = Math.min(a.width, a.height);
            const bMax = Math.max(b.width, b.height), bMin = Math.min(b.width, b.height);
            if (aMax !== bMax) return aMax - bMax;
            const aRatio = aMax / aMin, bRatio = bMax / bMin;
            if (Math.abs(aRatio - bRatio) > 0.001) return aRatio - bRatio;
            return (a.width * a.height) - (b.width * b.height);
        });

        // Check if the image is square
        const isSquareArtwork = isAlbumArt || (imageNaturalSize && imageNaturalSize.w > 0 && Math.abs(imageNaturalSize.w - imageNaturalSize.h) <= 5);

        for (const size of sortedSizes) {
            // If it's a square image (like album art), only allow square sizes
            if (isSquareArtwork && size.width !== size.height) {
                continue;
            }

            // Album posters and movie posters are portrait-or-square — a landscape
            // canvas doesn't suit their tracklist/cast-list layout, but square
            // (e.g. 20x20cm) is a valid alternate format alongside true portrait.
            if ((isAlbumPoster || isMoviePoster || isMoviePosterPrint) && size.height < size.width) {
                continue;
            }

            const key = `${size.width}x${size.height}`;
            const isAlias = ['sm', 'md', 'lg', 'xl', 'lg-land', 'xl-land', 'Small', 'Medium', 'Large', 'Statement'].includes(size.id);
            if (!sizeSeen.has(key) && !isAlias) {
                sizeSeen.add(key);
                uniqueSizes.push(size);
            }
        }

        // Sizes with an extreme, mismatched aspect ratio (17x60cm, 10x60cm, and
        // similar panoramic/banner shapes) are niche next to standard photo/
        // print/A-series ratios — there's a clean gap in the catalog between
        // ~1.54:1 (standard) and 2:1 (niche), so 1.8 sits safely in between
        // regardless of float precision. Dropped from the picker entirely
        // (collapsed and expanded) rather than just demoted — anyone who
        // actually wants one of these shapes can dial it in via Custom Size.
        const NICHE_ASPECT_RATIO = 1.8;
        const isNicheAspect = (size) => (Math.max(size.width, size.height) / Math.min(size.width, size.height)) > NICHE_ASPECT_RATIO;
        const normalSizes = uniqueSizes.filter(s => !isNicheAspect(s));

        const finalSizesList = normalSizes;

        // Collapsed view is curated, not a slice of the full catalog: left column
        // is the most popular small-to-medium sizes, right column the most
        // popular large-to-very-large sizes, each ascending top to bottom. IDs
        // are looked up against normalSizes so category filters (square-only
        // album art, portrait-or-square posters) still apply — a popular ID that
        // isn't available under the current filter is just skipped rather than
        // leaving a gap.
        const popularSmallIds = ['5x7', '8x10', 'a4', '11x14', '12x12', 'a3'];
        const popularLargeIds = ['16x20', 'a2', '18x24', '20x30', '24x36', '100x100cm'];
        const findPopular = (ids) => ids.map(id => normalSizes.find(s => s.id === id)).filter(Boolean);
        const leftColumnCollapsed = findPopular(popularSmallIds);
        const rightColumnCollapsed = findPopular(popularLargeIds);

        return { finalSizesList, leftColumnCollapsed, rightColumnCollapsed };
    }, [isAlbumArt, isAlbumPoster, isMoviePoster, isMoviePosterPrint, imageNaturalSize]);

    // A created custom size stays visible as the LAST option — same spot as
    // the "Custom Size" trigger button itself — even after the user selects
    // a different size, so it isn't lost the moment it's no longer active.
    // (It's tracked in its own customSizeEntry state rather than derived from
    // selectedSize for exactly this reason.) Skipped if it happens to
    // duplicate a catalog size already in the list.
    const showCustomEntry = customSizeEntry && !finalSizesList.some(s => s.width === customSizeEntry.width && s.height === customSizeEntry.height);

    // Total catalog sizes actually visible in the collapsed view, used to
    // decide whether "+ more sizes" should appear at all and what count to
    // show on it.
    const collapsedShownCount = leftColumnCollapsed.length + rightColumnCollapsed.length + (showCustomEntry ? 1 : 0);

    const renderSizeButton = (size) => (
        <button
            key={size.id}
            onClick={() => setSelectedSize(size)}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                (selectedSize.width === size.width && selectedSize.height === size.height)
                    ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                    : 'border-stone-200 hover:border-stone-400 text-stone-700'
            }`}
        >
            {formatDimensions(size.label, unit, orientation)}
            {/* A user-typed size gets a small superscript "+" after the unit —
                subtle enough not to look like a badge, but enough to mark it
                as "the one you made" alongside the catalog sizes. */}
            {size.id?.startsWith('custom-') && <sup className="ml-0.5">+</sup>}
        </button>
    );

    // Builds a size entry from the user's own width/height (in whatever unit
    // the page is currently displaying) via the same parseCustomSize helper
    // Inspiration selections use for arbitrary catalogue dimensions — reusing
    // it keeps custom sizes priced and portrait/landscape-tagged consistently
    // with everything else. orientation must be set explicitly alongside
    // selectedSize (they're independent state — see wInch/hInch above), or
    // the frame renders with the previous selection's orientation.
    const applyCustomSize = () => {
        const w = parseFloat(customWidthInput);
        const h = parseFloat(customHeightInput);
        if (!w || !h || w <= 0 || h <= 0) {
            setCustomSizeError('Enter a width and height.');
            return;
        }
        const wCm = unit === 'cm' ? w : w * 2.54;
        const hCm = unit === 'cm' ? h : h * 2.54;
        const MAX_CM = 180;
        if (wCm > MAX_CM || hCm > MAX_CM) {
            setCustomSizeError(unit === 'cm' ? 'Max custom size is 180 x 180 cm.' : 'Max custom size is 70.9 x 70.9 in.');
            return;
        }
        // Smallest allowed matches the smallest catalog size (5x7in / 13x18cm),
        // in either orientation — so 13x18 and 18x13 both pass, but nothing
        // smaller on either side does.
        const MIN_SHORT_CM = 13, MIN_LONG_CM = 18;
        const shortSide = Math.min(wCm, hCm);
        const longSide = Math.max(wCm, hCm);
        if (shortSide < MIN_SHORT_CM || longSide < MIN_LONG_CM) {
            setCustomSizeError(unit === 'cm' ? 'Smallest custom size is 13 x 18 cm.' : 'Smallest custom size is 5 x 7 in.');
            return;
        }
        const customSize = parseCustomSize(`${wCm} x ${hCm} cm`);
        if (!customSize) {
            setCustomSizeError('Could not create that size.');
            return;
        }
        setSelectedSize(customSize);
        setCustomSizeEntry(customSize);
        setOrientation(customSize.orientation);
        setCustomSizeError('');
        setShowCustomSizeForm(false);
        setCustomWidthInput('');
        setCustomHeightInput('');
    };

    // Expanding/collapsing the sizes list drastically changes the Dimensions
    // section's height — collapsing in particular can shrink the page enough
    // that the browser's unchanged scrollY now lands well past where the
    // toggle button used to be, landing the viewport on an unrelated section
    // further down (e.g. the checkout footer). Re-anchor on the toggle button
    // itself so it stays in the same visual spot across the layout change.
    const toggleShowAllSizes = (next) => (e) => {
        const beforeTop = e.currentTarget.getBoundingClientRect().top;
        setShowAllSizes(next);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const btn = document.querySelector('[data-size-list-toggle]');
                if (btn) {
                    const afterTop = btn.getBoundingClientRect().top;
                    window.scrollBy(0, afterTop - beforeTop);
                }
            });
        });
    };

    let stepCounter = 1;
    const stepArtwork = stepCounter++;
    const stepFrameStyle = stepCounter++;
    const stepDimensions = stepCounter++;
    
    const showOrientation = !isPreset && !isAlbumArt && !isAlbumPoster && !isMoviePoster && !isMoviePosterPrint;
    const stepOrientation = showOrientation ? stepCounter++ : null;
    
    // A canvas print (glassType 'canvas-floater'/'canvas-traditional') is
    // mounted inside whichever frame moulding is selected — it doesn't take
    // a paper mat, so matting is hidden for it the same way it's hidden for
    // the frame-less 'frame-canvas' Gallery Wrapped Canvas style.
    const canvasMountStyle = glassType === 'canvas-floater' ? 'floater' : glassType === 'canvas-traditional' ? 'traditional' : null;
    const isCanvasGlazing = !!canvasMountStyle && selectedFrame?.id !== 'frame-canvas';

    const showMatting = selectedFrame?.id !== 'frame-canvas' && !isCanvasGlazing && !isPreset;
    const stepMatting = showMatting ? stepCounter++ : null;

    const showGlazing = selectedFrame?.id !== 'frame-canvas';
    const stepGlazing = showGlazing ? stepCounter++ : null;
    
    const stepHardware = stepCounter++;

    // The dimension labels/tick-marks and disclaimer note are rendered
    // directly against the wall color using text-stone-800/600 plus
    // mix-blend-color-burn/multiply — a deliberate "etched into the wall"
    // look that only reads clearly on light walls. Color-burn and multiply
    // both DARKEN, so on the darker solid wall colors (navy, charcoal,
    // teal, etc.) that combination crushes dark text into near-black-on-
    // near-black instead of standing out. Once the wall is dark enough that
    // treatment stops working, switch to plain light text with no blend
    // mode, which stays legible against any solid color.
    const activeRoom = roomSceneId ? ROOM_SCENES.find((s) => s.id === roomSceneId) : null;

    const wallLuminance = (() => {
        const hex = wallColor.hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    })();
    const isDarkWall = wallLuminance < 0.5;
    const wallInkClass = isDarkWall ? 'text-stone-100' : 'text-stone-800';
    const wallInkBorderClass = isDarkWall ? 'border-stone-100' : 'border-stone-800';
    const wallInkBgClass = isDarkWall ? 'bg-stone-100' : 'bg-stone-800';
    const wallInkBlend = isDarkWall ? '' : 'mix-blend-color-burn';
    const wallNoteClass = isDarkWall ? 'text-stone-100/85' : 'text-stone-600/70';
    const wallNoteBlend = isDarkWall ? '' : 'mix-blend-multiply';

    if (!selectedSize || !selectedFrame) return <div className="min-h-screen bg-[#faf9f8]" />;

    return (
        <div className={`flex ${isSideBySide ? 'flex-row h-[calc(100dvh-56px)] overflow-hidden' : 'flex-col min-h-[calc(100dvh-56px)]'} bg-[#faf9f8]`}>
            
            {/* LEFT: IMMERSIVE VISUALIZER */}
            <div
                className={`flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMaxZoom ? 'overflow-auto' : 'overflow-hidden'} [scrollbar-gutter:stable] ${paneVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${
                    isFullScreen
                        ? 'fixed inset-0 z-[250]'
                        // Stacked mobile/narrow layout: pin the visualizer just below the
                        // header instead of letting it scroll away with the page, so it
                        // stays in view while the customization panel underneath scrolls.
                        // Desktop side-by-side already keeps it in view (fixed-height row,
                        // panel scrolls in its own container), so sticky is a no-op there.
                        : `shrink-0 relative border-r border-stone-200 ${isSideBySide ? 'w-[70%] h-auto shrink' : 'w-full sticky top-[60px] z-30'}`
                }`}
                style={{
                    backgroundColor: wallColor.hex,
                    height: (!isFullScreen && !isSideBySide) ? `${visualizerMetrics.height}px` : undefined
                }}
            >

                
                {/* Wall Color Palette - Floating Top Right (fades out in the
                    full-screen enhanced view — chrome-free by design — and
                    also while double-tap/double-click max-zoom is active,
                    since that's its own immersive "get in close" mode where
                    this chrome would just clutter the zoomed frame — rather
                    than hard-unmounting, so it's a smooth part of the same
                    transition instead of an instant pop) */}
                <div className={`absolute top-3 right-3 sm:top-6 sm:right-6 z-20 transition-opacity duration-300 ${(isFullScreen || isMaxZoom) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button
                        onClick={() => setIsWallPickerOpen(!isWallPickerOpen)}
                        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all bg-white/95 backdrop-blur text-stone-700 font-semibold text-xs ml-auto"
                        title="Change Wall Color"
                    >
                        <div className="w-4 h-4 rounded-full border border-stone-200 shrink-0" style={{ backgroundColor: wallColor.hex, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }} />
                        <span className="hidden sm:inline [font-variant:small-caps]">wall color</span>
                        <ChevronDown size={14} className={`transition-transform text-stone-400 ${isWallPickerOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* The Expanded Picker */}
                    <div
                        className={`absolute top-10 right-0 mt-2 bg-white/95 backdrop-blur shadow-xl border border-stone-100 rounded-xl p-2.5 w-[90px] origin-top-right transition-all duration-300 ease-out flex flex-col items-center ${
                            isWallPickerOpen 
                                ? 'opacity-100 translate-y-0 pointer-events-auto' 
                                : 'opacity-0 -translate-y-2 pointer-events-none'
                        }`}
                        style={{
                            transform: isWallPickerOpen 
                                ? `scale(${visualizerMetrics.height ? Math.max(0.55, Math.min(1, (visualizerMetrics.height - 60) / 250)) : 1})`
                                : 'scale(0.95)'
                        }}
                    >
                        <p className="text-[10px] font-bold tracking-wider text-stone-500 mb-2 text-center w-full whitespace-nowrap sm:hidden [font-variant:small-caps]">wall color</p>
                        <div className="grid grid-cols-2 gap-1.5 place-items-center">
                            {WALL_COLORS.map(color => (
                                <button
                                    key={color.id}
                                    onClick={() => { setWallColor(color); setIsWallPickerOpen(false); }}
                                    title={color.name}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform ${wallColor.id === color.id ? 'border-stone-900 scale-110 shadow-sm' : 'border-stone-200 hover:scale-110'}`}
                                    style={{ backgroundColor: color.hex, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}
                                />
                            ))}
                        </div>

                        {/* Scene picker. The wall colour above still applies in a room
                            scene — the scene's wall repaints with it — so these are
                            complementary choices, not alternatives, and belong in the
                            same popover. */}
                        <div className="w-full mt-2.5 pt-2.5 border-t border-stone-200">
                            <p className="text-[10px] font-bold tracking-wider text-stone-500 mb-1.5 text-center w-full whitespace-nowrap [font-variant:small-caps]">scene</p>
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => { setRoomSceneId(null); setIsWallPickerOpen(false); }}
                                    className={`w-full px-1.5 py-1 rounded-md text-[9px] font-semibold leading-tight transition-colors ${
                                        !activeRoom ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                    }`}
                                >
                                    Plain wall
                                </button>
                                {ROOM_SCENES.map((scene) => (
                                    <button
                                        key={scene.id}
                                        onClick={() => { setRoomSceneId(scene.id); setIsWallPickerOpen(false); }}
                                        title={`${scene.name} — ${scene.wallSpanCm}cm wall`}
                                        className={`w-full px-1.5 py-1 rounded-md text-[9px] font-semibold leading-tight transition-colors ${
                                            roomSceneId === scene.id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                        }`}
                                    >
                                        {scene.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dimension Toggle & Unit Selector - Dynamic Pill (fades out
                    in the full-screen enhanced view and during max-zoom,
                    same treatment as the Wall Color palette above) */}
                <div className={`absolute top-3 left-3 sm:top-6 sm:left-6 z-20 flex items-stretch bg-white/95 backdrop-blur border border-stone-200 rounded-full shadow-sm hover:shadow-md transition-all overflow-hidden h-8 sm:h-9 duration-300 ${(isFullScreen || isMaxZoom) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button
                        onClick={() => setShowDimensions(!showDimensions)}
                        className={`flex items-center gap-1.5 px-3 h-full text-xs font-semibold transition-colors ${
                            showDimensions ? 'bg-stone-100 text-stone-900 border-r border-stone-200' : 'text-stone-600 hover:text-stone-900 bg-white'
                        }`}
                        title="Toggle Dimensions"
                    >
                        <Ruler size={14} className="shrink-0" />
                    </button>
                    
                    {/* Unit Toggles (Slide in/out) */}
                    <div 
                        className={`flex items-stretch transition-all duration-300 ease-out origin-left bg-white ${
                            showDimensions ? 'w-[72px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'
                        }`}
                    >
                        <button
                            onClick={() => setUnit('in')}
                            className={`flex-1 h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                unit === 'in' ? 'text-stone-900 bg-stone-50' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50/50'
                            }`}
                        >
                            in
                        </button>
                        <div className="w-px h-full bg-stone-200"></div>
                        <button
                            onClick={() => setUnit('cm')}
                            className={`flex-1 h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                unit === 'cm' ? 'text-stone-900 bg-stone-50' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50/50'
                            }`}
                        >
                            cm
                        </button>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    FRAME STUDIO — rebuilt from scratch
                    
                    Physical scale system:
                    • The sofa SVG = 160 cm, rendered at 100% of the scale container width.
                    • The scale container = 80% of the wall panel width.
                    • 1% of scale container = 1.6 cm.
                    • Frame width % = (frameCm / 160) × 100
                    • Portrait ↔ Landscape: wInch and hInch simply swap → exact inverses.
                    
                    Moulding:
                    • baseThicknessInch = visual moulding width (renders inside frame container)
                    • baseThicknessPct = moulding as % of frame container width
                    • sideHeightPct = moulding as % of frame container height
                    ═══════════════════════════════════════════════════════════════ */}
                <div 
                    className={`relative h-full max-w-[1200px] mx-auto flex items-center justify-center mt-6 ${isSideBySide ? 'aspect-auto h-[85dvh] mt-12 w-full' : 'w-full'}`}
                    style={{ width: visualizerMetrics.scale < 1 ? `${visualizerMetrics.scale * 100}%` : undefined }}
                >
                    
                    {/* ── FRAME POSITIONING ZONE ── */}
                    <div
                        ref={zoneRef}
                        className={`absolute left-0 w-full flex flex-col items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isFullScreen
                                // In full-screen mobile the note is a real footer below
                                // this zone, not an overlay on top of the rendering.
                                ? 'top-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] h-auto sm:bottom-0 sm:h-full'
                                : 'top-12 sm:top-14 h-[calc(65%-3rem)] sm:h-[calc(65%-3.5rem)]'
                        }`}
                        onClick={(e) => {
                            // This zone (not the outer visualizer pane) is
                            // what actually receives clicks in the empty
                            // margin around the frame — the room-scene
                            // backdrop behind it is pointer-events-none, so
                            // clicking the wall bubbles straight through to
                            // here as e.target === e.currentTarget, while
                            // clicking the frame itself (or the wall-color/
                            // exit-fullscreen buttons, which sit outside
                            // this zone) leaves e.target pointing at that
                            // child instead and this is a no-op for it.
                            if (isFullScreen && e.target === e.currentTarget) exitFullScreen();
                        }}
                    >

                        {/* ── ROOM SCENE BACKDROP ──
                            Sized so its wall span is exactly the zone's width, which is
                            what lets the frame's own width percentage (computed against
                            this same zone) be a direct cm ratio — see the frame's scale
                            block below. Then it's offset so the scene's hang point lands
                            on the zone's centre, where the frame is already flex-centred.
                            Offsetting the scene rather than the frame keeps the entire
                            existing frame layout — zoom, overflow correction, dimension
                            labels — untouched. */}
                        {activeRoom && (() => {
                            const sceneW = zoneSize.width;
                            const sceneH = sceneW * (activeRoom.sceneHeightCm / activeRoom.wallSpanCm);
                            const sceneLeft = sceneW * (0.5 - activeRoom.hang.x / 100);
                            const sceneTop = (zoneSize.height / 2) - (activeRoom.hang.y / 100) * sceneH;
                            return (
                                <div
                                    className={`absolute pointer-events-none z-0 transition-opacity duration-500 ${
                                        // Matches the sofa cue's own fade condition, and for the same
                                        // reason: all three of these states zoom the frame past its
                                        // true size (frameWidthPct * zoomScale) while the scene stays
                                        // put, so leaving the room visible would show the artwork at a
                                        // scale it isn't. Fading out drops the scale claim rather than
                                        // making a false one.
                                        isHovered || isMaxZoom || isFullScreen ? 'opacity-0' : 'opacity-100'
                                    }`}
                                    style={{ left: sceneLeft, top: sceneTop, width: sceneW, height: sceneH }}
                                    aria-hidden="true"
                                >
                                    {activeRoom.tintable ? (
                                        <StudioLoftScene wallHex={wallColor.hex} isDarkWall={isDarkWall} />
                                    ) : (
                                        <img src={activeRoom.image} alt="" className="w-full h-full object-fill" />
                                    )}
                                    {/* Continues the floor to the bottom of the panel so the
                                        scene reads as full-bleed instead of a letterboxed
                                        picture. Above the scene the panel's own wall colour
                                        already matches, so only the floor needs this. */}
                                    {activeRoom.floorHex && (
                                        <div
                                            className="absolute left-0 w-full"
                                            style={{ top: '100%', height: '100vh', backgroundColor: activeRoom.floorHex }}
                                        />
                                    )}
                                </div>
                            );
                        })()}

                        {/* ── THE FRAME ── */}
                        {(() => {
                            // ─── PHYSICAL SCALE MATH (from scratch) ───
                            // The sofa SVG container is 48% of the parent. The drawn sofa body is
                            // 700/800 = 87.5% of the SVG. So the sofa body = 48% × 87.5% = 42% of parent.
                            // The sofa body = 160cm. So a frame must be:
                            //   frameWidthPct = (frameCm / 160) × 42   (as % of parent)
                            // This way a 160cm frame exactly overlaps the 160cm sofa body.
                            const SOFA_CM = 160;
                            const SOFA_BODY_PCT = 42; // sofa body occupies 42% of the parent container
                            const innerWidthCm = wInch * 2.54;
                            const innerHeightCm = hInch * 2.54;
                            // Both branches are the same conversion — physical cm to a
                            // percentage of this zone's width — differing only in what the
                            // zone represents. Against the sofa cue, the zone is scaled so
                            // 160cm spans SOFA_BODY_PCT of it; in a room scene, the zone
                            // width IS the room's wall span (the backdrop below is sized to
                            // exactly fill it), so the conversion is a direct ratio.
                            const roomPlacement = activeRoom
                                ? computeRoomPlacement(activeRoom, innerWidthCm, innerHeightCm)
                                : null;
                            const frameWidthPct = roomPlacement
                                ? roomPlacement.widthPct
                                : (innerWidthCm / SOFA_CM) * SOFA_BODY_PCT;
                            
                            // Moulding: Dynamic visual thickness
                            // We determine if a frame is narrow, standard, or wide based on its catalogue data.
                            const standardVisualPct = (() => {
                                if (!selectedFrame || !selectedFrame.widthCategory) return 5;
                                if (selectedFrame.widthCategory === 'wide') return 10;
                                if (selectedFrame.widthCategory === 'narrow') return 2;
                                return 5;
                            })();
                            const minSide = Math.min(wInch, hInch);
                            const mouldingPctW = (minSide / wInch) * standardVisualPct;
                            const mouldingPctH = (minSide / hInch) * standardVisualPct;
                            
                            // Mat inset as % of frame width/height
                            // Clamp the max inset so we don't mathematically collapse the artwork to 0 or negative
                            const rawMatPctW = matWidth !== 'none' ? (currentMatInches / wInch) * 100 : 0;
                            const rawMatPctH = matWidth !== 'none' ? (currentMatInches / hInch) * 100 : 0;
                            const matPctW = Math.max(0, Math.min(rawMatPctW, 45 - mouldingPctW));
                            const matPctH = Math.max(0, Math.min(rawMatPctH, 45 - mouldingPctH));

                            // Canvas Print mount styles (glassType 'canvas'): Floater reveals a
                            // small gap between the canvas edge and the frame's inner wall;
                            // Traditional lets the frame's inner lip overlap and hide the canvas
                            // edge. Both a fixed physical inch amount converted to %, same
                            // derivation as matPct above, so they scale sensibly across sizes.
                            const floaterGapPctW = (0.25 / wInch) * 100;
                            const floaterGapPctH = (0.25 / hInch) * 100;
                            const traditionalOverlapPctW = Math.min(0.375 / wInch * 100, mouldingPctW);
                            const traditionalOverlapPctH = Math.min(0.375 / hInch * 100, mouldingPctH);

                            // ─── DYNAMIC ZOOM CLAMPING (Never Overlap/Cutoff) ───
                            const zoomScale = (() => {
                                // isMaxZoom alone (without isHovered) is how touch double-tap
                                // drives this — touch devices never fire mouseenter, so gating
                                // purely on isHovered left double-tap zoom permanently inert on
                                // mobile/tablet. Full screen always computes a scale (the
                                // "enhanced" standalone view) regardless of hover/tap state —
                                // there's no sofa/dashboard to preserve physical scale against
                                // once those are hidden, so it's always shown as large as
                                // possible instead of requiring a hover to reveal that.
                                if (!isHovered && !isMaxZoom && !isFullScreen) return 1.0;

                                // Calculate unzoomed dimensions in pixels relative to the physical container
                                const baseWidthPx = (frameWidthPct / 100) * zoneSize.width;
                                const baseHeightPx = baseWidthPx * (hInch / wInch);

                                // Safe zoom boundaries: never exceed 90% of zone height or 85% of
                                // zone width. On mobile full-screen the zone itself stops above the
                                // note footer, so the frame and its note can never overlap.
                                const maxZoomWidthPx = zoneSize.width * 0.85;
                                const maxZoomHeightPx = isFullScreen
                                    ? Math.max(80, zoneSize.height * 0.90)
                                    : zoneSize.height * 0.90;

                                const safeBaseW = baseWidthPx > 0 ? baseWidthPx : 1;
                                const safeBaseH = baseHeightPx > 0 ? baseHeightPx : 1;

                                const scaleW = maxZoomWidthPx / safeBaseW;
                                const scaleH = maxZoomHeightPx / safeBaseH;

                                // Max possible scale that fits safely inside the visual bounds
                                let maxScale = Math.min(scaleW, scaleH);

                                // Album/movie poster prints carry small fixed tracklist/metadata
                                // text (rendered at up to 300 DPI, well beyond what these caps
                                // need — see the poster-generation effect above), so they can
                                // safely zoom further than a plain photo before pixelating, and
                                // doing so is the whole point of zooming/full-screen for them:
                                // reading that fine print. Regular uploads don't carry that
                                // fixed small text, so they keep the original, more conservative
                                // caps.
                                const isPosterPrint = isAlbumPoster || isMoviePosterPrint;

                                if (isMaxZoom && !isFullScreen) {
                                    // Deep inspection mode: push past boundaries if necessary (but
                                    // don't get completely ridiculous). Skipped in full screen —
                                    // it's already at its largest fit-to-screen size there, so
                                    // there's nothing further for a double-tap to usefully do.
                                    return Math.max(isPosterPrint ? 5.5 : 3.5, maxScale * (isPosterPrint ? 3 : 2.25));
                                }

                                // Cap at 8.0x (16.0x for poster prints) to prevent over-pixelation
                                // on tiny frames, never shrink below 1.0x.
                                return Math.max(1.0, Math.min(isPosterPrint ? 16.0 : 8.0, maxScale));
                            })();

                            // Calculate push down amount so the top of the frame isn't hidden behind the header in max zoom
                            const pushDownAmount = (() => {
                                if (!isMaxZoom) return 0;
                                const baseWidthPx = (frameWidthPct / 100) * zoneSize.width;
                                const baseHeightPx = baseWidthPx * (hInch / wInch);
                                const targetHeight = baseHeightPx * zoomScale;
                                const overflowTop = (targetHeight - zoneSize.height) / 2;
                                return overflowTop > 0 ? (overflowTop * 2) + 40 : 0;
                            })();

                            const pushRightAmount = (() => {
                                if (!isMaxZoom) return 0;
                                const baseWidthPx = (frameWidthPct / 100) * zoneSize.width;
                                const targetWidth = baseWidthPx * zoomScale;
                                const overflowLeft = (targetWidth - zoneSize.width) / 2;
                                return overflowLeft > 0 ? (overflowLeft * 2) + 40 : 0;
                            })();

                            // Dynamic Dimension Label Sizing — scales continuously with the
                            // frame's actual on-screen pixel width (small physical sizes and/or
                            // narrow browser windows both shrink zoneSize.width), so the label
                            // never looks oversized or cramped next to a tiny frame. Tailwind
                            // can't JIT a runtime-computed arbitrary value, so this drives an
                            // inline font-size rather than a text-[Npx] class.
                            const baseFrameWidthPx = (frameWidthPct / 100) * zoneSize.width;

                            // On-screen preview only — never affects what's stored on the
                            // cart item or sent to print. Inspiration/catalogue selections set
                            // uploadedImage to a full-resolution Cloudinary asset (needed later
                            // for the actual print), which is overkill for a live preview and
                            // was the main cause of the visualizer taking forever to load an
                            // inspiration pick. getThumbnailUrl no-ops for blob:/data:/non-
                            // Cloudinary URLs, so user uploads and external sources render
                            // exactly as before.
                            const displayImage = getThumbnailUrl(uploadedImage, 1400);
                            // Filling the opening edge-to-edge (object-cover) only
                            // makes sense when the image's own orientation matches
                            // the frame's — a landscape photo forced to cover a tall
                            // portrait opening (or vice versa) would have to crop
                            // away most of the image instead of just leaving a
                            // harmless white bar, which is a worse outcome. Square
                            // images always "match" since contain and cover are
                            // visually identical at a 1:1 aspect ratio.
                            const imageOrientationMatchesFrame = imageNaturalSize && (
                                imageNaturalSize.w === imageNaturalSize.h ||
                                (imageNaturalSize.w > imageNaturalSize.h && orientation === 'landscape') ||
                                (imageNaturalSize.h > imageNaturalSize.w && orientation === 'portrait')
                            );
                            const shouldFillNoMatOpening = matWidth === 'none' && imageOrientationMatchesFrame;
                            const dimTopClass = isHovered ? '-top-6' : '-top-4';
                            const dimRightClass = isHovered ? '-right-6' : '-right-4';
                            const dimFontSizePx = isHovered ? 14 : Math.max(8, Math.min(10, baseFrameWidthPx / 12));

                            return (
                                <div
                                    onMouseEnter={() => {
                                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                        setIsHovered(true);
                                    }}
                                    onMouseLeave={() => {
                                        hoverTimeoutRef.current = setTimeout(() => {
                                            setIsHovered(false);
                                            setIsMaxZoom(false);
                                        }, 50); // 50ms debounce absorbs subpixel edge jitter
                                    }}
                                    onTouchEnd={(e) => {
                                        // Mobile browsers synthesize a compatibility mouse-event
                                        // sequence (mouseenter, click, and — on a fast second tap —
                                        // dblclick) after every touchend unless it's suppressed here.
                                        // Left unchecked, that ghost mouseenter flips isHovered true
                                        // on the very first tap, then the ghost dblclick fires
                                        // onDoubleClick below, which (seeing isHovered now true)
                                        // toggles isMaxZoom a second time and cancels out the toggle
                                        // this handler just made — a real double-tap netted zero
                                        // change, and only a third tap left a visible toggle.
                                        e.preventDefault();
                                        const now = Date.now();
                                        const DOUBLE_TAP_DELAY = 300;
                                        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
                                            setIsMaxZoom(!isMaxZoom);
                                        }
                                        lastTapRef.current = now;
                                    }}
                                    onDoubleClick={() => {
                                        if (isHovered) setIsMaxZoom(!isMaxZoom);
                                    }}
                                    className={`relative shadow-[0_25px_50px_rgba(0,0,0,0.3)] select-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                        isMaxZoom && !isFullScreen ? 'cursor-zoom-out' : isFullScreen ? '' : 'cursor-zoom-in'
                                    } ${
                                        isHovered || isMaxZoom || isFullScreen
                                            ? 'shadow-[0_50px_100px_rgba(0,0,0,0.55)] z-40'
                                            : 'z-10'
                                    }`}
                                    style={{
                                        width: isHovered || isMaxZoom || isFullScreen
                                            ? `${frameWidthPct * zoomScale}%`
                                            : `${frameWidthPct}%`,
                                        aspectRatio: `${wInch} / ${hInch}`,
                                        marginTop: `${pushDownAmount}px`,
                                        marginLeft: `${pushRightAmount}px`,
                                        transform: 'translateY(0)',
                                        touchAction: 'manipulation'
                                    }}
                                >
                                    {/* Loading Overlay — scoped to just the frame itself, not the
                                        whole visualizer scene (sofa/wall shouldn't dim/blur). Ring
                                        fill corresponds to real completion: it creeps toward but
                                        never quite reaches full while loading, then snaps to 100%
                                        the instant loading actually finishes, holds briefly, then
                                        the overlay fades out. */}
                                    <div className={`absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${loadingOverlayVisible ? 'opacity-100 bg-white/40 backdrop-blur-[2px]' : 'opacity-0'}`}>
                                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 48 48">
                                            <circle cx="24" cy="24" r="20" fill="none" stroke="#e7e5e4" strokeWidth="3" />
                                            <circle
                                                cx="24" cy="24" r="20" fill="none"
                                                stroke="#c9a84c" strokeWidth="3" strokeLinecap="round"
                                                strokeDasharray="125.6"
                                                strokeDashoffset={ringComplete ? 0 : 15}
                                                style={{ transition: ringComplete ? 'stroke-dashoffset 250ms ease-out' : 'stroke-dashoffset 2.5s ease-out' }}
                                            />
                                        </svg>
                                    </div>

                                    {/* Dimension Overlays (fade out in the
                                        full-screen enhanced view — chrome-free
                                        by design — instead of hard-unmounting) */}
                                    {showDimensions && (
                                        <>
                                            <div style={{ fontSize: `${dimFontSizePx}px` }} className={`absolute ${dimTopClass} left-0 w-full flex items-center justify-center ${wallInkClass} font-mono border-t ${wallInkBorderClass} pt-1 ${wallInkBlend} ${isFullScreen ? 'opacity-0' : 'opacity-80'} transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap overflow-visible pointer-events-none`}>
                                                <div className={`absolute left-0 top-0 h-1.5 sm:h-2 w-px ${wallInkBgClass}`} />
                                                <div className={`absolute right-0 top-0 h-1.5 sm:h-2 w-px ${wallInkBgClass}`} />
                                                {unit === 'in' ? wInch.toFixed(1) : innerWidthCm.toFixed(1)} {unit === 'in' ? 'in' : 'cm'}
                                            </div>
                                            <div style={{ fontSize: `${dimFontSizePx}px` }} className={`absolute ${dimRightClass} top-0 h-full flex flex-col items-center justify-center ${wallInkClass} font-mono border-r ${wallInkBorderClass} pr-1 ${wallInkBlend} ${isFullScreen ? 'opacity-0' : 'opacity-80'} transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap overflow-visible pointer-events-none`}>
                                                <div className={`absolute right-0 top-0 w-1.5 sm:w-2 h-px ${wallInkBgClass}`} />
                                                <div className={`absolute right-0 bottom-0 w-1.5 sm:w-2 h-px ${wallInkBgClass}`} />
                                                <span style={{ writingMode: 'vertical-rl' }}>{unit === 'in' ? hInch.toFixed(1) : innerHeightCm.toFixed(1)} {unit === 'in' ? 'in' : 'cm'}</span>
                                            </div>
                                        </>
                                    )}

                                    {isPreset ? (
                                        <div className="absolute inset-0 shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden z-20">
                                            {uploadedImage && (
                                                <img
                                                    src={displayImage}
                                                    alt="Preset Frame"
                                                    className="w-full h-full object-contain"
                                                    ref={(el) => { if (el && el.complete) setIsImageLoading(false); }}
                                                    onLoad={() => setIsImageLoading(false)}
                                                    onError={() => setIsImageLoading(false)}
                                                />
                                            )}
                                            {/* Glass Reflection for Preset */}
                                            {glassType === 'standard' && (
                                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none mix-blend-overlay z-40" />
                                            )}
                                            {glassType === 'museum' && (
                                                <div className="absolute inset-0 bg-stone-900/5 pointer-events-none mix-blend-multiply z-40" />
                                            )}
                                        </div>
                                    ) : (
                                        selectedFrame?.id !== 'frame-canvas' ? (
                                            <>
                                                {/* Outer Frame Edge — 4 Mitered 3D Borders */}
                                                <div className="absolute inset-0 transition-all duration-300">
                                                    {/* Top */}
                                                    <FrameMouldingSide
                                                        side="top"
                                                        frame={selectedFrame}
                                                        textureAnchor={frameTextureAnchor}
                                                        style={{
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            height: `${mouldingPctH}%`,
                                                            clipPath: `polygon(0 0, 100% 0, ${100 - mouldingPctW}% 100%, ${mouldingPctW}% 100%)`
                                                        }}
                                                    />
                                                    {/* Bottom */}
                                                    <FrameMouldingSide
                                                        side="bottom"
                                                        frame={selectedFrame}
                                                        textureAnchor={frameTextureAnchor}
                                                        style={{
                                                            bottom: 0,
                                                            left: 0,
                                                            right: 0,
                                                            height: `${mouldingPctH}%`,
                                                            clipPath: `polygon(${mouldingPctW}% 0, ${100 - mouldingPctW}% 0, 100% 100%, 0 100%)`
                                                        }}
                                                    />
                                                    {/* Left */}
                                                    <FrameMouldingSide
                                                        side="left"
                                                        frame={selectedFrame}
                                                        textureAnchor={frameTextureAnchor}
                                                        style={{
                                                            top: 0,
                                                            bottom: 0,
                                                            left: 0,
                                                            width: `${mouldingPctW}%`,
                                                            clipPath: `polygon(0 0, 100% ${mouldingPctH}%, 100% ${100 - mouldingPctH}%, 0 100%)`
                                                        }}
                                                    />
                                                    {/* Right */}
                                                    <FrameMouldingSide
                                                        side="right"
                                                        frame={selectedFrame}
                                                        textureAnchor={frameTextureAnchor}
                                                        style={{
                                                            top: 0,
                                                            bottom: 0,
                                                            right: 0,
                                                            width: `${mouldingPctW}%`,
                                                            clipPath: `polygon(0 ${mouldingPctH}%, 100% 0, 100% 100%, 0 ${100 - mouldingPctH}%)`
                                                        }}
                                                    />
                                                    
                                                    {/* Miter Joint Shadows */}
                                                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                                                        <line x1="0" y1="0" x2={`${mouldingPctW}%`} y2={`${mouldingPctH}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                                        <line x1="100%" y1="0" x2={`${100 - mouldingPctW}%`} y2={`${mouldingPctH}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                                        <line x1="0" y1="100%" x2={`${mouldingPctW}%`} y2={`${100 - mouldingPctH}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                                        <line x1="100%" y1="100%" x2={`${100 - mouldingPctW}%`} y2={`${100 - mouldingPctH}%`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                                    </svg>
                                                    
                                                    {/* Inner depth shadow */}
                                                    <div className="absolute inset-0 shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)] pointer-events-none z-20" />
                                                </div>
                                                    
                                                {/* Matting Background */}
                                                <div
                                                    className="absolute shadow-[0_2px_5px_rgba(0,0,0,0.15),_0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-300"
                                                    style={{
                                                        top: `${mouldingPctH}%`,
                                                        bottom: `${mouldingPctH}%`,
                                                        left: `${mouldingPctW}%`,
                                                        right: `${mouldingPctW}%`,
                                                        backgroundColor: (!isCanvasGlazing && matWidth !== 'none') ? matColor.hex : (canvasMountStyle === 'floater' ? '#78716c' : '#fff')
                                                    }}
                                                >
                                                    {/* Outer Mat Bevel (where mat meets frame) */}
                                                    {!isCanvasGlazing && matWidth !== 'none' && (
                                                        <>
                                                            <div className="absolute inset-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] pointer-events-none z-10" />
                                                            <div className="absolute -inset-[1px] border border-white/60 pointer-events-none z-10 shadow-[0_1px_1px_rgba(0,0,0,0.1)]" />
                                                        </>
                                                    )}
                                                </div>

                                            </>
                                        ) : (
                                            /* Canvas Print Rendering - 3D Edges */
                                            <div className="absolute inset-0 pointer-events-none z-10">
                                                {/* Left Edge Stretch/Mirror */}
                                                <div 
                                                    className="absolute top-0 bottom-0 left-0"
                                                    style={{
                                                        width: '4%',
                                                        backgroundImage: uploadedImage ? `url(${displayImage})` : 'none',
                                                        backgroundSize: '100% 100%',
                                                        backgroundPosition: 'left center',
                                                        transformOrigin: 'left',
                                                        transform: 'perspective(500px) rotateY(-35deg) scaleX(-1)', // Mirrored & angled
                                                        filter: 'brightness(0.6)'
                                                    }}
                                                />
                                                {/* Bottom Edge Stretch/Mirror */}
                                                <div 
                                                    className="absolute bottom-0 left-0 right-0"
                                                    style={{
                                                        height: '4%',
                                                        backgroundImage: uploadedImage ? `url(${displayImage})` : 'none',
                                                        backgroundSize: '100% 100%',
                                                        backgroundPosition: 'bottom center',
                                                        transformOrigin: 'bottom',
                                                        transform: 'perspective(500px) rotateX(35deg) scaleY(-1)', // Mirrored & angled
                                                        filter: 'brightness(0.5)'
                                                    }}
                                                />
                                                {/* 3D Box Shadow for Depth */}
                                                <div className="absolute inset-0 shadow-[-10px_10px_20px_rgba(0,0,0,0.5)] pointer-events-none z-10" />
                                            </div>
                                        )
                                    )}

                                    {/* Artwork Area */}
                                    {!isPreset && (
                                        <div
                                            className={`absolute overflow-hidden transition-all duration-300 ${isCanvasGlazing && canvasMountStyle === 'traditional' ? 'z-[5]' : 'z-20'} ${selectedFrame?.id === 'frame-canvas' || isCanvasGlazing ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]' : 'shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]'}`}
                                        style={{
                                            top: selectedFrame?.id === 'frame-canvas' || isPreset ? '0%' : isCanvasGlazing ? (canvasMountStyle === 'floater' ? `${mouldingPctH + floaterGapPctH}%` : `${Math.max(0, mouldingPctH - traditionalOverlapPctH)}%`) : `${mouldingPctH + matPctH}%`,
                                            bottom: selectedFrame?.id === 'frame-canvas' || isPreset ? '0%' : isCanvasGlazing ? (canvasMountStyle === 'floater' ? `${mouldingPctH + floaterGapPctH}%` : `${Math.max(0, mouldingPctH - traditionalOverlapPctH)}%`) : `${mouldingPctH + matPctH}%`,
                                            left: selectedFrame?.id === 'frame-canvas' || isPreset ? '0%' : isCanvasGlazing ? (canvasMountStyle === 'floater' ? `${mouldingPctW + floaterGapPctW}%` : `${Math.max(0, mouldingPctW - traditionalOverlapPctW)}%`) : `${mouldingPctW + matPctW}%`,
                                            right: selectedFrame?.id === 'frame-canvas' || isPreset ? '0%' : isCanvasGlazing ? (canvasMountStyle === 'floater' ? `${mouldingPctW + floaterGapPctW}%` : `${Math.max(0, mouldingPctW - traditionalOverlapPctW)}%`) : `${mouldingPctW + matPctW}%`,
                                            backgroundColor: (selectedFrame?.id !== 'frame-canvas' && !isCanvasGlazing && matWidth !== 'none' && !isPreset) ? matColor.hex : 'transparent'
                                        }}
                                    >
                                        {/* Inner Mat Bevel (where mat meets artwork) */}
                                        {selectedFrame?.id !== 'frame-canvas' && !isCanvasGlazing && matWidth !== 'none' && !isPreset && (
                                            <div className="absolute inset-0 shadow-[0_1px_3px_rgba(0,0,0,0.2)] pointer-events-none z-30" />
                                        )}

                                        {uploadedImage ? (
                                            <img
                                                src={displayImage}
                                                alt="Artwork"
                                                className={`w-full h-full ${selectedFrame?.id === 'frame-canvas' || isPreset || shouldFillNoMatOpening || isCanvasGlazing ? 'object-cover' : 'object-contain'}`}
                                                style={{
                                                    imageRendering: '-webkit-optimize-contrast',
                                                    transform: 'translateZ(0)',
                                                    backfaceVisibility: 'hidden',
                                                    backgroundColor: (selectedFrame?.id !== 'frame-canvas' && !isCanvasGlazing && matWidth !== 'none' && !isPreset) ? matColor.hex : 'transparent'
                                                }}
                                                // If the browser already has this image cached (e.g. it was
                                                // just shown in an Inspiration grid moments ago), `complete`
                                                // can already be true by the time this ref/onLoad attaches —
                                                // the native `load` event won't fire again in that case, so
                                                // onLoad alone can leave isImageLoading stuck true forever.
                                                ref={(el) => { if (el && el.complete) setIsImageLoading(false); }}
                                                onLoad={() => setIsImageLoading(false)}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-stone-50">
                                                <ImagePlus size={32} className="mb-2 opacity-30" />
                                                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold opacity-50 text-center px-2">Your Art Here</span>
                                            </div>
                                        )}

                                        {/* Glass Reflection */}
                                        {selectedFrame?.id !== 'frame-canvas' && glassType === 'standard' && (
                                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none mix-blend-overlay z-40" />
                                        )}
                                        {selectedFrame?.id !== 'frame-canvas' && glassType === 'museum' && (
                                            <div className="absolute inset-0 bg-stone-900/5 pointer-events-none mix-blend-multiply z-40" />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                        
                        {/* Zoomed-In Disclaimer (flows below frame on hover —
                            reuses this same hover-driven fade to also hide in
                            the full-screen enhanced view, rather than a
                            separate hard-unmount). Same wrapping approach as
                            the full-screen caption below — a width-constrained,
                            text-balanced, line-clamped paragraph instead of two
                            hardcoded nowrap lines — but NOT the same font-size
                            scale: this lives in the normal (non-full-screen)
                            pane, which on desktop (isSideBySide, >=1024px) is
                            narrowed to ~70% width by the side-by-side
                            customization panel, unlike full-screen's use of the
                            entire viewport. Verified live: at exactly 1024px
                            (the isSideBySide threshold — the narrowest point
                            once the side panel appears) 11px is the max that
                            still wraps to 2 lines; 14px (safe for full-screen at
                            that width) truncates to 3 here. 640-1023px is still
                            full-width (isSideBySide only kicks in at 1024),
                            confirmed safe up to 17px there, but capped at the
                            same 11px for one consistent sm:+ value. */}
                        <div
                            className={`w-[92%] sm:w-[70%] text-[8px] sm:text-[11px] ${wallNoteClass} select-none pointer-events-none text-center font-medium ${wallNoteBlend} px-2 leading-relaxed tracking-wide transition-all duration-500 mt-6 z-20 ${
                                (isHovered || isMaxZoom) && !isFullScreen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 h-0 overflow-hidden mt-0'
                            }`}
                        >
                            <p className="w-full line-clamp-2 text-balance">Note: Visualizer renderings are digital approximations. Finished products will feature the exact physical moulding profiles, textures, and details shown in our catalogue.</p>
                        </div>
                    </div>

                    {/* ── SCALE REFERENCE: 160cm Sofa ── (the "reference
                        artefact" — fades out via the same hover-driven
                        opacity transition it already had, rather than
                        hard-unmounting, for the full-screen enhanced view
                        which shows the frame standalone).

                        Positioned dynamically via a computed `top` (instead
                        of a fixed `bottom-5`) so it sits a small, constant
                        gap below the frame's actual rendered bottom edge
                        regardless of frame size — previously the frame was
                        just vertically centered in a fixed-percentage zone,
                        so a small frame left a huge gap above the sofa while
                        a large one crept close to it. This reuses zoneSize
                        (already measured via ResizeObserver) and the same
                        rest-state frame math the zoom system uses, so it
                        stays correct across every size/viewport combination
                        rather than assuming a percentage split holds up. */}
                    {/* Suppressed in room-scene mode: the scene draws its own 160cm sofa
                        in situ, so this floating reference would be a second, redundant
                        sofa at a different scale. */}
                    {!activeRoom && (() => {
                        const SOFA_CM_REF = 160;
                        const SOFA_BODY_PCT_REF = 42;
                        const restFrameWidthPct = (wInch && hInch) ? ((wInch * 2.54) / SOFA_CM_REF) * SOFA_BODY_PCT_REF : 0;
                        const restFrameWidthPx = (restFrameWidthPct / 100) * zoneSize.width;
                        const restFrameHeightPx = (wInch && hInch) ? restFrameWidthPx * (hInch / wInch) : 0;
                        const zoneTopOffsetPx = windowSize.width >= 640 ? 56 : 48; // matches top-14 / top-12
                        const SOFA_GAP_PX = 24;
                        const sofaTopPx = zoneTopOffsetPx + (zoneSize.height / 2) + (restFrameHeightPx / 2) + SOFA_GAP_PX;
                        // Same formula as the frame's own width/height labels
                        // (search dimFontSizePx) — scales with the frame's
                        // rendered width so the sofa's dimension text reads at
                        // a consistent size relative to the frame's, instead
                        // of a fixed size that looks oversized next to a tiny
                        // frame or undersized next to a large one.
                        const sofaDimFontSizePx = Math.max(8, Math.min(10, restFrameWidthPx / 12));

                        return (
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 w-[48%] pointer-events-none flex flex-col items-center justify-end transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isHovered || isMaxZoom || isFullScreen ? 'opacity-0 scale-75 translate-y-10' : 'opacity-100 scale-100 translate-y-0'
                        }`}
                        style={{ top: `${sofaTopPx}px` }}
                    >
                        <div className="relative w-full">
                            <svg viewBox="0 0 800 250" className={`w-full h-auto ${isDarkWall ? 'text-stone-100' : 'text-stone-900'} opacity-[0.12]`} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M50 250 L750 250 L750 150 L700 150 L700 200 L100 200 L100 150 L50 150 Z" />
                                <rect x="120" y="100" width="270" height="100" rx="10" />
                                <rect x="410" y="100" width="270" height="100" rx="10" />
                            </svg>
                        </div>

                        {/* Sofa Dimension Overlay */}
                        {showDimensions && (
                            <div style={{ fontSize: `${sofaDimFontSizePx}px` }} className={`relative w-[87.5%] mt-0 flex items-center justify-center ${wallInkClass} font-mono whitespace-nowrap border-b ${wallInkBorderClass} pb-0.5 ${wallInkBlend} opacity-80`}>
                                <div className={`absolute left-0 bottom-0 h-1.5 sm:h-2 w-px ${wallInkBgClass}`} />
                                <div className={`absolute right-0 bottom-0 h-1.5 sm:h-2 w-px ${wallInkBgClass}`} />
                                Standard 2-Seater Sofa - {unit === 'in' ? (160 / 2.54).toFixed(1) : '160.0'} {unit === 'in' ? 'in' : 'cm'}
                            </div>
                        )}
                        <div className={`text-[7px] sm:text-[9px] ${wallNoteClass} select-none text-center font-medium ${wallNoteBlend} px-2 leading-tight tracking-wide mt-1 translate-y-1.5 flex flex-col items-center`}>
                            <span className="whitespace-nowrap">Note: Visualizer renderings are digital approximations. Finished products will feature</span>
                            <span className="whitespace-nowrap">the exact physical moulding profiles, textures, and details shown in our catalogue.</span>
                        </div>
                    </div>
                        );
                    })()}

                </div>

                {/* Full-Screen Disclaimer Caption — a dedicated mobile footer
                    beneath the rendering zone, with the desktop placement
                    retained on wider screens. */}
                {isFullScreen && (
                    <div
                        className={`absolute bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 left-1/2 -translate-x-1/2 w-[92%] sm:w-[70%] text-center text-[8px] sm:text-[11px] lg:text-[14px] ${isDarkWall ? 'text-stone-100/90' : 'text-stone-600/80'} select-none pointer-events-none font-medium ${wallNoteBlend} px-2 leading-relaxed tracking-wide z-20 transition-opacity duration-500 ${
                            paneVisible ? 'opacity-100' : 'opacity-0'
                        }`}
                    >
                        {/* Sized/widened (8px + 92% on mobile, 11px from sm:,
                            14px from lg:, all at 70% width) so the full sentence
                            always wraps to exactly 2 lines with no truncation —
                            re-verified live at 375/400/640/1024/1280px widths
                            each time this was tuned. 8px is already the max that
                            fits at a 375px screen; sm:/lg: sizes take advantage
                            of the much wider layout at those breakpoints instead
                            of leaving desktop viewers stuck with a mobile-safe
                            size. The 70% width specifically keeps clear of the
                            full-screen toggle button in the opposite corner at
                            wider viewports (a wider % that also hits 2 lines
                            reached right into the button). line-clamp-2 is just
                            a backstop, not doing the real work of fitting it.
                            text-balance evens out the two lines' lengths instead
                            of leaving a long first line and a short ragged one.
                            w-[...] (not max-w) on both this div and the <p> below
                            is required — absolute positioning with only `left`
                            set otherwise shrink-to-fits narrower than intended,
                            wrapping to far more lines than the width math assumed. */}
                        <p className="w-full line-clamp-2 text-balance">Note: Visualizer renderings are digital approximations. Finished products will feature the exact physical moulding profiles, textures, and details shown in our catalogue.</p>
                    </div>
                )}

                {/* Full-Screen Toggle — stays bottom-right in every layout;
                    mobile full-screen gets a larger safe-area inset so it is
                    easy to reach without sitting against the phone corner.
                    Both icons stay mounted and crossfade/rotate via opacity —
                    an instant swap here would be a small but noticeable
                    jarring flicker right at the start of an otherwise smooth
                    transition. Hidden (not just disabled) during max-zoom —
                    you can't enter full screen from max-zoom anyway (that
                    transition resets zoom state first by design), so the
                    button has nothing useful to do there and just clutters
                    the deep-inspection view. Stays visible in isFullScreen
                    itself, since it's the only way to exit. */}
                <button
                    onClick={() => (isFullScreen ? exitFullScreen() : enterFullScreen())}
                    className={`absolute ${isFullScreen ? 'bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 sm:bottom-6 sm:right-6' : 'bottom-3 right-3 sm:bottom-6 sm:right-6'} z-30 w-10 h-10 flex items-center justify-center rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all bg-white/95 backdrop-blur text-stone-700 ${
                        isMaxZoom && !isFullScreen ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                    }`}
                    title={isFullScreen ? 'Exit full screen' : 'Full screen'}
                    aria-label={isFullScreen ? 'Exit full screen' : 'Full screen'}
                >
                    <span className="relative w-[18px] h-[18px] flex items-center justify-center">
                        <Maximize2 size={16} className={`absolute transition-all duration-300 ${isFullScreen ? 'opacity-0 rotate-45 scale-75' : 'opacity-100 rotate-0 scale-100'}`} />
                        <X size={18} className={`absolute transition-all duration-300 ${isFullScreen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-45 scale-75'}`} />
                    </span>
                </button>

                {!isFullScreen && arPlatform && (
                    <div className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 z-30 flex flex-col items-start gap-1.5">
                        {arPreviewUrls ? (
                            <a
                                rel={arPlatform === 'ios' ? 'ar' : undefined}
                                href={arPlatform === 'android'
                                    ? createAndroidSceneViewerIntent(arPreviewUrls.android)
                                    : arPreviewUrls.ios}
                                aria-label="View this frame in augmented reality"
                                title="View in AR"
                                className="relative grid h-10 w-10 place-items-center rounded-full border border-[#a6824c]/60 bg-white/95 text-[11px] font-bold tracking-[-0.08em] text-[#8d6c38] shadow-md backdrop-blur transition hover:border-[#8d6c38] hover:bg-[#f8f3e8]"
                            >
                                {/* Quick Look requires an image inside its rel=ar link. */}
                                <img src={getThumbnailUrl(productionImage || uploadedImage, 40)} alt="" className="absolute h-px w-px opacity-0" />
                                <span aria-hidden="true">AR</span>
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={prepareArPreview}
                                aria-label="Prepare this frame for augmented reality"
                                title="View in AR"
                                className="grid h-10 w-10 place-items-center rounded-full border border-[#a6824c]/60 bg-white/95 text-[11px] font-bold tracking-[-0.08em] text-[#8d6c38] shadow-md backdrop-blur transition hover:border-[#8d6c38] hover:bg-[#f8f3e8]"
                            >
                                <span aria-hidden="true">AR</span>
                            </button>
                        )}
                        {arPreviewMessage && <p aria-live="polite" className="max-w-[190px] rounded bg-white/80 px-1.5 py-1 text-[9px] leading-snug text-stone-600 shadow-sm backdrop-blur">{arPreviewMessage}</p>}
                    </div>
                )}
            </div>

            {/* RIGHT: CONFIGURATION DASHBOARD — fades in with the same
                paneVisible flag as the visualizer pane so it doesn't just
                hard-pop back in the instant it remounts after a full-screen
                exit. */}
            {!isFullScreen && (
            <div className={`flex flex-col relative shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10 transition-all duration-300 ${paneVisible ? 'opacity-100' : 'opacity-0'} ${isSideBySide ? 'w-[30%] flex-none h-[calc(100dvh-56px)] overflow-hidden' : 'w-full flex-1 h-auto'}`} style={{ backgroundColor: wallColor.hex }}>
                {/* Premium Tint Overlay: Keeps the sidebar 90% white, letting 10% of the wall color bleed through */}
                <div className="absolute inset-0 bg-white/90" />
                
                <div className={`flex-1 p-5 space-y-6 custom-scrollbar pb-24 relative z-10 ${isSideBySide ? 'overflow-y-auto' : ''}`}>
                    
                    {/* Header */}
                    <div>
                        <h1 className="text-xl font-serif font-bold text-stone-900 mb-1">Customize Your Frame</h1>
                        <p className="text-sm text-stone-500">Perfectly customized to your space.</p>
                    </div>

                    {/* 1. Artwork */}
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                            <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepArtwork}</span>
                            Image
                        </h2>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {/* Upload Trigger */}
                            <label className={`relative border-2 border-dashed ${(!uploadedImage || uploadedImage === 'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1600&q=80&sat=-20&con=-10') ? 'border-stone-300 hover:border-stone-400' : 'border-stone-950 bg-stone-50/50'} rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors h-[72px] text-center`}>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                                {isUploading ? (
                                    <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <ImageUp size={16} className={(!uploadedImage || uploadedImage === 'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1600&q=80&sat=-20&con=-10') ? 'text-stone-500' : 'text-stone-950'} />
                                        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">
                                            {(!uploadedImage || uploadedImage === 'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1600&q=80&sat=-20&con=-10') ? 'Upload Image' : 'Replace Image'}
                                        </span>
                                    </>
                                )}
                            </label>

                            {/* Inspiration Trigger */}
                            <button
                                onClick={() => navigate('/inspiration')}
                                className="border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center hover:bg-stone-50 hover:border-stone-400 transition-colors h-[72px] text-center"
                            >
                                <ImagePlus size={16} className="text-stone-500" />
                                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">Inspiration</span>
                            </button>
                        </div>
                    </section>


                    {/* 2. Frame Style */}
                    <section className={isPreset ? 'opacity-50 pointer-events-none' : ''}>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                            <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepFrameStyle}</span>
                            Frame Style
                        </h2>
                        <button 
                            onClick={() => setIsFrameModalOpen(true)}
                            className="w-full border border-stone-200 rounded-xl p-3 flex items-center justify-between hover:border-stone-400 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-10 h-10 rounded-lg bg-cover bg-center shadow-inner"
                                    style={{ backgroundImage: `url(${isPreset && uploadedImage ? getThumbnailUrl(uploadedImage, 80) : selectedFrame.previewImg})` }}
                                />
                                <div className="text-left">
                                    <p className="text-sm font-bold text-stone-900">{isPreset && presetTitle ? presetTitle : selectedFrame.name}</p>
                                    <p className="text-[10px] text-stone-500">{isPreset && presetDims ? presetDims : selectedFrame.category}</p>
                                </div>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center group-hover:bg-stone-200 transition-colors">
                                <Frame size={14} className="text-stone-600" />
                            </div>
                        </button>
                    </section>

                    {/* 3. Dimensions */}
                    <section className={`relative ${isPreset ? 'opacity-50 pointer-events-none' : ''}`}>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                                <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepDimensions}</span>
                                <span>
                                    Dimensions
                                    <InfoTooltip text="Dimensions show the inner opening size. Every frame is built custom to fit." />
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsSizeGuideOpen(v => !v)}
                                className="normal-case tracking-normal font-semibold text-[11px] text-[#c9a84c] hover:text-[#b3924a] underline transition-colors"
                            >
                                Size guide
                            </button>
                        </h2>
                        {isSizeGuideOpen && (
                            <SizeGuidePanel
                                currentSize={selectedSize}
                                onSelect={(entry) => { setSelectedSize(entry); }}
                                unit={unit}
                                onClose={() => setIsSizeGuideOpen(false)}
                            />
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            {(!showAllSizes && !isAlbumArt && finalSizesList.length > 6) ? (
                                <>
                                    {/* Collapsed: curated, column-major — left
                                        is the most popular small-to-medium
                                        sizes, right the most popular large-
                                        to-very-large sizes, each independently
                                        ascending top to bottom. The custom
                                        entry is an additional button tacked
                                        onto the right column, not a
                                        replacement for any of its 6 sizes —
                                        but the "+ Custom Size" trigger itself
                                        always lives at the bottom of the
                                        left column. */}
                                    <div className="flex flex-col gap-2">
                                        {leftColumnCollapsed.map(renderSizeButton)}
                                        {!showCustomSizeForm && (
                                            <button
                                                onClick={() => { setShowCustomSizeForm(true); setCustomSizeError(''); }}
                                                className="py-2 px-3 rounded-xl border border-stone-200 hover:border-stone-400 text-stone-700 text-xs font-semibold transition-all text-center"
                                            >
                                                + Custom Size
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {rightColumnCollapsed.map(renderSizeButton)}
                                        {showCustomEntry && renderSizeButton(customSizeEntry)}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Expanded: back to plain ascending order
                                        across the whole grid (its natural
                                        row-major fill), ignoring the
                                        collapsed view's popular-size column
                                        split entirely. */}
                                    {finalSizesList.map(renderSizeButton)}
                                    {showCustomEntry && renderSizeButton(customSizeEntry)}
                                    {!showCustomSizeForm && (
                                        <button
                                            onClick={() => { setShowCustomSizeForm(true); setCustomSizeError(''); }}
                                            className="py-2 px-3 rounded-xl border border-stone-200 hover:border-stone-400 text-stone-700 text-xs font-semibold transition-all text-center"
                                        >
                                            + Custom Size
                                        </button>
                                    )}
                                </>
                            )}

                            {showCustomSizeForm && (
                                <div className="col-span-2 p-3 rounded-xl border border-stone-300 bg-stone-50 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            placeholder={`Width (${unit})`}
                                            value={customWidthInput}
                                            onChange={e => setCustomWidthInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') applyCustomSize(); }}
                                            className="w-full py-2 px-3 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900"
                                        />
                                        <span className="text-stone-400 text-xs shrink-0">×</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            placeholder={`Height (${unit})`}
                                            value={customHeightInput}
                                            onChange={e => setCustomHeightInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') applyCustomSize(); }}
                                            className="w-full py-2 px-3 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900"
                                        />
                                    </div>
                                    {customSizeError && (
                                        <p className="text-[11px] text-red-600">{customSizeError}</p>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={applyCustomSize}
                                            className="flex-1 py-2 rounded-lg bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            onClick={() => { setShowCustomSizeForm(false); setCustomSizeError(''); }}
                                            className="flex-1 py-2 rounded-lg border border-stone-300 text-stone-500 text-xs font-bold hover:bg-stone-100 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!showAllSizes && !isAlbumArt && finalSizesList.length > 6 && finalSizesList.length > collapsedShownCount && (
                                <button
                                    data-size-list-toggle
                                    onClick={toggleShowAllSizes(true)}
                                    className="col-span-2 py-2 px-3 rounded-xl border border-dashed border-stone-300 text-stone-500 hover:text-stone-900 hover:border-stone-500 hover:bg-stone-50 transition-all text-xs font-bold tracking-wider text-center"
                                    style={{ fontVariant: 'all-small-caps' }}
                                >
                                    + more sizes ({finalSizesList.length - collapsedShownCount} more)
                                </button>
                            )}

                            {showAllSizes && !isAlbumArt && finalSizesList.length > 6 && finalSizesList.length > collapsedShownCount && (
                                <button
                                    data-size-list-toggle
                                    onClick={toggleShowAllSizes(false)}
                                    className="col-span-2 py-2 px-3 rounded-xl border border-dashed border-stone-300 text-stone-500 hover:text-stone-900 hover:border-stone-500 hover:bg-stone-50 transition-all text-xs font-bold tracking-wider text-center"
                                    style={{ fontVariant: 'all-small-caps' }}
                                >
                                    - less sizes
                                </button>
                            )}
                        </div>
                    </section>

                    {/* 4. Orientation */}
                    {!isPreset && !isAlbumArt && !isAlbumPoster && !isMoviePoster && !isMoviePosterPrint && (
                        <section>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                    <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepOrientation}</span>
                                    Orientation
                                </span>
                                {hasImage && uploadedImage && (
                                    <button
                                        type="button"
                                        onClick={handleOptimizeToggle}
                                        className={`normal-case font-semibold text-[11px] px-2.5 py-1 rounded-full transition-colors ${isOptimized ? 'bg-[#c9a84c] text-stone-950' : 'bg-stone-100 text-stone-500 hover:text-stone-700'}`}
                                    >
                                        {isOptimized ? 'Auto-fit on' : 'Auto-fit to photo'}
                                    </button>
                                )}
                            </h2>

                        <div className="flex bg-stone-100 p-1 rounded-xl">
                            <button
                                onClick={() => {
                                    setOrientation('portrait');
                                    setIsOptimized(false);
                                }}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${orientation === 'portrait' ? 'bg-white shadow-sm text-stone-900 font-bold' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                Portrait
                            </button>
                            <button
                                onClick={() => {
                                    setOrientation('landscape');
                                    setIsOptimized(false);
                                }}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${orientation === 'landscape' ? 'bg-white shadow-sm text-stone-900 font-bold' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                Landscape
                            </button>
                        </div>
                    </section>
                    )}

                    {/* 5. Matting & 6. Glass Type (Hidden for Canvas) */}
                    {selectedFrame?.id !== 'frame-canvas' && (
                        <>
                            {/* 5. Matting */}
                            {!isPreset && !isCanvasGlazing && (
                                <section>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                                        <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepMatting}</span>
                                        <span>
                                            Matting
                                            <InfoTooltip text="A mat border elevates the print, drawing the eye in. Choose 'No Mat' for full-bleed." />
                                        </span>
                                    </h2>
                                    
                                    {/* Mat Width */}
                                    <div className="flex bg-stone-100 p-1 rounded-xl mb-3">
                                        {[
                                            { val: 'none', label: 'No Mat' },
                                            { val: 'narrow', label: 'Narrow' },
                                            { val: 'standard', label: 'Standard' },
                                            { val: 'wide', label: 'Wide' }
                                        ].map(opt => (
                                            <button
                                                key={opt.val}
                                                onClick={() => {
                                                    setMatWidth(opt.val);
                                                    setIsOptimized(false);
                                                }}
                                                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all ${matWidth === opt.val ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Mat Color */}
                                    {matWidth !== 'none' && (
                                        <div className="grid grid-cols-5 gap-2">
                                            {MAT_COLORS.map(color => (
                                                <button
                                                    key={color.id}
                                                    onClick={() => setMatColor(color)}
                                                    className={`h-10 rounded-lg border-2 transition-all flex items-center justify-center ${matColor.id === color.id ? 'border-fw-gold shadow-md scale-105' : 'border-stone-200 hover:border-stone-300'}`}
                                                    style={{ backgroundColor: color.hex }}
                                                    title={color.name}
                                                >
                                                    {matColor.id === color.id && <Check size={16} className={color.light ? 'text-stone-900' : 'text-white'} />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* 6. Glass Type */}
                            <section>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                            <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepGlazing}</span>
                                    <span>
                                        Glazing (Glass)
                                        <InfoTooltip text="We use gallery-grade, shatterproof framing acrylic. Museum option blocks 99% UV." />
                                    </span>
                                </h2>
                                <div className="space-y-2">
                                    {[
                                        { id: 'standard', name: 'Standard Acrylic', desc: 'Clear, lightweight protection.', price: 0 },
                                        { id: 'non-glare', name: 'Non-Glare Acrylic', desc: 'Reduces reflections in bright rooms.', price: 100 },
                                        { id: 'museum', name: 'Museum Glass', desc: '99% UV protection, zero reflection.', price: 200 },
                                        { id: 'canvas-traditional', name: 'Traditional Canvas', desc: "Frame's inner lip overlaps the canvas edges", price: 350 },
                                        { id: 'canvas-floater', name: 'Floater Canvas', desc: 'Canvas floats with a reveal gap inside the frame', price: 400 },
                                    ].map(glass => (
                                        <button
                                            key={glass.id}
                                            onClick={() => { setGlassType(glass.id); if (glass.id === 'canvas-floater' || glass.id === 'canvas-traditional') setMatWidth('none'); }}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${glassType === glass.id ? 'border-stone-900 bg-stone-50 shadow-sm' : 'border-stone-200 hover:border-stone-300'}`}
                                        >
                                            <div>
                                                <p className={`text-sm font-semibold ${glassType === glass.id ? 'text-stone-900' : 'text-stone-700'}`}>{glass.name}</p>
                                                <p className="text-[10px] text-stone-500 mt-0.5">{glass.desc}</p>
                                            </div>
                                            <span className="text-xs font-mono text-stone-500">
                                                {glass.price === 0 ? 'Included' : `+GHS ${glass.price}`}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}

                    {/* 7. Hardware */}
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                            <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepHardware}</span>
                            <span>
                                Hardware
                                <InfoTooltip text="Hanging wire is standard. French cleats provide interlocking heavy-duty support." />
                            </span>
                        </h2>
                        <div className="space-y-2">
                            {[
                                { id: 'wire', name: 'Wire Hanging', desc: 'Standard D-rings and picture wire.', price: 0 },
                                { id: 'sawtooth', name: 'Sawtooth Hanger', desc: 'Simple mount for a single nail.', price: 0 },
                                { id: 'french-cleat', name: 'French Cleat', desc: 'Heavy-duty interlocking wall bracket.', price: 50 },
                                ...(selectedSize?.id === '5x7' || selectedSize?.id === '8x10' ? [{ id: 'easel', name: 'Tabletop Easel', desc: 'Fold-out stand for desks & mantels.', price: 0 }] : [])
                            ].map(hw => (
                                <button
                                    key={hw.id}
                                    onClick={() => setHardwareType(hw.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${hardwareType === hw.id ? 'border-stone-900 bg-stone-50 shadow-sm' : 'border-stone-200 hover:border-stone-300'}`}
                                >
                                    <div>
                                        <p className={`text-sm font-semibold ${hardwareType === hw.id ? 'text-stone-900' : 'text-stone-700'}`}>{hw.name}</p>
                                        <p className="text-[10px] text-stone-500 mt-0.5">{hw.desc}</p>
                                    </div>
                                    <span className="text-xs font-mono text-stone-500">
                                        {hw.price === 0 ? 'Included' : `+GHS ${hw.price}`}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Sticky Checkout Footer */}
                <div className={`bottom-0 z-20 backdrop-blur-md border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] flex ${isSideBySide ? 'flex-col gap-0 items-start py-1.5 px-3' : 'items-center justify-between gap-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] px-5'} ${isSideBySide ? 'relative bg-white/85' : 'sticky bg-white/95'}`}>
                    <div className="flex flex-col">
                        <Price
                            amount={
                                Math.round((selectedSize?.price || 0) * (selectedFrame?.priceMod || 1)) +
                                (selectedFrame?.id !== 'frame-canvas' && glassType !== 'canvas-floater' && glassType !== 'canvas-traditional' && matWidth !== 'none' ? (matColor.price || 75) : 0) +
                                (selectedFrame?.id !== 'frame-canvas' ? (glassType === 'non-glare' ? 100 : glassType === 'museum' ? 200 : 0) : 0) +
            (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-floater' ? 400 : 0) +
            (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-traditional' ? 350 : 0) +
                                (hardwareType === 'french-cleat' ? 50 : 0)
                            }
                            className="text-lg font-bold text-stone-900 tracking-tight"
                        />
                        <span className="text-[8px] text-stone-500 whitespace-nowrap">
                            {isCloudUploadPending ? 'Finishing image upload…' : 'Shipping fee paid upon delivery'}
                        </span>
                    </div>
                    <div className={`flex w-full mt-1 ${isSideBySide ? 'gap-1.5' : 'gap-2 max-w-[300px]'}`}>
                        <button
                            onClick={async () => {
                                setLoadingAction('cart');
                                const visualizerImage = await captureVisualizerImage();
                                setLoadingAction(null);
                                addToCart(buildCartItem(visualizerImage));
                                setWasAddedToCart(true);
                            }}
                            disabled={!hasImage || isCloudUploadPending || loadingAction !== null}
                            className={`flex-1 bg-white border rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shadow-sm ${isSideBySide ? 'py-1.5' : 'py-2.5'} ${!hasImage || isCloudUploadPending || loadingAction !== null ? 'opacity-50 cursor-not-allowed border-stone-200 text-stone-400 bg-stone-50' : 'text-stone-900 border-stone-200 hover:bg-stone-50'}`}
                        >
                            {loadingAction === 'cart' && <Loader size={12} className="animate-spin" />}
                            {loadingAction === 'cart' ? 'Adding…' : (wasAddedToCart ? 'Added' : 'Add to Cart')}
                        </button>
                        <button
                            onClick={async () => {
                                if (wasAddedToCart) {
                                    if (!user) {
                                        setShowAuthModal(true);
                                    } else {
                                        navigate('/checkout');
                                    }
                                    return;
                                }
                                setLoadingAction('pay');
                                const visualizerImage = await captureVisualizerImage();
                                setLoadingAction(null);
                                toggleAllSelection(false);
                                addToCart(buildCartItem(visualizerImage));
                                if (!user) {
                                    setShowAuthModal(true);
                                } else {
                                    navigate('/checkout');
                                }
                            }}
                            disabled={!hasImage || isCloudUploadPending || loadingAction !== null}
                            className={`flex-1 border rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shadow-sm ${isSideBySide ? 'py-1.5' : 'py-2.5'} ${!hasImage || isCloudUploadPending || loadingAction !== null ? 'opacity-50 cursor-not-allowed border-stone-200 text-stone-400 bg-stone-50' : 'bg-[#c9a84c] border-[#c9a84c] text-[#0a0a0a] hover:bg-[#d4b55c]'}`}
                        >
                            {loadingAction === 'pay' && <Loader size={12} className="animate-spin" />}
                            Pay Now
                        </button>
                    </div>
                </div>
            </div>
            )}

            {/* Frame Selection Modal — gated here (rather than relying on its
                own isOpen-guard return null) so it fully unmounts on close,
                resetting its internal activeCategory tab back to the default
                on every reopen instead of leaving it wherever it was last. */}
            {isFrameModalOpen && (
                <FrameSelectionModal
                    isOpen={isFrameModalOpen}
                    onClose={() => setIsFrameModalOpen(false)}
                    selectedFrame={selectedFrame}
                    onSelect={setSelectedFrame}
                />
            )}

            {/* Met Art Selection Modal */}
            <MetArtSelectionModal 
                isOpen={isMetModalOpen} 
                onClose={() => setIsMetModalOpen(false)} 
                onSelect={handleMetArtSelect}
            />

            {/* Auth Modal */}
            <AuthModal 
                isOpen={showAuthModal} 
                onClose={() => setShowAuthModal(false)} 
                returnTo="/checkout"
            />
        </div>
    );
};

export default CustomizeFramePage;
