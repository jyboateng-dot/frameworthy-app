import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
    ImagePlus,
    Check,
    Ruler,
    Palette,
    Frame,
    ChevronDown,
    Info,
    Loader,
    Maximize2,
    X
} from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES, MAT_COLORS, formatDimensions, clampSizeToValidRange, DEFAULT_DEMO_IMAGE, getDemoImageForOrientation } from '../../data/constants';
import { displayCategoryName } from '../../data/frameBrowsing';
import { ROOM_SCENES, computeRoomPlacement, computeRoomLayout, computeReferenceAnchoredTop } from '../../data/roomScenes';
import { ROOM_SCENE_COMPONENTS, ROOM_SCENE_FOREGROUND_COMPONENTS } from '../../components/framing/roomSceneComponents';
// ScenePicker and SceneCarousel are kept imported-but-unused from earlier tries — swap back easily if the current approach doesn't work out.
import ScenePicker from '../../components/framing/ScenePicker';
import RoomPhotoForeground from '../../components/framing/RoomPhotoForeground';
import { ENABLE_CLOSE_UP_SIZE_PROGRESSION, getCloseUpSize } from '../../utils/closeUpSizing';
import SceneCarousel from '../../components/framing/SceneCarousel';
import SceneArrowCarousel from '../../components/framing/SceneArrowCarousel';
import SceneDotThumb from '../../components/framing/SceneDotThumb';
import RoomThumbnailRail from '../../components/framing/RoomThumbnailRail';
import PageMeta from '../../components/common/PageMeta';
import { useHoverDropdown, isHoverCapable } from '../../hooks/useHoverDropdown';
import { getFrameRail, getRailTextureStyle, getRailShading } from '../../utils/frameRail';
import {
    getMatReveal,
    sliderIndexToMatWidth,
    matWidthToSliderIndex,
    maxMatWidthForSize,
    MAT_RENDER_MAX_PCT,
} from '../../utils/matting';
import { getMetRecommendedSize, getMetArtworkPixelSize } from '../../utils/metArtworkSizing';
import { maxFramePrintSize } from '../../utils/maxFramePrintSize';
import { doesSizeMeetMinDpi } from '../../utils/museumArtwork';
import { buildPrintQualitySpec, minimumPrintDpiForFrame, minimumNativeFloorDpiForFrame } from '../../utils/printQuality';
import { useUnit } from '../../context/UnitContext';
import { useCart } from '../../context/CartContext';
import { uploadImageToCloud, getThumbnailUrl } from '../../services/storage';
import FrameSelectionModal from '../../components/FrameSelectionModal';
import { activeFrameOrDefault, DEFAULT_PRODIGI_FRAME } from '../../data/frameBrowsing';
import ArtworkImportMenu from '../../components/framing/ArtworkImportMenu';
import ArViewer from '../../components/framing/ArViewer';
import { clearArModelCache } from '../../utils/ar/buildArModel';
import { renderFrameOrderPreview } from '../../utils/frameOrderPreview';
import MetArtSelectionModal from '../../components/MetArtSelectionModal';
import { renderAlbumPoster } from '../../utils/albumPoster';
import { renderMoviePoster } from '../../utils/moviePoster';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../../components/AuthModal';
import Price from '../../components/common/Price';
import FrameFitPanel from '../../components/framing/FrameFitPanel';
import ProdigiConfigurationPanel from '../../components/framing/ProdigiConfigurationPanel';
import { DEFAULT_POSITION, frameGeometry, imageCrop, cropStyle, isDefaultFitPosition } from '../../utils/frameFit';
import { prepareFrameOutput } from '../../services/frameFitOutput';
import { detectArtworkContentBounds, computeCleanArtworkBounds } from '../../utils/artworkEdgeDetector';
import { loadImageCached } from '../../utils/imageCache';
import { visualizerFullScreenState } from '../../utils/visualizerFullScreenState';
import { nearestProdigiSize, prodigiAvailableSizes, prodigiConfigurationFromSelection, prodigiHangingHardware } from '../../utils/prodigiFlow';
import { getFrameInnerShadow, getFrameWallShadow } from '../../utils/frameDepthPresentation';

const MOBILE_DOUBLE_TAP_DELAY_MS = 300;

const isSameSize = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.id && b.id && a.id === b.id) return true;
    if (a.prodigiSizeInches && b.prodigiSizeInches && a.prodigiSizeInches === b.prodigiSizeInches) return true;
    return Math.abs(a.width - b.width) < 0.35 && Math.abs(a.height - b.height) < 0.35;
};

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

// Catalogue dimensions describe the artwork opening. The frame's physical
// outside size is that opening plus two measured moulding faces.
const getMouldingWidthIn = (frame) => {
    if (frame?.id === 'frame-canvas') return 0;
    const fallback = frame?.widthCategory === 'wide'
        ? 1.25
        : frame?.widthCategory === 'narrow' ? 0.375 : 0.75;
    const measured = Number(frame?.mouldingWidthIn);
    return Number.isFinite(measured) && measured > 0 ? measured : fallback;
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

// Real tileable moulding strips (see scripts/generate-frame-strips.mjs and
// src/data/frameStrips.json) for the subset of the catalogue — mostly the
// ornate/carved frames — where they've been generated AND manually
// reviewed. Everything else keeps the single-patch anchor crop below,
// which is the only honest option for a frame with no strip: repeating a
// motif that was never verified to tile would risk the exact silent-defect
// failure the strip pipeline's review process exists to catch.

// Unlike the anchor crop (one static patch, `no-repeat`), a strip is built
// to repeat: `-h.webp` for top/bottom, pre-rotated `-v.webp` for left/right
// (rotated at generation time with sharp, not via a CSS transform — a real
// rotated image needs no overscan hack to hide a transformed bounding box,
// unlike the raw-crop rotation path below). `auto <axis>` keeps the
// strip's own aspect ratio while its other axis fills the moulding's
// actual rendered thickness, so it tiles correctly at any frame size.

// A single physical moulding side. The parent supplies the computed
// geometry and mitre clip; this component supplies the material and its
// lighting, kept as separate layers because the photograph provides the
// finish while the side determines where light catches the profile.
//
// The texture is a pre-built rail from scripts/build-rail-textures.mjs —
// see utils/frameRail.js for the orientation contract it relies on.
const FrameMouldingMaterial = ({ side, frame }) => {
    const rail = getFrameRail(frame);
    const textureStyle = getRailTextureStyle(side, rail);

    return (
        <div
            className="absolute inset-0"
            style={{
                // Only ever seen through a rail that failed to build (3 of
                // 335) — otherwise the photographed material covers it.
                backgroundImage: getSideBackground(side, frame),
            }}
        >
            {textureStyle && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={textureStyle}
                />
            )}
            {/* Profile shading. Scanned rails already carry the moulding's
                own baked-in shading so this is dialled back for them; the
                strength lives in getRailShading, not here. */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={getRailShading(side, frame, rail)}
            />
            {/* A restrained inner falloff makes a flat material crop read as
                a real face receding into the rabbet, without inventing a new
                profile that isn't present in the selected moulding. */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),inset_0_-2px_3px_rgba(0,0,0,0.18)]" />
        </div>
    );
};

const FrameMouldingSide = ({ side, frame, outgoingFrame, isCrossfading, style }) => (
    <div
        className="absolute z-10 overflow-hidden transition-[top,right,bottom,left,width,height,clip-path] duration-200 ease-out"
        style={{ ...style, isolation: 'isolate' }}
    >
        <FrameMouldingMaterial side={side} frame={frame} />
        {outgoingFrame && (
            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ease-out ${isCrossfading ? 'opacity-0' : 'opacity-100'}`}>
                <FrameMouldingMaterial side={side} frame={outgoingFrame} />
            </div>
        )}
    </div>
);

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
    roomSceneId,
    setRoomSceneId,
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
    const { addToCart, updateCartItem, toggleAllSelection } = useCart();
    const { user } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [fitPosition, setFitPosition] = useState(DEFAULT_POSITION);
    const [fitError, setFitError] = useState('');
    useEffect(() => {
        setFitPosition(DEFAULT_POSITION);
        setCleanFrameInsets(null);
    }, [uploadedImage]);
    
    // Also recognises the previous URL shape so an already-open dev session
    // immediately adopts the orientation-aware crop after hot reload.
    const isPlaceholder = uploadedImage === DEFAULT_DEMO_IMAGE
        || uploadedImage?.includes('images.unsplash.com/photo-1526045478516-99145907023c');
    const hasImage = Boolean((uploadedImage && !isPlaceholder) || productionImage || (collageImages && collageImages.length > 0));

    // Core State
    const [isAlbumArt, setIsAlbumArt] = useState(false);
    const [isAlbumPoster, setIsAlbumPoster] = useState(false);
    const [isMoviePoster, setIsMoviePoster] = useState(false);
    const [isMoviePosterPrint, setIsMoviePosterPrint] = useState(false);
    const [posterData, setPosterData] = useState(null);
    const [prodigiSelection, setProdigiSelection] = useState(null);
    const [wallColor, setWallColor] = useState(WALL_COLORS[0]);
    const knownImageDimensionsRef = useRef(null);

    // Record true full-resolution pixel dimensions for the 150 DPI print floor
    // when metadata did not already supply them (e.g. ImageKit Original Paintings),
    // while avoiding eager 20-45MB master downloads for museum items whose
    // dimensions are already known from snapshot metadata.
    useEffect(() => {
        const source = productionImage || (!isPlaceholder ? uploadedImage : null);
        if (!source || isAlbumPoster || isMoviePosterPrint) return undefined;
        const known = knownImageDimensionsRef.current;
        if (known && (known.url === uploadedImage || known.url === source) && known.w > 0 && known.h > 0) {
            return undefined;
        }
        let cancelled = false;
        loadImageCached(source)
            .then((fullImg) => {
                if (cancelled) return;
                if (fullImg?.naturalWidth > 0 && fullImg?.naturalHeight > 0) {
                    const dims = { w: fullImg.naturalWidth, h: fullImg.naturalHeight };
                    knownImageDimensionsRef.current = { url: uploadedImage || source, ...dims };
                    setImageNaturalSize(dims);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [productionImage, uploadedImage, isPlaceholder, isAlbumPoster, isMoviePosterPrint]);
    // null = the plain wall-colour backdrop with the sofa scale cue. Set to a
    // ROOM_SCENES id to swap in a full room, where the artwork is sized
    // against the room's own real-world wall span instead of the sofa.
    // Hoisted to App.jsx (received as a prop) rather than local state — see
    // its declaration there for why.
    const [departingRoomSceneId, setDepartingRoomSceneId] = useState(null);
    // Close-Up has no ROOM_SCENES id of its own, so departingRoomSceneId
    // alone can't record "the outgoing scene was Close-Up" — this flag
    // fills that gap so Close-Up slides like any other scene instead of
    // being a special-cased cut.
    const [departingWasCloseUp, setDepartingWasCloseUp] = useState(false);
    // 1 = new scene is later in the [Close-Up, ...ROOM_SCENES] order (slides
    // in from the right, old slides out to the left); -1 = reverse. Close-Up
    // sits first in that order, so it slides too instead of just cutting.
    const [roomSlideDirection, setRoomSlideDirection] = useState(1);
    const [mobileRoomReturnSceneId, setMobileRoomReturnSceneId] = useState(null);
    // The invitation is reset for every fresh artwork. Auto-dismisses after
    // a recommended 6 seconds so it doesn't obstruct the visualizer indefinitely.
    const [showSceneHint, setShowSceneHint] = useState(true);
    const sceneHintTimeoutRef = useRef(null);

    useEffect(() => {
        if (!showSceneHint) {
            if (sceneHintTimeoutRef.current) window.clearTimeout(sceneHintTimeoutRef.current);
            return;
        }
        sceneHintTimeoutRef.current = window.setTimeout(() => {
            setShowSceneHint(false);
        }, 6000);

        return () => {
            if (sceneHintTimeoutRef.current) window.clearTimeout(sceneHintTimeoutRef.current);
        };
    }, [showSceneHint]);
    // Resolved async per selectedFrame — see utils/frameTexture.js. Stays
    // null (falls back to the synthesized-gradient moulding) until/unless a
    // confident on-material anchor is found for this frame's corner photo.
    const [showDimensions, setShowDimensions] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    // True while the background Cloudinary upload for the current image is
    // in flight — until it resolves, `uploadedImage` is a blob: URL that
    // won't survive a page reload, so Add to Cart/Buy Now must wait for it.
    const [isCloudUploadPending, setIsCloudUploadPending] = useState(false);
    const [isFrameModalOpen, setIsFrameModalOpen] = useState(false);
    const { open: isWallPickerOpen, setOpen: setIsWallPickerOpen, hoverProps: wallPickerHoverProps, closeOnSelect: closeWallPickerOnSelect, containerRef: wallPickerContainerRef } = useHoverDropdown();
    const [isMetModalOpen, setIsMetModalOpen] = useState(false);
    const metReturnRef = useRef(null);
    const [isArOpen, setIsArOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isMaxZoom, setIsMaxZoom] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    // Keep navigation hidden until a zoom transition has settled.
    const [isZoomSettling, setIsZoomSettling] = useState(false);
    // Decoupled from isFullScreen so entering/exiting can crossfade instead
    // of hard-cutting: isFullScreen controls which layout (docked vs.
    // full-screen) is mounted, paneVisible controls that pane's own
    // opacity/scale, applied to BOTH layouts — see enterFullScreen/
    // exitFullScreen below. Defaults true because the docked pane needs no
    // fade-in on the very first render, only right after returning from
    // full screen.
    const [paneVisible, setPaneVisible] = useState(true);
    const fullScreenCloseTimeoutRef = useRef(null);
    const zoomSettleTimeoutRef = useRef(null);
    const hoverEnterTimeoutRef = useRef(null);
    // The resting frame bounds stay as the hover target while a room-scene
    // frame animates into its larger reveal state. Without this, a shifting
    // edge can emit mouseleave/mouseenter repeatedly beneath a still cursor.
    const hoverHitBoundsRef = useRef(null);
    const roomSceneTransitionRef = useRef(null);
    const roomScenePreloadRef = useRef(new Map());
    const roomSceneSelectionTokenRef = useRef(0);
    const ignoreZoomTapUntilRef = useRef(0);
    const lastTapRef = useRef(0);
    const touchGestureStartRef = useRef(null);
    const zoneRef = useRef(null);
    const visualizerPaneRef = useRef(null);
    const zoomTouchStartRef = useRef(null);
    const frameRenderRef = useRef(null);
    const sceneFrameBoundsRef = useRef(null);
    const sceneFrameAnimationRef = useRef(null);

    // Close-Up changes both size and flex alignment. Lay out the destination
    // once, then animate its composite from the previous on-screen bounds.
    // Animating width would lay out and repaint every rail/mat on each tick.
    useLayoutEffect(() => {
        const before = sceneFrameBoundsRef.current;
        sceneFrameBoundsRef.current = null;
        const frame = frameRenderRef.current;
        if (!before || !frame) return;
        sceneFrameAnimationRef.current?.cancel();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const after = frame.getBoundingClientRect();
        if (!after.width || !after.height) return;
        const transform = getComputedStyle(frame).transform;
        const destination = transform === 'none' ? '' : transform;
        const animation = frame.animate([
            { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) ${destination} scale(${before.width / after.width}, ${before.height / after.height})`, transformOrigin: '0 0' },
            { transform: destination || 'none', transformOrigin: '0 0' },
        ], { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        sceneFrameAnimationRef.current = animation;
        return () => animation.cancel();
    }, [roomSceneId]);

    useEffect(() => () => {
        window.clearTimeout(roomSceneTransitionRef.current);
        window.clearTimeout(hoverEnterTimeoutRef.current);
        roomSceneSelectionTokenRef.current += 1;
    }, []);
    const [loadingAction, setLoadingAction] = useState(null);
    const [wasAddedToCart, setWasAddedToCart] = useState(false);
    // Always holds the uploadedImage value from the most recent render, updated
    // synchronously (not via an effect) so a stale image-load callback can tell
    // it's no longer for the current image even before its effect's own cleanup
    // has had a chance to run (see the image-load effect below).
    const latestUploadedImageRef = useRef(uploadedImage);
    latestUploadedImageRef.current = uploadedImage;
    const initialPresetImageRef = useRef(null);
    // The visualizer image's fetch width is computed from the frame's live
    // on-screen pixel size (see targetImageWidthPx, deep in the visualizer
    // render below) — necessary so a heavily zoomed room scene doesn't fetch
    // a too-small Cloudinary thumbnail, but that on-screen size itself
    // fluctuates across several renders while things settle right after an
    // upload (orientation auto-detect, zoneSize's ResizeObserver, etc.).
    // Reacting to every one of those fluctuations meant a freshly uploaded
    // photo could request two (or more) differently-sized thumbnails in
    // quick succession, each swap visible as a distinct pop instead of one
    // clean transition. targetImageWidthPx is written here every render
    // (same plain-synchronous-write pattern as latestUploadedImageRef right
    // above) purely so the debounce effect further down has a way to read
    // "this render's value" without the img-src computation itself needing
    // a hook — it's nested too many closures deep in the render for that.
    const targetImageWidthRef = useRef(2400);
    const [committedImageWidthPx, setCommittedImageWidthPx] = useState(2400);
    const [zoneSize, setZoneSize] = useState({ width: 1000, height: 500 }); // Default fallback
    const [isRendering, setIsRendering] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [isFrameLoading, setIsFrameLoading] = useState(false);
    // Keep the currently painted frame in place while the next rail images
    // decode. Background-image changes cannot animate, so this gives us a
    // brief, genuine crossfade instead of a blank/rough texture swap.
    const [renderedFrame, setRenderedFrame] = useState(selectedFrame);
    const [outgoingFrame, setOutgoingFrame] = useState(null);
    const [isFrameCrossfading, setIsFrameCrossfading] = useState(false);
    const renderedFrameRef = useRef(selectedFrame);
    const framePreloadTokenRef = useRef(0);

    // Drives the visualizer loading ring so its fill actually corresponds to
    // completion rather than looping on its own independent timer: it creeps
    // toward (but never quite reaches) full while any of the three loading
    // flags above are true, then snaps to 100% the instant they all clear,
    // holds briefly so that's visible, and only then fades the overlay out.
    const isVisualizerLoading = isRendering || isImageLoading || isFrameLoading;
    const [ringComplete, setRingComplete] = useState(false);
    const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false);

    // Dev-only visualizer edit overlay (drag/resize the frame and scene
    // artefacts, freeform command bar) — see src/devtools/visualizerEditor.js.
    // Parked for now: flip this back to true to re-enable it. Deliberately
    // NOT deleted; only whether it auto-installs is toggled here.
    const VISUALIZER_EDITOR_ENABLED = false;
    useEffect(() => {
        if (!VISUALIZER_EDITOR_ENABLED || !import.meta.env.DEV) return undefined;
        let cancelled = false;
        let installed = null;
        import('../../devtools/visualizerEditor').then(({ installVisualizerEditor }) => {
            if (!cancelled) installed = installVisualizerEditor();
        });
        return () => {
            cancelled = true;
            if (installed) installed.destroy();
        };
    }, []);

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
    const [sizeClampNotice, setSizeClampNotice] = useState('');
    const [imageNaturalSize, setImageNaturalSize] = useState(null);   // { w, h }
    const [cleanFrameInsets, setCleanFrameInsets] = useState(null);   // { top, bottom, left, right }
    const activeContentBounds = useMemo(() => {
        if (!cleanFrameInsets || !imageNaturalSize) return null;
        return computeCleanArtworkBounds(imageNaturalSize, cleanFrameInsets);
    }, [cleanFrameInsets, imageNaturalSize]);

    // Dynamically access the device screen to optimize visualizer height on mobile
    const [windowSize, setWindowSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1200,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
    });

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
    
    // Canonical interpretation of an Inspiration selection ("Get This" from any
    // category). This is THE single place that maps a selection's state object
    // onto the Frame Studio — reached via real navigation (any entry point,
    // including the in-studio Inspiration trigger below, → /inspiration →
    // navigate here with location.state), picked up by the Initial Setup
    // effect below. Add new fields/categories HERE and it's picked up
    // automatically regardless of which entry point led here.
    const applyInspirationSelection = (state) => {
        if (!state) return;

        if (Number(state.imageWidth) > 0 && Number(state.imageHeight) > 0) {
            const dims = { w: Number(state.imageWidth), h: Number(state.imageHeight) };
            knownImageDimensionsRef.current = { url: state.presetImage || state.productionImage, ...dims };
            setImageNaturalSize(dims);
        } else {
            knownImageDimensionsRef.current = null;
            setImageNaturalSize(null);
        }
        if (state.presetImage) {
            setUploadedImage(state.presetImage);
            initialPresetImageRef.current = state.presetImage;
            setShowSceneHint(true);
        }
        if (state.productionImage || state.presetImage) {
            setProductionImage(state.productionImage || state.presetImage);
        } else if (state.isAlbumPoster || state.isMoviePosterPrint) {
            setProductionImage(null);
        }
        // Framed Prints is the one category that locks the frame as a fixed
        // part of the product (see isPresetFramedPrint below, which greys out
        // the Frame Style section entirely) — everywhere else, the customer's
        // current frame selection (or the studio's own default) should stand,
        // not get silently swapped for whatever a catalogue item suggests.
        if ((state.isPresetFramedPrint || state.prodigiSelection) && state.initialFrame) {
            setSelectedFrame(activeFrameOrDefault(state.initialFrame));
        }
        if (state.initialSize) {
            const { size: sizeToApply, wasClamped, clampedShortCm, clampedLongCm } = clampSizeToValidRange(state.initialSize);
            setSelectedSize(sizeToApply);
            setSizeClampNotice(wasClamped
                ? `This artwork's listed size was outside what we can produce, so it's been adjusted to ${clampedShortCm.toFixed(1)} × ${clampedLongCm.toFixed(1)} cm.`
                : '');
        } else if (Number(state.imageWidth) > 0 && Number(state.imageHeight) > 0) {
            const maxSize = maxFramePrintSize({ w: Number(state.imageWidth), h: Number(state.imageHeight) });
            if (maxSize) {
                const { size: sizeToApply } = clampSizeToValidRange(maxSize);
                setSelectedSize(sizeToApply);
                if (!state.orientation && maxSize.orientation) {
                    setOrientation(maxSize.orientation);
                }
            }
            setSizeClampNotice('');
        } else {
            setSizeClampNotice('');
        }
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
        setProdigiSelection(state.prodigiSelection || null);

        if (state.openMetArt) {
            setIsMetModalOpen(true);
            if (state.returnOnClose) {
                metReturnRef.current = {
                    scrollY: typeof state.returnScrollY === 'number' ? state.returnScrollY : 0,
                    returnTo: state.returnTo || '/'
                };
            }
        }
    };

    // Initial Setup
    useEffect(() => {
        // React Router doesn't reset scroll position on navigation — landing
        // here from partway down a long Inspiration/catalogue grid otherwise
        // carries that scroll offset over, so the visualizer (first in the
        // DOM on every layout) can end up scrolled out of view on arrival.
        window.scrollTo(0, 0);

        if (!selectedFrame) setSelectedFrame(DEFAULT_PRODIGI_FRAME);
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
            setIsCloudUploadPending(true);
            // Use standard 300 DPI print resolution for crisp text in both the visualizer and
            // the final production print — but cap the resulting canvas's total pixel area,
            // since mobile Safari/WebView impose a hard ceiling around 16.7M px (roughly
            // 4096x4096) and silently produce a blank canvas past it. A flat 300 DPI already
            // blows past that for common poster sizes (24x36in @ 300 DPI = 7200x10800 =
            // 77.76M px), so DPI must scale down with physical size, not stay fixed. This is
            // This render is also the production asset. The quality check below uses its
            // actual pixel dimensions and only exposes sizes that remain above the active
            // paper/canvas minimum after the mobile or desktop canvas cap is applied.
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
                    setImageNaturalSize({
                        w: Math.round(physW * previewDPI),
                        h: Math.round(physH * previewDPI),
                    });
                    setIsRendering(false);

                    fetch(dataUrl)
                        .then(res => res.blob())
                        .then(blob => uploadImageToCloud(new File([blob], fileLabel, { type: 'image/png' })))
                        .then(cloudUrl => {
                            if (isMounted && setProductionImage) setProductionImage(cloudUrl);
                        })
                        .catch(err => {
                            console.warn('Background poster cloud upload failed, using local render:', err);
                            if (isMounted) setFitError('The print file upload did not finish. Please try this poster again.');
                        })
                        .finally(() => { if (isMounted) setIsCloudUploadPending(false); });
                })
                .catch(err => {
                    console.error('Failed to render poster:', err);
                    if (isMounted) {
                        setIsRendering(false);
                        setIsCloudUploadPending(false);
                    }
                });
        }
        return () => { isMounted = false; };
    }, [isAlbumPoster, isMoviePosterPrint, posterData, selectedSize]);

    // Track loading states for images and frames
    useEffect(() => {
        if (uploadedImage) setIsImageLoading(true);
    }, [uploadedImage]);

    useEffect(() => {
        if (!selectedFrame || selectedFrame.id === renderedFrameRef.current?.id) {
            setIsFrameLoading(false);
            return undefined;
        }

        let cancelled = false;
        let fadeFrame = null;
        let clearOutgoingTimer = null;
        const token = ++framePreloadTokenRef.current;
        const rail = getFrameRail(selectedFrame);
        const urls = [rail?.h, rail?.v].filter(Boolean);
        setIsFrameLoading(urls.length > 0);

        const preload = (url) => new Promise((resolve) => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = () => {
                if (typeof image.decode === 'function') {
                    image.decode().catch(() => {}).finally(resolve);
                } else {
                    resolve();
                }
            };
            image.onerror = resolve;
            image.src = url;
        });

        Promise.all(urls.map(preload)).finally(() => {
            if (cancelled || token !== framePreloadTokenRef.current) return;
            const currentRenderedFrame = renderedFrameRef.current;
            setIsFrameCrossfading(false);
            setOutgoingFrame(currentRenderedFrame || null);
            renderedFrameRef.current = selectedFrame;
            setRenderedFrame(selectedFrame);
            setIsFrameLoading(false);
            // Mount the outgoing layer at full opacity, then fade it on the
            // next painted frame so the browser has an actual transition.
            fadeFrame = requestAnimationFrame(() => {
                fadeFrame = requestAnimationFrame(() => setIsFrameCrossfading(true));
            });
            clearOutgoingTimer = window.setTimeout(() => {
                setOutgoingFrame(null);
                setIsFrameCrossfading(false);
            }, 230);
        });

        return () => {
            cancelled = true;
            if (fadeFrame) cancelAnimationFrame(fadeFrame);
            if (clearOutgoingTimer) window.clearTimeout(clearOutgoingTimer);
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

    // Park the former 341-frame flow even for a hot session that was already
    // holding one of those records when this catalogue switch landed.
    useEffect(() => {
        if (selectedFrame && !selectedFrame.prodigiProduct) {
            setSelectedFrame(DEFAULT_PRODIGI_FRAME);
        }
    }, [selectedFrame, setSelectedFrame]);


    // isZoomSettling (declared above, next to isHovered/isMaxZoom) — one
    // ZOOM_MOTION window (260ms, matching ZOOM_MOTION's own duration below)
    // after any of the three zoom states changes, in either direction.
    useEffect(() => {
        setIsZoomSettling(true);
        window.clearTimeout(zoomSettleTimeoutRef.current);
        zoomSettleTimeoutRef.current = window.setTimeout(() => setIsZoomSettling(false), 260);
        return () => window.clearTimeout(zoomSettleTimeoutRef.current);
    }, [isHovered, isMaxZoom, isFullScreen]);

    // AR models are cached as blob URLs so reopening the preview for a
    // configuration already built is instant. Blob URLs belong to the
    // document rather than to the component that made them, so without
    // this they'd stay resident for as long as the tab lives — several
    // megabytes of model and texture per cached configuration.
    useEffect(() => () => { clearArModelCache(); }, []);

    // Debounces the visualizer image's fetch width (see targetImageWidthRef's
    // declaration above) — commits it only once it's held steady for a beat,
    // so a burst of renders while layout settles (orientation auto-detect,
    // zoneSize's own ResizeObserver, etc.) collapses into one eventual
    // Cloudinary request instead of several visibly different mid-settle
    // swaps. No dependency array: runs after every render rather than
    // guessing every input that can move targetImageWidthPx, since the ref
    // always holds this render's freshly computed value regardless of what
    // changed it, and a fresh timer each render is exactly the debounce.
    useEffect(() => {
        // Keep the current artwork texture throughout a scene move. Fetch
        // its larger Close-Up version after the animation has settled.
        if (departingRoomSceneId || departingWasCloseUp) return;
        const timer = setTimeout(() => {
            setCommittedImageWidthPx((prev) => (
                targetImageWidthRef.current !== prev ? targetImageWidthRef.current : prev
            ));
        }, 250);
        return () => clearTimeout(timer);
    });

    // Full-screen visualizer: reset hover/max-zoom on every transition so
    // zoom state computed against one container size (pane vs. viewport)
    // never carries over into the other.
    // Entering/exiting full screen is a mode switch the user wants to happen
    // right away. Must match the pane's own duration-300 transition class
    // below (and the dashboard's), since this is also how long enter/exit
    // waits before actually swapping the docked/full-screen layout.
    const FULL_SCREEN_TRANSITION_MS = 300;
    // The room images are full visualizer canvases. The assets and their
    // foreground cutouts are decoded before this begins, so mobile can use
    // the same composed slide as desktop without flashing between layers.
    const ROOM_SCENE_TRANSITION_MS = 360;
    const ROOM_SCENE_MOTION = 'duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)]';

    // ── ZOOM MOTION ──
    // One duration and one curve for everything that moves when the frame
    // zooms, because they all move together: the frame used to scale over
    // 700ms while the room backdrop faded over 500ms and the chrome over
    // 300ms, so a single gesture appeared to finish three separate times.
    // That staggering, not the speed, is most of what read as unpolished.
    //
    // 260ms on an ease-out quint — quick enough to feel like a direct
    // response to the pointer, with enough tail that the frame settles
    // rather than snapping. The old curve (0.16,1,0.3,1) is very nearly a
    // step function; stretched over 700ms it spent most of that time
    // almost-arrived, which is the worst of both.
    const ZOOM_MOTION = 'duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]';
    // Controls leave faster than the piece grows, so they're gone before it
    // reaches full size instead of dissolving behind it.
    const CHROME_MOTION = 'duration-[160ms] ease-out';

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
        // Returning to a room needs to feel immediate. Mount the docked view
        // invisibly in this same render, then let the effect below fade it in.
        // The previous exit first spent a full transition fading out the
        // full-screen room, then another fading in the docked room, which
        // made returning feel delayed even though entering felt responsive.
        setPaneVisible(false);
        setIsFullScreen(false);
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

    // Double-tap zoom exits on a deliberate tap inside the visualizer only.
    // A held touch or drag is left alone so users can pan the enlarged frame.
    useEffect(() => {
        if (!isMaxZoom || isFullScreen) return undefined;
        if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) return undefined;
        const pane = visualizerPaneRef.current;
        if (!pane) return undefined;
        const recordTouchStart = (event) => {
            const touch = event.touches[0];
            if (!touch) return;
            zoomTouchStartRef.current = { x: touch.clientX, y: touch.clientY, at: Date.now() };
        };
        const dismissMaxZoomOnTap = (event) => {
            const start = zoomTouchStartRef.current;
            const touch = event.changedTouches[0];
            zoomTouchStartRef.current = null;
            if (!start || !touch) return;
            const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
            const heldFor = Date.now() - start.at;
            if (moved > 12 || heldFor > 280) return;
            lastTapRef.current = 0;
            // A second finger-up from the same double tap arrives shortly
            // after this one. Ignore it so a double tap exits deep zoom just
            // as reliably as a single tap, rather than immediately re-entering.
            ignoreZoomTapUntilRef.current = Date.now() + MOBILE_DOUBLE_TAP_DELAY_MS;
            setIsMaxZoom(false);
        };
        pane.addEventListener('touchstart', recordTouchStart, { passive: true });
        pane.addEventListener('touchend', dismissMaxZoomOnTap, { passive: true });
        return () => {
            pane.removeEventListener('touchstart', recordTouchStart);
            pane.removeEventListener('touchend', dismissMaxZoomOnTap);
        };
    }, [isMaxZoom, isFullScreen]);

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
        metReturnRef.current = null;
        try {
            sessionStorage.removeItem('met_art_homepage_scroll');
        } catch (_) {}
        const pixelSize = getMetArtworkPixelSize(art) || ((art.imageWidth && art.imageHeight) ? { w: art.imageWidth, h: art.imageHeight } : null);
        const maxSize = maxFramePrintSize(pixelSize);
        const recSize = getMetRecommendedSize(art);
        const sizeObj = recSize || maxSize;

        applyInspirationSelection({
            presetImage: art.image,
            presetTitle: art.title,
            initialSize: sizeObj,
            orientation: sizeObj?.orientation || maxSize?.orientation || art.orientation,
            imageWidth: pixelSize?.w || art.imageWidth || null,
            imageHeight: pixelSize?.h || art.imageHeight || null,
        });
        setIsMetModalOpen(false);
    };

    const handleMetModalClose = () => {
        setIsMetModalOpen(false);
        if (metReturnRef.current) {
            const { scrollY, returnTo } = metReturnRef.current;
            metReturnRef.current = null;
            if (navigate) {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                    navigate(-1);
                } else {
                    navigate(returnTo || '/');
                }
            }
            if (typeof window !== 'undefined' && typeof scrollY === 'number') {
                const restore = () => window.scrollTo({ top: scrollY, behavior: 'instant' });
                restore();
                requestAnimationFrame(restore);
                setTimeout(restore, 50);
                setTimeout(restore, 150);
            }
        }
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
    const isSquareFrame = Boolean(wInch && hInch && Math.abs(wInch - hInch) < 0.01);
    const railWidthIn = getMouldingWidthIn(selectedFrame);
    const isCanvasOnly = selectedFrame?.canvasOnly || selectedFrame?.id === 'frame-canvas';
    const minimumPrintDpi = minimumPrintDpiForFrame(selectedFrame);
    const minimumFloorDpi = minimumNativeFloorDpiForFrame(selectedFrame);
    const canvasWrap = prodigiSelection?.attributes?.wrap || 'ImageWrap';
    const physicalGapIn = Math.max(0, Number(selectedFrame?.canvasGapMm) || 0) / 25.4;
    // The most the mat-width slider can offer for this print size + frame
    // without the render's own 45%-of-frame safety clamp kicking in — see
    // maxMatWidthForSize's own comment in matting.js for why this needs to
    // exist at all (otherwise a customer could pick a mat wider than what
    // actually gets drawn, and production would receive that wider,
    // un-clamped number instead of what was approved on screen).
    const sizeMaxMatWidthIn = maxMatWidthForSize(wInch, hInch, railWidthIn);
    const innerWidthCm = (wInch || 0) * 2.54;
    const innerHeightCm = (hInch || 0) * 2.54;
    const railWidthCm = railWidthIn * 2.54;
    const outerFrameWidthCm = innerWidthCm + (railWidthCm + physicalGapIn * 2.54) * 2;
    const outerFrameHeightCm = innerHeightCm + (railWidthCm + physicalGapIn * 2.54) * 2;
    const fitEnabled = !isPlaceholder && !isPreset && !isAlbumArt && !isAlbumPoster
        && !isMoviePoster && !isMoviePosterPrint && !isCanvasOnly && !selectedFrame?.isCanvas
        && glassType !== 'canvas-traditional' && glassType !== 'canvas-floater'
        && imageNaturalSize?.w > 0 && !(collageImages?.length > 0);
    const fitGeometry = selectedSize ? frameGeometry(selectedSize, orientation, matWidth, railWidthIn) : null;
    const fitCrop = fitEnabled ? imageCrop(imageNaturalSize, fitGeometry, fitPosition, minimumFloorDpi, activeContentBounds) : null;
    useEffect(() => { setWasAddedToCart(false); }, [fitPosition]);

    // If switching size/orientation/frame drops sizeMaxMatWidthIn below the
    // customer's current mat width (e.g. they set a wide mat, then picked a
    // much smaller print), pull it back down to what's actually selectable
    // on the slider now — otherwise the stored value would sit above what
    // the slider itself allows, out of sync with what's drawn on screen.
    useEffect(() => {
        if (typeof matWidth === 'number' && matWidth > sizeMaxMatWidthIn) {
            setMatWidth(sizeMaxMatWidthIn);
        }
    }, [sizeMaxMatWidthIn, matWidth, setMatWidth]);

    const visualizerMetrics = (() => {
        if (!wInch || !hInch) return { height: undefined, scale: 1 };
        // Sizing calibration only — no longer tied to a rendered artefact.
        // The plain-wall reference sofa was removed (the frame is just
        // centred in the pane now), but the frame still needs *some* basis
        // for how big a fraction of the container it renders at, so this
        // keeps the same 160cm/42% ratio the sofa used to provide.
        const FRAME_SCALE_REF_CM = 160;
        const FRAME_SCALE_REF_PCT = 42;

        const containerWidth = isSideBySide ? windowSize.width * 0.70 : windowSize.width;

        // The viewport is sized once, for the largest catalogue frame
        // (100×150cm, portrait — the tallest orientation of the largest
        // reference, so this is the true worst-case height), and then held
        // fixed. It no longer tracks whatever size is actually selected, so
        // switching dimensions only changes how big the frame renders inside
        // a constant-size viewport, never the viewport itself. Rail width
        // still comes from the current frame STYLE (a chunkier moulding
        // legitimately wants a touch more room) — only the SIZE dependency
        // is removed.
        const LARGEST_REF_INNER_W_CM = 100;
        const LARGEST_REF_INNER_H_CM = 150;
        const largestOuterWidthCm = LARGEST_REF_INNER_W_CM + (railWidthCm * 2);
        const largestOuterHeightCm = LARGEST_REF_INNER_H_CM + (railWidthCm * 2);

        // Calculate frame width in pixels. A room scene measures the piece
        // against its own wall span rather than this reference, and the two
        // don't agree — 90cm on the Entryway's 340cm wall renders ~12%
        // larger than the reference formula predicts. Using the reference
        // number regardless would leave this whole block under-estimating
        // the piece in exactly the scenes where it comes closest to the
        // controls.
        // Keep the mobile canvas fixed across Close-Up and rooms. A changing
        // pane height causes ResizeObserver to recalculate frame geometry on
        // every animation tick, fighting the frame's own transition.
        const activeSceneForMetrics = roomSceneId
            ? ROOM_SCENES.find((s) => s.id === roomSceneId)
            : !isSideBySide ? ROOM_SCENES[0] : null;
        const frameWidthPct = activeSceneForMetrics
            ? (largestOuterWidthCm / (activeSceneForMetrics.wallSpanCm + (activeSceneForMetrics.canvasInsetLeftCm || 0))) * 100
            : (largestOuterWidthCm / FRAME_SCALE_REF_CM) * FRAME_SCALE_REF_PCT;
        const frameWidthPx = (frameWidthPct / 100) * containerWidth;
        const frameHeightPx = frameWidthPx * (largestOuterHeightCm / largestOuterWidthCm);

        // Add proportional padding: small frames get a tighter crop to pull menus up, large frames get more breathing room
        const dynamicPadding = Math.min(140, 60 + frameHeightPx * 0.8);

        let calculatedHeight;
        if (activeSceneForMetrics) {
            // Room scenes: this reservation formula predates the plain-wall
            // sofa's removal and stays exactly as it was — every room-scene
            // collision sweep this session was verified against this pane
            // height, so changing it here (even to simplify) risks silently
            // reopening a frame/furniture collision nothing re-checks for.
            const sofaWidthPx = containerWidth * 0.48;
            const sofaHeightPx = sofaWidthPx * (300 / 800);
            const ZONE_TOP_PX = 40; // matches the zone's own top inset — see "FRAME POSITIONING ZONE" below
            const SOFA_GAP_PX = 24;
            const ZONE_HEIGHT_PCT = 0.65;
            // The visualizer has no caption band below it. Keep the former
            // band as part of the room canvas, below the furniture, so large
            // pieces gain real vertical room instead of pushing into chrome.
            const FLOOR_HEADROOM_PX = 28;
            const sofaBlockHeight = sofaHeightPx + FLOOR_HEADROOM_PX;
            const minHeightForRoomFit = (ZONE_TOP_PX / 2 + frameHeightPx / 2 + SOFA_GAP_PX + sofaBlockHeight) / (1 - ZONE_HEIGHT_PCT / 2);
            calculatedHeight = Math.max(frameHeightPx + sofaHeightPx + dynamicPadding, minHeightForRoomFit);
        } else {
            // Plain wall: no reference artefact anymore, so the pane only
            // needs to fit the frame itself — this (not the room-scene
            // formula above) is what lets it flex-centre instead of sitting
            // high to leave room for a sofa that's no longer drawn.
            calculatedHeight = frameHeightPx + dynamicPadding;
        }

        // Ensure it doesn't get ridiculously small (lowered to 180px) or impossibly tall
        // Mobile max height is 65%, Desktop side-by-side uses ~80vh for the visualizer
        const maxHeight = isSideBySide ? windowSize.height * 0.80 : windowSize.height * 0.65;
        // The former 28px note band now belongs to the visualizer. Mobile
        // needs the full amount explicitly because its pane has a fixed
        // height; desktop inherits it through the flex column.
        const NOTE_BAND_TO_VIEWPORT_PX = 44;
        const finalHeight = Math.max(180, Math.min(calculatedHeight, maxHeight))
            + (isSideBySide ? 0 : NOTE_BAND_TO_VIEWPORT_PX);
        
        const scale = calculatedHeight > maxHeight ? finalHeight / calculatedHeight : 1;

        return { height: finalHeight, scale };
    })();

    // Physical mat reveal in inches, per edge — see src/utils/matting.js. Shared
    // with the order-thumbnail capture below AND with the AR viewer (passed
    // through whole, not collapsed to one number) so none of the three can
    // disagree with each other.
    const matReveal = selectedFrame?.isCanvas || isCanvasOnly
        ? { topIn: 0, sideIn: 0, bottomIn: 0 }
        : getMatReveal(matWidth, selectedSize);


    useEffect(() => {
        if (!uploadedImage) {
            setImageNaturalSize(null);
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
        // is irrelevant for them — skip entirely rather than decode the
        // (often 50MB+) generated canvas data URL a second time purely to
        // compute values this flow never uses. That redundant decode ran on
        // every single size change, competing with the visible <img> tag's
        // own decode of the identical string.
        if (isAlbumPoster || isMoviePosterPrint) {
            return;
        }
        // Preset/Inspiration selections (Original Paintings, Canvas Art, etc.)
        // already specify their own orientation via the selection itself, so
        // auto-detect must not override that choice — but imageNaturalSize
        // still needs computing for these (it now also drives whether a
        // no-mat frame fills edge-to-edge or letterboxes), so this only skips
        // the auto-detect portion below rather than returning early and
        // skipping the whole effect. Returning early here used to silently
        // leave imageNaturalSize null forever for every
        // preset image, not just the one loaded on mount as intended.
        const isPresetImage = uploadedImage === initialPresetImageRef.current;
        const effectImage = uploadedImage;
        const thumbUrl = getThumbnailUrl(uploadedImage, 1400);
        const isUntransformedUrl = thumbUrl === uploadedImage;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (cancelled || effectImage !== latestUploadedImageRef.current) return;
            const known = knownImageDimensionsRef.current;
            if (known?.url === effectImage && known.w > 0 && known.h > 0) {
                setImageNaturalSize({ w: known.w, h: known.h });
            } else {
                const measured = { w: img.naturalWidth, h: img.naturalHeight };
                if (isUntransformedUrl) {
                    knownImageDimensionsRef.current = { url: effectImage, ...measured };
                }
                setImageNaturalSize(measured);
            }
            setIsImageLoading(false); // Hide spinner safely even if cached

            // Intelligently scan for leftover frame mouldings / scanner margins
            detectArtworkContentBounds(thumbUrl || effectImage).then(detected => {
                if (cancelled || effectImage !== latestUploadedImageRef.current) return;
                if (detected?.hasLeftoverFrame && detected.insets) {
                    setCleanFrameInsets(detected.insets);
                } else {
                    setCleanFrameInsets(null);
                }
            }).catch(() => {
                if (cancelled || effectImage !== latestUploadedImageRef.current) return;
                setCleanFrameInsets(null);
            });

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
        };
        img.onerror = () => {
            if (cancelled) return;
            setIsImageLoading(false);
        };
        // Only need this for aspect ratio (orientation-match), not
        // pixel-perfect dimensions, so load the same thumbnail-sized
        // transform the visible <img> already uses (getThumbnailUrl no-ops
        // for blob:/data: URLs, so direct uploads are unaffected — this only
        // changes behavior for Cloudinary-hosted preset/Inspiration images).
        // Previously this always downloaded the full-resolution original a
        // second time in the background just to measure it, which competed
        // with the visible thumbnail for bandwidth on slower connections.
        img.src = thumbUrl;
        return () => {
            cancelled = true;
        };
    }, [uploadedImage, setOrientation, setSelectedSize, isAlbumPoster, isMoviePoster, isMoviePosterPrint]);

    const dismissSceneHint = () => {
        setShowSceneHint(false);
    };

    const openScenePickerFromHint = () => {
        const sceneOrder = [null, ...ROOM_SCENES.map((scene) => scene.id)];
        const currentIndex = Math.max(0, sceneOrder.indexOf(roomSceneId));
        selectRoomScene(sceneOrder[(currentIndex + 1) % sceneOrder.length]);
    };

    const preloadRoomScene = (sceneId) => {
        if (!sceneId) return Promise.resolve();
        const cached = roomScenePreloadRef.current.get(sceneId);
        if (cached) return cached;

        const room = ROOM_SCENES.find((scene) => scene.id === sceneId);
        const urls = [room?.image, room?.foregroundImage, room?.wallMaskImage].filter(Boolean);
        const load = (url) => new Promise((resolve) => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = () => {
                if (typeof image.decode === 'function') {
                    image.decode().catch(() => {}).finally(resolve);
                } else {
                    resolve();
                }
            };
            image.onerror = resolve;
            image.src = url;
        });
        const preload = Promise.all(urls.map(load)).then(() => undefined);
        roomScenePreloadRef.current.set(sceneId, preload);
        return preload;
    };

    // Keep the next swipe warm without putting image decode on the gesture's
    // critical path.  The first scene adjacent to Close-Up is prefetched as
    // soon as the pane settles; after that both directions stay one step
    // ahead.  requestIdleCallback is deliberately used when available so a
    // phone never competes with the current scene's first paint.
    useEffect(() => {
        if (departingRoomSceneId || departingWasCloseUp) return undefined;
        const sceneOrder = [null, ...ROOM_SCENES.map((scene) => scene.id)];
        const currentIndex = Math.max(0, sceneOrder.indexOf(roomSceneId));
        const sceneIds = [sceneOrder[(currentIndex - 1 + sceneOrder.length) % sceneOrder.length], sceneOrder[(currentIndex + 1) % sceneOrder.length]]
            .filter(Boolean);
        if (!sceneIds.length) return undefined;

        let cancelled = false;
        const warm = () => {
            if (cancelled) return;
            sceneIds.forEach((sceneId) => { void preloadRoomScene(sceneId); });
        };
        const idle = typeof window.requestIdleCallback === 'function'
            ? window.requestIdleCallback(warm, { timeout: 1200 })
            : window.setTimeout(warm, 120);
        return () => {
            cancelled = true;
            if (typeof window.cancelIdleCallback === 'function' && typeof idle === 'number') {
                window.cancelIdleCallback(idle);
            } else {
                window.clearTimeout(idle);
            }
        };
    }, [roomSceneId, departingRoomSceneId, departingWasCloseUp]);

    const finishRoomSceneTransition = (event) => {
        if (event && (event.target !== event.currentTarget || event.animationName !== 'roomSceneSlideIn')) return;
        window.clearTimeout(roomSceneTransitionRef.current);
        setDepartingRoomSceneId(null);
        setDepartingWasCloseUp(false);
    };

    const selectRoomScene = (sceneId) => {
        if (sceneId === roomSceneId) return;
        setMobileRoomReturnSceneId(null);
        dismissSceneHint();
        const selectionToken = ++roomSceneSelectionTokenRef.current;

        // Decode both photo layers before mounting the new room. On a phone,
        // decoding a large backdrop and its foreground cutout during an
        // opacity animation drops frames and makes the transition feel jerky.
        void preloadRoomScene(sceneId).then(() => {
            if (selectionToken !== roomSceneSelectionTokenRef.current) return;
            sceneFrameBoundsRef.current = (sceneId === null || roomSceneId === null)
                ? frameRenderRef.current?.getBoundingClientRect() : null;
            window.clearTimeout(roomSceneTransitionRef.current);
            // Every change — including into or out of Close-Up — retains the
            // outgoing composition just long enough to slide into the next,
            // so all scenes (Close-Up included) feel like one continuous
            // strip. The frame itself stays in its shared calibrated
            // position throughout the transition.
            const sceneOrder = [null, ...ROOM_SCENES.map((s) => s.id)];
            const fromIndex = sceneOrder.indexOf(roomSceneId);
            const toIndex = sceneOrder.indexOf(sceneId);
            setRoomSlideDirection(toIndex >= fromIndex ? 1 : -1);
            setDepartingWasCloseUp(roomSceneId === null);
            setDepartingRoomSceneId(roomSceneId);
            // animationend performs normal cleanup. This is only a fallback
            // for interrupted animations; a busy phone must finish its slide
            // before we remove the outgoing layers.
            roomSceneTransitionRef.current = window.setTimeout(() => {
                setDepartingRoomSceneId(null);
                setDepartingWasCloseUp(false);
            }, window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0 : ROOM_SCENE_TRANSITION_MS + 1000);
            setRoomSceneId(sceneId);
        });
    };

    const handleMobileVisualizerTap = (event) => {
        if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
        event.preventDefault();

        const now = Date.now();
        if (now < ignoreZoomTapUntilRef.current) return;

        if (isFullScreen) {
            if (now - lastTapRef.current < MOBILE_DOUBLE_TAP_DELAY_MS) {
                lastTapRef.current = 0;
                exitFullScreen();
                return;
            }
            lastTapRef.current = now;
            return;
        }

        // Deep Close-Up zoom has its own pane-level single-tap exit effect.
        if (isMaxZoom) return;

        // Close-Up reached from a room scene is an inspection detour, not a
        // second zoom mode. Either one tap or a double tap returns exactly to
        // the room the customer just left.
        if (mobileRoomReturnSceneId) {
            setMobileRoomReturnSceneId(null);
            setRoomSceneId(mobileRoomReturnSceneId);
            setDepartingRoomSceneId(null);
            lastTapRef.current = 0;
            return;
        }

        if (roomSceneId) {
            if (now - lastTapRef.current < MOBILE_DOUBLE_TAP_DELAY_MS) {
                setMobileRoomReturnSceneId(roomSceneId);
                setRoomSceneId(null);
                setDepartingRoomSceneId(null);
                setIsHovered(false);
                setIsMaxZoom(false);
                lastTapRef.current = 0;
                return;
            }
            lastTapRef.current = now;
            return;
        }

        // In the normal Close-Up view, a double tap is the only way in to
        // deep inspection. A tap while deep inspection is active is handled
        // above by the pane-level exit effect.
        if (now - lastTapRef.current < MOBILE_DOUBLE_TAP_DELAY_MS) {
            setIsMaxZoom(true);
            lastTapRef.current = 0;
            return;
        }
        lastTapRef.current = now;
    };

    const handleMobileTouchStart = (event) => {
        if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
        const touch = event.touches[0];
        if (!touch) return;
        touchGestureStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleMobileTouchMove = (event) => {
        if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
        // The visualizer owns swipes. Let max-zoom retain native panning, but
        // keep ordinary scene gestures from bubbling into the page's mobile
        // customizer scroll container.
        if (isMaxZoom) return;
        if (event.target.closest?.('button, input, [role="button"]')) return;
        event.preventDefault();
    };

    const handleMobileGestureEnd = (event) => {
        if (event.target.closest?.('button, input, [role="button"]')) return;
        const start = touchGestureStartRef.current;
        const touch = event.changedTouches?.[0];
        touchGestureStartRef.current = null;
        if (start && touch) {
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (Math.hypot(dx, dy) > 24) {
                if (!isMaxZoom && !isFullScreen && Math.abs(dx) > Math.abs(dy) * 1.25) {
                    const sceneOrder = [null, ...ROOM_SCENES.map((scene) => scene.id)];
                    const currentId = mobileRoomReturnSceneId || roomSceneId;
                    const currentIndex = Math.max(0, sceneOrder.indexOf(currentId));
                    const direction = dx < 0 ? 1 : -1;
                    const nextIndex = (currentIndex + direction + sceneOrder.length) % sceneOrder.length;
                    event.preventDefault();
                    selectRoomScene(sceneOrder[nextIndex]);
                }
                lastTapRef.current = 0;
                return;
            }
        }
        handleMobileVisualizerTap(event);
    };

    const selectFrameStyle = (frame) => {
        setSelectedFrame(frame);
        setProdigiSelection(null);
        if (frame?.prodigiProduct && !['classic', 'box'].includes(frame.prodigiProduct)) {
            setMatWidth('none');
        }
        // A new moulding can change how a piece feels in a room just as much
        // as a new image does, so offer the same room-scene comparison again.
        setShowSceneHint(true);
    };

    const updateProdigiVisualOptions = useCallback(({ matWidth: nextMatWidth, matColorId: nextMatColorId, glassType: nextGlassType }) => {
        setMatWidth(nextMatWidth);
        setGlassType(nextGlassType);
        if (nextMatWidth !== 'none') setMatColor(MAT_COLORS.find(color => color.id === nextMatColorId) || MAT_COLORS[0]);
    }, [setMatWidth, setGlassType, setMatColor]);

    // Takes a picked image File (from the device dialog OR the cloud-storage
    // picker) and drops it into the studio: instant local preview now, then a
    // background upload to the cloud image host for the print-quality version.
    const applyImageFile = async (file) => {
        if (!file) return;
        setIsPreset(false);
        setPresetTitle('');
        setIsAlbumArt(false);
        setIsAlbumPoster(false);
        setIsMoviePoster(false);
        setIsMoviePosterPrint(false);
        setPosterData(null);
        knownImageDimensionsRef.current = null;
        if (setProductionImage) setProductionImage(null);
        // Canvas glazing (Traditional/Floater) hides matting entirely — a
        // real physical constraint for whichever photo it was chosen for,
        // but glassType lives above this page and survives a fresh upload,
        // so a canvas choice made for a previous photo was silently
        // carrying over and hiding matting for an unrelated new one. A new
        // upload is a new configuration; it shouldn't inherit a glazing
        // decision that was about a different picture.
        setGlassType('standard');
        setIsUploading(true);
        try {
            // Instantly generate local URL for immediate visual rendering in the frame studio
            const localUrl = URL.createObjectURL(file);
            const localDimensionsPromise = loadImageCached(localUrl)
                .then((img) => (
                    img?.naturalWidth > 0 && img?.naturalHeight > 0
                        ? { w: img.naturalWidth, h: img.naturalHeight }
                        : null
                ))
                .catch(() => null);
            setUploadedImage(localUrl);
            setShowSceneHint(true);
            setIsUploading(false); // Stop spinner immediately once local preview is ready

            // Perform cloud upload asynchronously in the background so the UI is never blocked
            setIsCloudUploadPending(true);
            Promise.all([uploadImageToCloud(file), localDimensionsPromise])
                .then(([cloudUrl, dims]) => {
                    if (dims) {
                        knownImageDimensionsRef.current = { url: cloudUrl, ...dims };
                        setImageNaturalSize(dims);
                    } else if (knownImageDimensionsRef.current?.url === localUrl) {
                        knownImageDimensionsRef.current = {
                            ...knownImageDimensionsRef.current,
                            url: cloudUrl,
                        };
                    }
                    setUploadedImage(cloudUrl);
                    if (setProductionImage) setProductionImage(cloudUrl);
                })
                .catch(error => {
                    console.warn('Background cloud upload failed, falling back to local preview:', error);
                    setFitError('The print file upload did not finish. Please choose the image again.');
                })
                .finally(() => setIsCloudUploadPending(false));
        } catch (error) {
            console.error('Failed to create local preview:', error);
            setIsUploading(false);
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
            const previewSource = getThumbnailUrl(uploadedImage || sourceImage, 1400) || sourceImage;
            const img = await loadImageCached(previewSource);

            if (selectedFrame?.prodigiProduct) {
                const blob = await renderFrameOrderPreview({ frame: selectedFrame, image: img,
                    widthIn: wInch, heightIn: hInch, matReveal, matColorHex: matColor?.hex, glassType });
                if (!blob) return null;
                return await uploadImageToCloud(new File([blob], 'order-thumbnail.jpg', { type: blob.type || 'image/jpeg' }));
            }

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
            // JPEG has no alpha, so give the margin around the frame an
            // opaque off-white (same as the Prodigi order preview).
            ctx.fillStyle = '#faf9f7';
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

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

            // Same equal-edge formula the live visualizer
            // uses (src/utils/matting.js) — previously this capture had its
            // own flat percentage table that could disagree with what the
            // customer actually saw on screen.
            const thumbMatReveal = (!isCanvasPrint && !isCanvasGlazing) ? getMatReveal(matWidth, selectedSize) : { topIn: 0, sideIn: 0, bottomIn: 0 };
            const matW = Math.round(w * ((thumbMatReveal.sideIn / sizeW) || 0));
            const matHTop = Math.round(h * ((thumbMatReveal.topIn / sizeH) || 0));
            const matHBottom = Math.round(h * ((thumbMatReveal.bottomIn / sizeH) || 0));
            const matLeft = offsetX + borderW, matTop = offsetY + borderH, matRight = offsetX + w - borderW, matBottom = offsetY + h - borderH;
            if (thumbMatReveal.topIn > 0) {
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
            const artTop = matTop + matHTop + gapPx - overlapPx;
            const artW = Math.max(1, (matRight - matW - gapPx + overlapPx) - artLeft);
            const artH = Math.max(1, (matBottom - matHBottom - gapPx + overlapPx) - artTop);

            // Fill the artwork opening edge-to-edge. Aspect-ratio differences
            // use the same centered crop as the live visualizer.
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const boxAspect = artW / artH;
            let drawW, drawH;
            const widthConstrained = imgAspect > boxAspect;
            if (widthConstrained) {
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

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
            if (!blob) return null;
            const file = new File([blob], 'order-thumbnail.jpg', { type: blob.type || 'image/jpeg' });
            return await uploadImageToCloud(file);
        } catch (err) {
            console.warn('Order thumbnail generation failed, falling back to raw artwork image:', err);
            return null;
        }
    };

    const buildCartItem = (visualizerImage) => {
        const itemSubtotal = selectedFrame?.prodigiProduct
            ? (Number(prodigiSelection?.quoteItemsGbp) || Number(prodigiSelection?.quoteTotalGbp) || 0)
            : (Math.round((selectedSize?.price || 0) * (selectedFrame?.priceMod || 1)) +
                (selectedFrame?.id !== 'frame-canvas' && glassType !== 'canvas-floater' && glassType !== 'canvas-traditional' && matWidth !== 'none' ? (matColor.price || 75) : 0) +
                (!isCanvasOnly ? (glassType === 'non-glare' ? 100 : glassType === 'museum' ? 200 : 0) : 0) +
                (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-floater' ? 400 : 0) +
                (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-traditional' ? 350 : 0) +
                (hardwareType === 'french-cleat' ? 50 : 0));

        const assetUrl = productionImage || uploadedImage;
        const printQuality = activeImagePixelSize && fitGeometry
            ? buildPrintQualitySpec({
                sourceSize: activeImagePixelSize,
                geometry: fitGeometry,
                position: fitEnabled ? fitPosition : DEFAULT_POSITION,
                frame: selectedFrame,
                minimumDpi: minimumPrintDpi,
                contentBounds: activeContentBounds,
                assetUrl,
                assetKind: 'original',
            })
            : null;

        return {
            productMode: 'frame',
            uploadedImage,
            productionImage,
            printQuality,
            visualizerImage,
            selectedFrame,
            selectedSize,
            totalPrice: itemSubtotal,
            currency: selectedFrame?.prodigiProduct ? 'GBP' : 'GHS',
            orientation,
            matColor,
            matWidth,
            glassType,
            hardwareType: selectedFrame?.prodigiProduct
                ? (prodigiSelection?.hangingHardware?.included ? prodigiSelection.hangingHardware.id : null)
                : hardwareType,
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
            } : null,
            prodigi: prodigiSelection ? {
                ...prodigiSelection,
                sizing: 'fillPrintArea',
            } : null,
        };
    };

    // The visualizer thumbnail is helpful but optional. It may involve a
    // cross-origin image load plus an upload to the image host, so a blocked
    // image host or a temporarily unavailable upload endpoint must never leave
    // Add to Cart spinning forever. The cart and order still have the full
    // production artwork URL as their canonical fallback.
    const captureVisualizerImageWithTimeout = async (timeoutMs = 5000) => {
        let timeoutId;
        try {
            return await Promise.race([
                captureVisualizerImage(),
                new Promise((resolve) => {
                    timeoutId = setTimeout(() => resolve(null), timeoutMs);
                }),
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    const prepareFrameOutputWithTimeout = async (source, geometry, position, frameColor, matColor, options = {}, timeoutMs = 12000) => {
        let timeoutId;
        try {
            return await Promise.race([
                prepareFrameOutput(source, geometry, position, frameColor, matColor, options),
                new Promise((resolve) => {
                    timeoutId = setTimeout(() => resolve(null), timeoutMs);
                }),
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    // The thumbnail is cosmetic, so for "Add to cart" it uploads in the
    // background and is attached to the item when it lands. If the customer
    // removed the item meanwhile, or the upload failed (null), nothing
    // happens and every thumbnail slot keeps falling back to the artwork.
    const attachThumbnailWhenReady = (cartItemId, pendingThumbnail) => {
        if (!cartItemId || !pendingThumbnail) return;
        Promise.resolve(pendingThumbnail)
            .then((url) => { if (url) updateCartItem(cartItemId, { visualizerImage: url }); })
            .catch(() => {});
    };

    const activeImageWidth = !isPlaceholder ? Number(imageNaturalSize?.w) : 0;
    const activeImageHeight = !isPlaceholder ? Number(imageNaturalSize?.h) : 0;
    const activeImagePixelSize = (activeImageWidth > 0 && activeImageHeight > 0)
        ? { w: activeImageWidth, h: activeImageHeight }
        : null;
    const isProdigiFrame = Boolean(selectedFrame?.prodigiProduct);
    const prodigiConfiguration = useMemo(() => prodigiConfigurationFromSelection(prodigiSelection), [prodigiSelection]);
    const prodigiSizes = useMemo(
        () => prodigiAvailableSizes(selectedFrame, prodigiConfiguration)
            .filter((size) => !(activeImageWidth > 0 && activeImageHeight > 0)
                || doesSizeMeetMinDpi(size, { w: activeImageWidth, h: activeImageHeight }, minimumNativeFloorDpiForFrame(selectedFrame))),
        [selectedFrame, prodigiConfiguration, activeImageWidth, activeImageHeight]
    );
    const hasOrderableProdigiProduct = Boolean(isProdigiFrame && prodigiSizes.length);

    useEffect(() => {
        if (!hasOrderableProdigiProduct) return;
        const matched = prodigiSizes.find((size) =>
            (size.prodigiSizeInches && selectedSize?.prodigiSizeInches && size.prodigiSizeInches === selectedSize.prodigiSizeInches)
            || (size.id && selectedSize?.id && size.id === selectedSize.id)
            || (Math.abs(size.width - selectedSize?.width) < 0.35 && Math.abs(size.height - selectedSize?.height) < 0.35));
        if (matched) {
            if (selectedSize !== matched && (selectedSize?.id !== matched.id || selectedSize?.width !== matched.width || selectedSize?.height !== matched.height)) {
                setSelectedSize(matched);
            }
            return;
        }
        const nearest = nearestProdigiSize(prodigiSizes, selectedSize);
        if (nearest) {
            setSelectedSize(nearest);
        }
    }, [hasOrderableProdigiProduct, prodigiSizes, selectedSize, setSelectedSize]);

    const { finalSizesList, leftColumnCollapsed, rightColumnCollapsed } = useMemo(() => {
        const uniqueSizes = [];
        const sizeSeen = new Set();
        const baseSizes = prodigiSizes;
        const sortedSizes = [...baseSizes].sort((a, b) => {
            const aMax = Math.max(a.width, a.height), aMin = Math.min(a.width, a.height);
            const bMax = Math.max(b.width, b.height), bMin = Math.min(b.width, b.height);
            if (aMax !== bMax) return aMax - bMax;
            const aRatio = aMax / aMin, bRatio = bMax / bMin;
            if (Math.abs(aRatio - bRatio) > 0.001) return aRatio - bRatio;
            return (a.width * a.height) - (b.width * b.height);
        });

        for (const size of sortedSizes) {
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

        const finalSizesList = uniqueSizes;

        // Collapsed view shows up to 12 popular sizes in a 2-column layout
        const leftColumnCollapsed = finalSizesList.slice(0, 6);
        const rightColumnCollapsed = finalSizesList.slice(6, 12);

        // Always keep the size options collapsed unless the user expands the list.
        // When artwork (from public domain art, uploads, or presets) has a size
        // outside the collapsed list, show that active size as the last item on the collapsed view.
        if (selectedSize) {
            const isInCollapsed = leftColumnCollapsed.some(s => isSameSize(s, selectedSize))
                || rightColumnCollapsed.some(s => isSameSize(s, selectedSize));

            if (!isInCollapsed) {
                const activeSize = finalSizesList.find(s => isSameSize(s, selectedSize)) || selectedSize;
                if (rightColumnCollapsed.length > 0) {
                    rightColumnCollapsed[rightColumnCollapsed.length - 1] = activeSize;
                } else if (leftColumnCollapsed.length > 0) {
                    rightColumnCollapsed.push(activeSize);
                } else {
                    leftColumnCollapsed.push(activeSize);
                }
            }
        }

        return { finalSizesList, leftColumnCollapsed, rightColumnCollapsed };
    }, [isAlbumPoster, isMoviePoster, isMoviePosterPrint, prodigiSizes, selectedSize]);

    const isImageBelowMinDpi = Boolean(activeImagePixelSize && finalSizesList.length === 0);
    const productionAssetUrl = productionImage || uploadedImage;
    const hasSecureProductionAsset = /^https:\/\//i.test(String(productionAssetUrl || ''));
    const isPrintQualityPending = Boolean(hasImage && isProdigiFrame && (!activeImagePixelSize || !hasSecureProductionAsset));

    const completeCheckoutAction = async (action) => {
        if (isImageBelowMinDpi) {
            setFitError(`This image's resolution is below our ${minimumPrintDpi} DPI print minimum. Please upload a higher-resolution image.`);
            return;
        }
        if (selectedFrame?.prodigiProduct && !activeImagePixelSize) {
            setFitError('We are still checking this image’s print resolution. Please wait a moment and try again.');
            return;
        }
        if (selectedFrame?.prodigiProduct && !hasSecureProductionAsset) {
            setFitError('The print-quality image upload has not finished. Please choose the image again if this message remains.');
            return;
        }
        if (selectedFrame?.prodigiProduct && !prodigiSelection?.quoteTotalGbp) {
            setFitError(hasOrderableProdigiProduct
                ? 'Please wait for the live GBP price before adding this item to your cart.'
                : 'This preview finish is not currently available to order.');
            return;
        }
        // "Buy now" keeps waiting for the thumbnail so the order that follows
        // straight away is created with it; "Add to cart" doesn't need to.
        const thumbnailInBackground = action === 'cart';
        setLoadingAction(action);
        setFitError('');
        // For Prodigi frames at default center crop (x=0.5, y=0.5, zoom=1),
        // pass the untouched master productionImage URL directly to Prodigi
        const hasTrimmedFrameEdges = Boolean(cleanFrameInsets && (cleanFrameInsets.top > 0 || cleanFrameInsets.bottom > 0 || cleanFrameInsets.left > 0 || cleanFrameInsets.right > 0));
        const needsCustomCropOutput = fitEnabled && (!isDefaultFitPosition(fitPosition) || hasTrimmedFrameEdges || !selectedFrame?.prodigiProduct);
        try {
            if (needsCustomCropOutput) {
                // Give Pay Now ample time (25s) to upload high-res print + thumbnail
                const timeoutMs = action === 'pay' ? 25000 : 12000;
                const result = await prepareFrameOutputWithTimeout(productionImage || uploadedImage, fitGeometry,
                    fitPosition, selectedFrame.baseColor, matColor.hex, {
                        deferThumbnail: thumbnailInBackground,
                        frame: selectedFrame,
                        minimumDpi: minimumFloorDpi,
                        contentBounds: activeContentBounds,
                    }, timeoutMs);
                if (action === 'pay') toggleAllSelection(false);
                if (result) {
                    // thumbnailUpload is a promise, not cart data — keep it out of the item.
                    const { thumbnailUpload, ...output } = result;
                    const cartItemId = addToCart({ ...buildCartItem(output.visualizerImage), ...output });
                    attachThumbnailWhenReady(cartItemId, thumbnailUpload);
                } else {
                    // A raw-master fallback would discard the customer's adjusted crop.
                    // Keep the item out of the cart and let them retry instead.
                    throw new Error('Preparing your high-resolution print timed out. Please check your connection and try again.');
                }
            } else if (thumbnailInBackground) {
                const cartItemId = addToCart(buildCartItem(null));
                attachThumbnailWhenReady(cartItemId, captureVisualizerImage());
            } else {
                const visualizerImage = await captureVisualizerImageWithTimeout(action === 'pay' ? 15000 : 8000);
                if (action === 'pay') toggleAllSelection(false);
                addToCart(buildCartItem(visualizerImage));
            }

            setWasAddedToCart(true);
            if (action === 'pay') {
                if (!user) setShowAuthModal(true);
                else navigate('/checkout');
            }
        } catch (error) {
            setFitError(error.message || 'Could not prepare your frame. Please try again.');
        } finally {
            setLoadingAction(null);
        }
    };

    // Total catalog sizes actually visible in the collapsed view, used to
    // decide whether "+ more sizes" should appear at all and what count to
    // show on it.
    const collapsedShownCount = leftColumnCollapsed.length + rightColumnCollapsed.length;

    const formatProdigiDimension = (size) => {
        const source = unit === 'cm' ? size.prodigiSizeCm : size.prodigiSizeInches;
        const values = source?.match(/\d+(?:\.\d+)?/g)?.slice(0, 2) || [];
        if (values.length < 2) return source;
        let [width, height] = values.map(v => Math.round(parseFloat(v)));
        if (orientation === 'landscape' && width < height) [width, height] = [height, width];
        if (orientation === 'portrait' && width > height) [width, height] = [height, width];
        return `${width} × ${height} ${unit}`;
    };

    const renderSizeButton = (size) => (
        <button
            type="button"
            key={size.id}
            onClick={() => setSelectedSize(size)}
            aria-pressed={selectedSize.width === size.width && selectedSize.height === size.height}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                (selectedSize.width === size.width && selectedSize.height === size.height)
                    ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                    : 'border-stone-200 hover:border-stone-400 text-stone-700'
            }`}
        >
            {size.prodigiSizeCm ? formatProdigiDimension(size) : formatDimensions(size.label, unit, orientation)}
        </button>
    );

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
    const stepImagePosition = fitEnabled ? stepCounter++ : null;
    const stepProdigi = selectedFrame?.prodigiProduct ? stepCounter++ : null;
    
    // A canvas print (glassType 'canvas-floater'/'canvas-traditional') is
    // mounted inside whichever frame moulding is selected — it doesn't take
    // a paper mat, so matting is hidden for it the same way it's hidden for
    // the frame-less 'frame-canvas' Gallery Wrapped Canvas style.
    const canvasMountStyle = glassType === 'canvas-floater' ? 'floater' : glassType === 'canvas-traditional' ? 'traditional' : null;
    const effectiveCanvasMountStyle = selectedFrame?.canvasFrameStyle || canvasMountStyle;
    const isCanvasGlazing = Boolean(effectiveCanvasMountStyle) && selectedFrame?.id !== 'frame-canvas';

    const showMatting = !selectedFrame?.prodigiProduct && selectedFrame?.id !== 'frame-canvas' && !isCanvasGlazing && !isPreset;
    const stepMatting = showMatting ? stepCounter++ : null;

    const showGlazing = !selectedFrame?.prodigiProduct && selectedFrame?.id !== 'frame-canvas';
    const stepGlazing = showGlazing ? stepCounter++ : null;
    
    const stepHardware = !selectedFrame?.prodigiProduct ? stepCounter++ : null;

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
    // Studio Loft is the neutral first preview shown before a room has been
    // selected from the picker.
    const sceneHintPreview = ROOM_SCENES.find((scene) => scene.id === 'studio-loft') || ROOM_SCENES[0];
    // Thumbnail-only clearance for the tall formats; scale both axes and
    // the placement height together so the sofa gap stays consistent.
    // The labelled 180cm catalogue sizes store 72 inches (182.88cm).
    // Include that rounded-inch equivalent as well as exact custom sizes.
    const hintFrameScale = innerHeightCm >= 149.5 && innerHeightCm <= 72 * 2.54 + 0.01 ? 0.765 : 1;
    const hintFrameWidthPct = sceneHintPreview?.wallSpanCm
        ? (outerFrameWidthCm / sceneHintPreview.wallSpanCm) * 100 * hintFrameScale
        : 0;
    // cqw measures against the thumbnail width, so portrait and landscape
    // heights remain accurate at both responsive thumbnail sizes. Keep the
    // lower edge at 60% of the thumbnail to leave visible wall above the sofa,
    // rather than growing around a fixed centre until the frame nearly touches it.
    const hintFrameHalfHeightCqw = sceneHintPreview?.wallSpanCm
        ? outerFrameHeightCm / sceneHintPreview.wallSpanCm * 50 * hintFrameScale
        : 0;

    // Computed once and shared: the piece is flex-centred in the zone and the
    // SCENE is offset so the hang point lands on that centre. If the backdrop
    // used the scene's default `hang.y` while the placement raised a tall
    // piece, the two would disagree and the lift would have no visible effect
    // — the piece would sit in the same spot with the room unmoved under it.
    const roomPlacement = activeRoom
        ? computeRoomPlacement(activeRoom, outerFrameWidthCm, outerFrameHeightCm)
        : null;
    const roomLayout = computeRoomLayout(activeRoom, zoneSize.width, zoneSize.height);
    const roomCannotFit = Boolean(roomPlacement?.tooTall || roomPlacement?.overflows)
        && !isHovered && !isMaxZoom && !isFullScreen;

    const wallLuminance = (() => {
        const hex = wallColor.hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    })();
    const isDarkWall = activeRoom?.image && !isHovered && !isMaxZoom && !isFullScreen ? false : wallLuminance < 0.5;
    const wallInkClass = isDarkWall ? 'text-stone-100' : 'text-stone-800';
    const wallInkBorderClass = isDarkWall ? 'border-stone-100' : 'border-stone-800';
    const wallInkBgClass = isDarkWall ? 'bg-stone-100' : 'bg-stone-800';
    const wallInkBlend = isDarkWall ? '' : 'mix-blend-color-burn';
    const departingRoom = departingRoomSceneId
        ? ROOM_SCENES.find((scene) => scene.id === departingRoomSceneId)
        : null;
    const departingRoomLayout = computeRoomLayout(departingRoom, zoneSize.width, zoneSize.height);
    // True whenever a scene change is mid-flight, whichever side (or both)
    // involves Close-Up rather than a photographed room.
    const isTransitioning = Boolean(departingRoom || departingWasCloseUp);

    // Close-Up's "backdrop" is just the pane's flat wall colour — no photo,
    // no room layout — but it still slides like any other scene so the
    // whole strip of scenes (Close-Up included) transitions consistently.
    const renderPlainBackdrop = (phase) => (
        <div
            key={`backdrop-plain-${phase}`}
            onAnimationEnd={finishRoomSceneTransition}
            className={`absolute inset-0 pointer-events-none z-[1] ${phase === 'outgoing' ? 'room-scene-slide-out' : 'room-scene-slide-in'} ${
                isHovered || isMaxZoom || isFullScreen ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ backgroundColor: wallColor.hex, '--room-slide-dir': roomSlideDirection }}
            aria-hidden="true"
        />
    );

    const renderRoomBackdrop = (room, layout, phase = '') => {
        if (!room || !layout) return null;
        const DrawnScene = room.tintable ? ROOM_SCENE_COMPONENTS[room.id] : null;
        // The foreground cutout restores original object colours above this
        // painted base. Masking the paint as well would protect soft edges
        // twice, leaving a pale fringe against saturated wall colours.
        const paintMask = room.foregroundImage ? null : room.wallMaskImage;
        const { width, height, left, top } = layout;
        const layerClass = phase === 'outgoing'
            ? 'z-0 room-scene-slide-out'
            : phase === 'incoming'
                ? 'z-[1] room-scene-slide-in'
                : 'z-[1]';
        return (
            <div
                key={`backdrop-${room.id}`}
                onAnimationEnd={finishRoomSceneTransition}
                className={`absolute inset-0 pointer-events-none ${layerClass} ${
                    isHovered || isMaxZoom || isFullScreen ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ overflow: 'hidden', isolation: 'isolate', backgroundColor: wallColor.hex, '--room-slide-dir': roomSlideDirection }}
                aria-hidden="true"
            >
                <div className="absolute" style={{ left, top, width, height }}>
                    {DrawnScene ? (
                        <DrawnScene wallHex={wallColor.hex} isDarkWall={isDarkWall} canvasInsetLeftCm={room.canvasInsetLeftCm || 0} />
                    ) : (
                        <>
                            <img src={room.image} alt="" className="h-full w-full object-fill" />
                            <div
                                className="absolute inset-0"
                                style={{
                                    backgroundColor: wallColor.hex,
                                    // White paint must lighten the photographed beige wall;
                                    // multiplying by white would leave its colour unchanged.
                                    opacity: !(room.foregroundImage || paintMask) ? 0 : wallColor.id === 'pure-white' ? 0.9 : 0.72,
                                    mixBlendMode: wallColor.id === 'pure-white' ? 'normal' : 'multiply',
                                    maskImage: paintMask ? `url("${paintMask}")` : undefined,
                                    WebkitMaskImage: paintMask ? `url("${paintMask}")` : undefined,
                                    maskMode: paintMask ? 'luminance' : 'alpha',
                                    maskSize: '100% 100%',
                                    maskRepeat: 'no-repeat',
                                    clipPath: paintMask ? `inset(0 0 ${100 - room.wallMaskBottomPct}% 0)` : undefined,
                                }}
                            />
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderRoomForeground = (room, layout, phase = '') => {
        if (!room || !layout || isHovered || isMaxZoom || isFullScreen) return null;
        // Foreground alpha is the inverse wall mask, preserving object colours
        // and occlusion without covering the painted wall with beige patches.
        const ForegroundScene = room.tintable ? ROOM_SCENE_FOREGROUND_COMPONENTS[room.id] : null;
        if (!ForegroundScene && !room.foregroundImage) return null;
        const { width, height, left, top } = layout;
        const layerClass = phase === 'outgoing'
            ? 'z-20 room-scene-slide-out'
            : phase === 'incoming'
                ? 'z-[21] room-scene-slide-in'
                : 'z-20';
        return (
            <div
                key={`foreground-${room.id}`}
                className={`room-scene-foreground absolute inset-0 pointer-events-none ${layerClass}`}
                style={{ overflow: 'hidden', '--room-slide-dir': roomSlideDirection }}
                aria-hidden="true"
            >
                <div className="absolute" style={{ left, top, width, height }}>
                    {room.wallMaskImage && !room.tintable ? (
                        <RoomPhotoForeground room={room} />
                    ) : room.foregroundImage ? (
                        <img
                            src={room.foregroundImage}
                            alt=""
                            className="block h-full w-full object-fill"
                            style={{ mixBlendMode: 'normal' }}
                        />
                    ) : <ForegroundScene canvasInsetLeftCm={room.canvasInsetLeftCm || 0} />}
                </div>
            </div>
        );
    };
    if (!selectedSize || !selectedFrame) return <div className="min-h-screen bg-[#faf9f8]" />;

    return (
        <div className={`flex ${isSideBySide ? 'flex-row h-[calc(100dvh-47px)] overflow-hidden' : 'flex-col min-h-[calc(100dvh-47px)]'} bg-[#faf9f8]`}>
            <PageMeta
                title="Design Your Custom Frame"
                description="Upload a photo or choose art, pick a frame style, mount, and size, and see it rendered on your wall in real time."
            />

            {/* LEFT COLUMN: the visualizer. The former approximation-note band
                is now part of this canvas, giving room scenes extra floor and
                large frames additional headroom.
                `contents` in full screen: the pane goes `fixed inset-0` and
                escapes anyway, and this wrapper would otherwise linger as an
                empty flex child. */}
            <div
                className={
                    isFullScreen
                        ? 'contents'
                        // Stacked mobile/narrow layout: pin the visualizer just below the
                        // header instead of letting it scroll away with the page, so it
                        // stays in view while the customization panel underneath scrolls.
                        // Desktop side-by-side already keeps it in view (fixed-height row,
                        // panel scrolls in its own container), so sticky is a no-op there.
                        // On desktop, flex-row accommodates the left thumbnail panel alongside
                        // the visualizer canvas.
                        : `shrink-0 flex border-r border-stone-200 ${isSideBySide ? 'w-[70%] h-full flex-row' : 'w-full flex-col sticky top-[calc(2.9375rem+env(safe-area-inset-top,0px))] z-30'}`
                }
            >
            {/* Desktop thumbnail rail docked to the left of the visualizer */}
            {isSideBySide && !isFullScreen && (
                <RoomThumbnailRail
                    activeId={roomSceneId}
                    onSelect={selectRoomScene}
                    wallColor={wallColor}
                    uploadedImage={uploadedImage}
                    selectedFrame={selectedFrame}
                    matWidth={matWidth}
                    matColor={matColor}
                    outerFrameWidthCm={outerFrameWidthCm}
                    outerFrameHeightCm={outerFrameHeightCm}
                />
            )}
            <div
                ref={visualizerPaneRef}
                data-testid="visualizer-pane"
                className={`flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMaxZoom ? 'overflow-auto' : 'overflow-hidden'} ${paneVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${
                    isFullScreen
                        ? 'fixed inset-0 z-[250]'
                        : `relative ${isSideBySide ? 'flex-1 min-w-0 min-h-0' : 'w-full'}`
                }`}
                style={{
                    backgroundColor: wallColor.hex,
                    // Keep ordinary visualizer swipes out of the mobile
                    // customizer's page scroll. Deep zoom remains pannable.
                    touchAction: isMaxZoom ? 'pan-x pan-y' : 'none',
                    height: (!isFullScreen && !isSideBySide) ? `${visualizerMetrics.height}px` : undefined
                }}
            >

                
                {/* ── TOP TOOLBAR ──  [dimensions] [scene] [wall colour]
                    One flex row rather than three independently-positioned
                    floats. They used to be absolutely pinned to their own
                    corners, which was fine while there were two of them and
                    broke the moment a third had to sit between: centring the
                    scene picker in the pane isn't the same as centring it in
                    the space left over, because the dimensions pill is twice
                    the width of the wall swatch, and it clipped.

                    Now the row owns the spacing. The picker takes the slack
                    with flex-1 and scrolls inside it, so it can't reach into
                    either neighbour at any width.

                    The whole row fades in every zoomed state — hover-to-zoom,
                    double-tap max-zoom, and the full-screen enhanced view. All
                    three scale the frame past its true size to be looked at
                    closely, and the only things that earn their place then are
                    the piece itself and the approximation note. Faded rather
                    than unmounted so it's a smooth part of the same transition
                    instead of an instant pop.

                    Hover only counts here when it's actually doing something:
                    in Plain scene the frame already renders at its zoomed
                    size by default (see isZoomedByDefault above), so hover
                    has nothing left to reveal there — fading the chrome on a
                    no-op hover just made it flicker away for no reason. Room
                    scenes still fade on hover since that's the real
                    reveal-zoom transition. */}
                <div
                    data-testid="visualizer-chrome"
                    className={`absolute top-3.5 left-3.5 right-3.5 sm:top-4 sm:left-4 sm:right-4 z-50 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 sm:gap-3 transition-opacity ${CHROME_MOTION} ${
                        ((isHovered && activeRoom) || isFullScreen || isMaxZoom) ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                >

                {/* Room scene — on larger screens (isSideBySide), room views are moved
                    to the dedicated left thumbnail panel (like Dunelm/e-commerce galleries),
                    leaving the visualizer and plain view completely alone and clean.
                    On mobile, the compact indicator / hint remains in the top toolbar. */}
                {!isSideBySide ? (
                    showSceneHint && hasImage && !roomSceneId && !isFullScreen && !isMaxZoom ? (
                        <aside
                            aria-label="Room scene preview hint"
                            onMouseEnter={() => {
                                if (sceneHintTimeoutRef.current) window.clearTimeout(sceneHintTimeoutRef.current);
                            }}
                            onMouseLeave={() => {
                                if (showSceneHint) {
                                    sceneHintTimeoutRef.current = window.setTimeout(() => {
                                        setShowSceneHint(false);
                                    }, 2000);
                                }
                            }}
                            className="relative z-20 flex w-[min(18.5rem,calc(100vw-1rem))] items-center gap-1.5 rounded-2xl border border-stone-200/90 bg-white/95 p-1.5 pr-2 font-sans shadow-lg shadow-stone-900/10 backdrop-blur transition-all duration-300"
                        >
                            <button
                                type="button"
                                onClick={openScenePickerFromHint}
                                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-700"
                            >
                                <span className="relative h-11 w-[4.125rem] shrink-0 overflow-hidden rounded-lg bg-stone-100 sm:h-[3.25rem] sm:w-[5.125rem]" style={{ containerType: 'inline-size' }}>
                                    <img
                                        src={sceneHintPreview?.image}
                                        alt=""
                                        aria-hidden="true"
                                        className="absolute inset-0 h-full w-full object-cover object-center"
                                    />
                                    {uploadedImage && (
                                        <span
                                            data-testid="hint-frame-preview"
                                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[1px] shadow-[1px_2px_4px_rgba(0,0,0,0.4)]"
                                            style={{
                                                left: `${sceneHintPreview?.hang?.x ?? 50}%`,
                                                top: `min(${sceneHintPreview?.hang?.y ?? 50}%, calc(60% - ${hintFrameHalfHeightCqw}cqw))`,
                                                width: `${hintFrameWidthPct}%`,
                                                aspectRatio: `${outerFrameWidthCm} / ${outerFrameHeightCm}`,
                                                backgroundColor: selectedFrame?.baseColor || '#24211f'
                                            }}
                                        >
                                            <span className="absolute inset-[1px]" style={{ backgroundColor: matWidth !== 'none' ? (matColor?.hex || '#fff') : '#fff' }}>
                                                <span className="absolute inset-[2px] bg-cover bg-center" style={{ backgroundImage: `url(${uploadedImage})` }} />
                                            </span>
                                        </span>
                                    )}
                                </span>
                                <span className="min-w-0 flex-1 py-0.5">
                                    <span className="block font-serif font-light tracking-tight text-[13.5px] leading-4 text-stone-900 sm:text-[14.5px]">
                                        See your frame in context
                                    </span>
                                    <span className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold tracking-tight text-stone-700 transition-colors hover:text-stone-950">
                                        Try a room scene
                                        <span aria-hidden="true" className="text-sm leading-none">→</span>
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={dismissSceneHint}
                                aria-label="Dismiss hint"
                                className="self-start p-1 text-stone-400 hover:text-stone-700 rounded-full transition-colors"
                            >
                                <X size={13} />
                            </button>
                        </aside>
                    ) : (
                        <SceneDotThumb
                            activeId={roomSceneId}
                            onSelect={selectRoomScene}
                            framePreview={activeRoom && uploadedImage ? {
                                leftPct: 50,
                                topPct: 42,
                                widthPct: 14,
                                aspectRatio: `${outerFrameWidthCm} / ${outerFrameHeightCm}`,
                                frameColor: selectedFrame?.baseColor || '#24211f',
                            } : null}
                        />
                    )
                ) : (
                    <div aria-hidden="true" />
                )}

                {/* Empty flexible middle column — keeps the wall-colour pill
                    in the grid's third (auto-width) track, right-aligned,
                    exactly as it was when this column held the old inline
                    scene-picker row. */}
                <div aria-hidden="true" />

                {/* BACKDROP CONTROLS — wall colour, and the scene beneath it.
                    Both change what's behind the piece, so they stack in one
                    corner instead of bracketing the row.

                    That stacking is the point: as a strip across the middle the
                    scene picker made the toolbar 49px tall, whose bottom edge
                    landed 5px INSIDE the frame zone. Collapsed to a pill it's
                    36px and clears the zone, and more usefully the whole centre
                    of the top is empty — which is the band a tall portrait
                    render grows into. */}
                <div className="shrink-0 flex items-start">

                {/* Wall Colour. `relative` anchors its popover. Hover-props
                    open/close it on PC the same way ScenePicker's own pill
                    does; click still toggles for touch/keyboard. z-50 while
                    open beats every other pill/chrome element (same pattern
                    as ScenePicker) so the popover always draws over whatever
                    it collides with, not just the scene pill it happens to
                    sit near; z-20 at rest otherwise. */}
                <div ref={wallPickerContainerRef} className={`relative ${isWallPickerOpen ? 'z-50' : 'z-20'}`} {...wallPickerHoverProps}>
                    <button
                        onClick={() => setIsWallPickerOpen(!isWallPickerOpen)}
                        className="flex h-[30px] items-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all bg-white/95 backdrop-blur text-stone-700 font-bold text-xs ml-auto"
                        title="Change Wall Color"
                    >
                        <div className="w-4 h-4 rounded-full border border-stone-200 shrink-0" style={{ backgroundColor: wallColor.hex, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }} />
                        <span className="hidden sm:inline">wall color</span>
                        <ChevronDown size={14} className={`transition-transform text-stone-400 ${isWallPickerOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* The Expanded Picker */}
                    <div
                        className={`absolute top-full right-0 mt-[3px] bg-white/95 backdrop-blur shadow-xl border border-stone-100 rounded-xl p-2.5 w-[90px] origin-top-right transition-all duration-300 ease-out flex flex-col items-center ${
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
                                    onClick={() => { setWallColor(color); closeWallPickerOnSelect(); }}
                                    title={color.name}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform ${wallColor.id === color.id ? 'border-stone-900 scale-110 shadow-sm' : 'border-stone-200 hover:scale-110'}`}
                                    style={{ backgroundColor: color.hex, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}
                                />
                            ))}
                        </div>

                        {/* The scene list used to be nested in here, under the
                            wall swatches. It's its own pill below this one now:
                            burying the biggest change you can make to the
                            preview inside a popover labelled "wall colour" made
                            it two clicks deep and invisible. */}
                    </div>
                </div>

                </div>

                </div>

                {/* Navigation stays anchored to the pane throughout scene changes. */}
                <SceneArrowCarousel
                    activeId={roomSceneId}
                    onSelect={selectRoomScene}
                    hidden={(isHovered && activeRoom) || isFullScreen || isMaxZoom || isZoomSettling}
                    motionClass={CHROME_MOTION}
                    // Mobile visualizer panes are stacked below the header;
                    // 22% places the arrows near their visual centre while
                    // keeping one fixed viewport anchor across every scene.
                    topPx={windowSize.height * (isSideBySide ? 0.4 : 0.22)}
                />

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
                <div className="relative h-full w-full flex items-center justify-center">
                    
                    {/* ── FRAME POSITIONING ZONE ──
                        The reserved top inset has gone from 48/56px (the full
                        toolbar height, reserved full-width regardless of frame
                        size) down to a 40px gutter, same at every breakpoint.
                        The toolbar is two pills pinned to the corners now
                        (dimensions left, wall colour + scene stacked right),
                        not a full-width bar, so the top-centre above a
                        centred frame doesn't need a band reserved for it —
                        this is a visual gutter plus real collision margin,
                        not a collision margin sized to the toolbar's own
                        height.

                        Was 12px until the room scenes' floor strips got
                        trimmed to a bare 2cm (see StudioLoftScene's FLOOR_Y
                        comment): every scene's hang.y rose to hold the same
                        real-world gallery height against the new floor line,
                        which — for a room scene specifically — moves the
                        frame's absolute page position 1:1 with the zone's own
                        top inset (unlike plain-wall/sofa mode, which is pure
                        flex-centring and only moves at roughly half that
                        rate). Higher hang points plus that 1:1 coupling
                        pushed a wide 120×120 piece on the narrowest walls
                        (Entryway, Home Office) into the dimensions pill at
                        375px, up to 17px deep. A full 2D collision sweep
                        (bounding-box overlap on both axes, not just vertical
                        proximity — which false-positives against the stacked
                        right pills, since same-Y doesn't mean same-X) across
                        every scene, the largest offered sizes, and every
                        breakpoint from 375–1280px found 40px clears both with
                        room to spare and re-passes everywhere else. Re-run
                        the sweep before lowering this again — it's now tied
                        to the room scenes' own geometry, not just the
                        toolbar, so it can silently go stale from either side
                        changing.

                        The bottom edge is untouched (still 65% of the pane),
                        so this adds height only at the top. For plain-wall/
                        sofa mode the frame is flex-centred in this zone, so a
                        taller zone still pulls that centre point up with it.
                        zoneTopOffsetPx below (search it) and visualizerMetrics'
                        ZONE_TOP_PX must both stay at 40. */}
                    <div
                        ref={zoneRef}
                        className={`absolute left-0 w-full flex flex-col items-center transition-all ${ZOOM_MOTION} ${
                            // Room scenes now anchor the frame via an explicit
                            // top-of-zone pixel distance (roomSceneVerticalOffsetPx
                            // below) instead of a margin-top delta from an assumed
                            // flex-centred point. That assumption broke — silently
                            // and by a non-obvious amount — the moment the zone's
                            // own height stopped tracking the scene's rendered
                            // height (exactly what 'inset-0 h-full' below does:
                            // the zone can now be taller than the scene it holds).
                            // flex-start makes the frame's natural (margin-top: 0)
                            // position flush with the zone's top, so the offset is
                            // a direct, unambiguous distance rather than a
                            // cancellation of a centring point that has to be
                            // predicted correctly to work at all.
                            activeRoom && !isHovered && !isMaxZoom && !isFullScreen ? 'justify-start' : 'justify-center'
                        } ${
                            isFullScreen
                                // In full-screen mobile the note is a real footer below
                                // this zone, not an overlay on top of the rendering.
                                ? 'top-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] h-auto sm:bottom-0 sm:h-full'
                                // Every visualizer mode shares the complete port. The
                                // controls float above this canvas, rather than reserving
                                // a smaller frame-only zone beneath them.
                                : 'inset-0 h-full'
                        }`}
                        onTouchStart={handleMobileTouchStart}
                        onTouchMove={handleMobileTouchMove}
                        onTouchEnd={handleMobileGestureEnd}
                    >

                        {roomCannotFit && (
                            <div role="status" className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20 w-[min(18rem,80%)] rounded-xl bg-white/95 p-4 text-center text-xs text-stone-700 shadow-sm">
                                <p>This frame exceeds the visible wall space above the furniture. Try another room or orientation.</p>
                                <button type="button" onClick={() => selectRoomScene(null)} className="mt-2 font-semibold underline underline-offset-4">View Close-Up</button>
                            </div>
                        )}

                        {/* ── ROOM SCENE BACKDROP ──
                            Every scene fills the same calibrated visualizer canvas, so
                            the image can change without changing frame geometry. */}
                        {[
                            departingRoom
                                ? renderRoomBackdrop(departingRoom, departingRoomLayout, 'outgoing')
                                : departingWasCloseUp ? renderPlainBackdrop('outgoing') : null,
                            activeRoom
                                ? renderRoomBackdrop(activeRoom, roomLayout, isTransitioning ? 'incoming' : '')
                                : isTransitioning ? renderPlainBackdrop('incoming') : null,
                        ]}

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
                            // Both branches are the same conversion — physical cm to a
                            // percentage of this zone's width — differing only in what the
                            // zone represents. Against the sofa cue, the zone is scaled so
                            // 160cm spans SOFA_BODY_PCT of it; in a room scene, the zone
                            // width IS the room's wall span (the backdrop below is sized to
                            // exactly fill it), so the conversion is a direct ratio.
                            // (roomPlacement is computed once at component scope so the
                            // backdrop's offset and this share one hang height.)
                            const roomSceneScale = roomLayout?.scale || 0;
                            const pixelsPerCm = activeRoom
                                ? roomSceneScale
                                : (zoneSize.width * (SOFA_BODY_PCT / 100)) / SOFA_CM;
                            const frameWidthPct = roomPlacement
                                ? ((outerFrameWidthCm * pixelsPerCm) / zoneSize.width) * 100
                                : (outerFrameWidthCm / SOFA_CM) * SOFA_BODY_PCT;
                            
                            const renderedFrameWidthPx = Math.max(1, (frameWidthPct / 100) * zoneSize.width);
                            const renderedFrameHeightPx = Math.max(1, renderedFrameWidthPx * (outerFrameHeightCm / outerFrameWidthCm));
                            // Start from the physical face width at the scene scale.
                            // Close-Up applies a bounded screen-size adjustment below
                            // because different physical sizes are fitted into one pane.
                            let projectedRailPx = railWidthCm * pixelsPerCm;
                            let mouldingPctW = (projectedRailPx / renderedFrameWidthPx) * 100;
                            let mouldingPctH = (projectedRailPx / renderedFrameHeightPx) * 100;
                            // Canvas thickness is the depth into the wall; it is
                            // not the visible front face width of the frame.
                            
                            // Mat inset as % of frame width/height.
                            // Clamp the max inset so we don't mathematically collapse the artwork to 0 or negative.
                            // The shared mat reveal keeps all four edges equal.
                            // Mat values are calculated after preview-specific
                            // moulding adjustments below.

                            // Canvas Print mount styles (glassType 'canvas'): Floater reveals a
                            // small gap between the canvas edge and the frame's inner wall;
                            // Traditional lets the frame's inner lip overlap and hide the canvas
                            // edge. Both a fixed physical inch amount converted to %, same
                            // derivation as matPct above, so they scale sensibly across sizes.
                            // Canvas mount values are calculated after preview-
                            // specific moulding adjustments below.

                            // With the plain-wall reference artefact gone, there's nothing
                            // left in that mode to show the frame at physical scale
                            // against — the pane is the frame's alone, so the size that
                            // used to need a hover/double-tap to reveal is now just how a
                            // plain-wall render looks. Room scenes keep the original
                            // hover-to-reveal behaviour: their backdrop furniture is the
                            // scale reference, and it only fades out once a zoom is
                            // actively requested (see the ROOM SCENE BACKDROP's own fade
                            // condition above) — showing the frame pre-zoomed by default
                            // there would claim a scale against furniture it doesn't match.
                            const isZoomedByDefault = !activeRoom;

                            // ─── DYNAMIC ZOOM CLAMPING (Never Overlap/Cutoff) ───
                            const zoomScale = (() => {
                                // isMaxZoom alone (without isHovered) is how touch double-tap
                                // drives this — touch devices never fire mouseenter, so gating
                                // purely on isHovered left double-tap zoom permanently inert on
                                // mobile/tablet. Full screen always computes a scale (the
                                // "enhanced" standalone view) regardless of hover/tap state —
                                // there's no sofa/dashboard to preserve physical scale against
                                // once those are hidden, so it's always shown as large as
                                // possible instead of requiring a hover to reveal that. Plain
                                // wall now joins that list per isZoomedByDefault above.
                                if (!isHovered && !isMaxZoom && !isFullScreen && !isZoomedByDefault) return 1.0;

                                // Calculate unzoomed dimensions in pixels relative to the physical container
                                const baseWidthPx = (frameWidthPct / 100) * zoneSize.width;
                                const baseHeightPx = baseWidthPx * (outerFrameHeightCm / outerFrameWidthCm);

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
                            // Room-scene hover used to fall in here too, sizing the
                            // frame off the same catalogue-anchor curve as Close-Up
                            // — a room's own hover-zoom was really just borrowing
                            // Close-Up's look rather than being its own thing. Now
                            // it's excluded: a room scene's hover-zoom instead falls
                            // through to displayedFrameWidthPct below, which scales
                            // up from frameWidthPct — THIS room's own physical-wall
                            // calibration — so each room zooms into a close-up of
                            // its own frame at its own true proportions, not a
                            // generic shared size.
                            const isSharedPreviewView = (
                                (!activeRoom && !isMaxZoom && !isFullScreen) ||
                                isFullScreen
                            );
                            // ─── ANCHORED SIZE CURVE (shared-preview views only) ───
                            // Replaces the old stack of three separate patches (a
                            // medium-format compression bump, a large-format
                            // plateau, and a 100×150-only boost) — each was tuned
                            // in isolation and their overlapping ranges produced
                            // real inversions (a 40×40 rendering smaller than a
                            // 30×30). This is one formula instead: the smallest
                            // (13×18) and largest (100×150) catalogue sizes are
                            // fixed anchors, rendered at their own true physical
                            // scale with nothing added or subtracted, and every
                            // size in between is placed by linearly interpolating
                            // between those two anchors' rendered widths according
                            // to its own position (by inner area) in that range —
                            // so it grows or shrinks strictly in step with the
                            // rest of the catalogue, never out of order.
                            const referenceMinAreaCm2 = 13 * 18;
                            const referenceMaxAreaCm2 = 100 * 150;
                            const currentInnerAreaCm2 = Math.max(1, innerWidthCm * innerHeightCm);
                            const sizeRangeProgress = Math.max(
                                0,
                                Math.min(1, (currentInnerAreaCm2 - referenceMinAreaCm2) / (referenceMaxAreaCm2 - referenceMinAreaCm2))
                            );
                            // Each anchor's target is its OWN fully-resolved
                            // final size — raw physical scale AND the same
                            // safe-zoom-bounds treatment every size gets via
                            // zoomScale above — not just a raw percentage.
                            // Interpolating those two already-final numbers
                            // (rather than interpolating a raw percentage and
                            // multiplying by a zoomScale computed for a
                            // DIFFERENT, unrelated size) is what keeps this
                            // monotonic: composing a width-based zoomScale
                            // with an area-based percentage was tried first
                            // and reintroduced the exact 40×40-smaller-than-
                            // 30×30 inversion this rework exists to fix,
                            // because the two don't scale together. A straight
                            // linear blend between two fixed, already-correct
                            // endpoints can't produce a value outside their
                            // range, so no separate safety-cap is needed here
                            // either — both endpoints already respect it.
                            const pctForOuterWidthCm = (outerWCm) => (roomPlacement
                                ? ((outerWCm * pixelsPerCm) / zoneSize.width) * 100
                                : (outerWCm / SOFA_CM) * SOFA_BODY_PCT);
                            const finalDisplayedPctFor = (outerWCm, outerHCm) => {
                                const rawPct = pctForOuterWidthCm(outerWCm);
                                const baseWPx = (rawPct / 100) * zoneSize.width;
                                const baseHPx = baseWPx * (outerHCm / outerWCm);
                                const maxZoomWPx = zoneSize.width * 0.85;
                                const maxZoomHPx = isFullScreen ? Math.max(80, zoneSize.height * 0.90) : zoneSize.height * 0.90;
                                const maxScale = Math.min(maxZoomWPx / Math.max(baseWPx, 1), maxZoomHPx / Math.max(baseHPx, 1));
                                const isPosterPrint = isAlbumPoster || isMoviePosterPrint;
                                const scale = Math.max(1.0, Math.min(isPosterPrint ? 16.0 : 8.0, maxScale));
                                return rawPct * scale;
                            };
                            // Anchor roles are FIXED (13/100 always the short
                            // side, 18/150 always the long side) rather than
                            // flipping with the current orientation. Flipping
                            // them — matching how wInch/hInch derive their
                            // width/height roles — seemed consistent at first,
                            // but it re-calibrates the anchors' own scale
                            // per orientation (18cm-as-width produces a bigger
                            // raw percentage than 13cm-as-width), which bled
                            // into every size's interpolated target. Confirmed
                            // by measurement: a 30×30 square — physically
                            // identical either way — rendered at 374px
                            // portrait vs 469px landscape. Fixed roles make
                            // the curve itself orientation-independent; the
                            // orientation swap happens once, at the very end,
                            // by swapping the two resolved px values (see
                            // canonicalWidthPx/canonicalHeightPx below) —
                            // which is just "render this shape, then rotate
                            // it 90° for landscape," so a square is trivially
                            // unaffected and every other size's landscape
                            // render is an exact rotation of its portrait one.
                            const anchorMinDisplayedPct = finalDisplayedPctFor(13 + (railWidthCm * 2), 18 + (railWidthCm * 2));
                            const anchorMaxDisplayedPct = finalDisplayedPctFor(100 + (railWidthCm * 2), 150 + (railWidthCm * 2));
                            const anchoredDisplayedPct = anchorMinDisplayedPct + (anchorMaxDisplayedPct - anchorMinDisplayedPct) * sizeRangeProgress;
                            // The 100×150/150×100 selection gets its own
                            // explicit height target (680px, in portrait
                            // terms — i.e. the LONG side) rather than riding
                            // the anchor curve's own natural value. Computed
                            // from the frame's true short/long cm (not
                            // orientation-labelled outer width/height) so it
                            // composes correctly with the rotation swap below
                            // regardless of which orientation is selected.
                            // Scoped to only fire when 100×150/150×100 is
                            // actually selected; anchorMaxDisplayedPct itself —
                            // what every in-between size interpolates toward —
                            // is unaffected, so 120×120, 90×120, etc. don't move.
                            const isExactly100By150 = (
                                Math.abs(Math.max(innerWidthCm, innerHeightCm) - 150) <= 3 &&
                                Math.abs(Math.min(innerWidthCm, innerHeightCm) - 100) <= 3
                            );
                            const portraitOuterShortCm = Math.min(innerWidthCm, innerHeightCm) + (railWidthCm * 2);
                            const portraitOuterLongCm = Math.max(innerWidthCm, innerHeightCm) + (railWidthCm * 2);
                            const portraitLongOverShort = portraitOuterLongCm / portraitOuterShortCm;
                            // canonicalWidthPx/canonicalHeightPx are always
                            // computed in portrait terms (short side = width,
                            // long side = height), then swapped for landscape
                            // as the very last step — the rotation described
                            // above. CSS only ever derives ONE side from the
                            // other (via the fixed aspect-ratio style), so to
                            // land the long side on an exact target the SHORT
                            // side has to be recomputed from that target, not
                            // adjusted independently after the fact — doing it
                            // as an additive nudge on the long side alone (an
                            // earlier version of this) left portrait's CSS-
                            // derived height still coming from the ORIGINAL,
                            // un-nudged width, so the target only actually
                            // landed for whichever orientation happened to
                            // read it directly off canonicalWidthPx.
                            const canonicalWidthPx = (() => {
                                if (!isSharedPreviewView || !isExactly100By150) return (anchoredDisplayedPct / 100) * zoneSize.width;
                                const LARGEST_SIZE_TARGET_LONG_SIDE_PX = 680;
                                return LARGEST_SIZE_TARGET_LONG_SIDE_PX / portraitLongOverShort;
                            })();
                            const canonicalHeightPx = canonicalWidthPx * portraitLongOverShort;
                            // The safety-zoom bounds above were only ever
                            // checked against the two anchors' OWN shapes
                            // (13×18 and 100×150, both a tame ~1.4:1 ratio).
                            // A theoretical/custom size in between can have
                            // a far more extreme aspect ratio than either
                            // anchor — e.g. a 13×150cm custom entry is an
                            // 11.5:1 ratio — and nothing upstream constrains
                            // that, so the derived long side can blow straight
                            // through the pane (confirmed: a 13×150 rendered
                            // ~2985px tall against an ~806px pane). A single
                            // uniform scale-down — never non-uniform, which
                            // would distort the frame's real proportions —
                            // keeps every theoretical size inside the same
                            // safe bounds every catalogue size already
                            // respects. No-op for sizes already inside them.
                            const preClampWidthPx = orientation === 'portrait' ? canonicalWidthPx : canonicalHeightPx;
                            const preClampHeightPx = orientation === 'portrait' ? canonicalHeightPx : canonicalWidthPx;
                            const canonicalMaxSafeWidthPx = zoneSize.width * 0.85;
                            const canonicalMaxSafeHeightPx = isFullScreen ? Math.max(80, zoneSize.height * 0.90) : zoneSize.height * 0.90;
                            // The two safe-bounds axes aren't symmetric (85% of
                            // width vs 90% of height), so a shape and its own
                            // 90°-rotated twin can land on different caps —
                            // whichever orientation happens to put its long
                            // side against the tighter (width) axis gets
                            // clamped harder than the other. That broke the
                            // exact-rotation guarantee above for any size
                            // large enough to actually reach these bounds,
                            // which the largest catalogue size (100x150 /
                            // 150x100) always is: confirmed a 100x150 portrait
                            // rendering ~3% bigger than 150x100 landscape at
                            // the same viewport, not the identical size a
                            // rotation should produce. Checking BOTH axis
                            // assignments — current orientation's and its
                            // rotated twin's — and taking the tighter makes
                            // the scale a function of the shape alone, so
                            // orientation can no longer change it.
                            const canonicalSafetyScale = Math.min(
                                1,
                                canonicalMaxSafeWidthPx / Math.max(preClampWidthPx, 1),
                                canonicalMaxSafeHeightPx / Math.max(preClampHeightPx, 1),
                                canonicalMaxSafeWidthPx / Math.max(preClampHeightPx, 1),
                                canonicalMaxSafeHeightPx / Math.max(preClampWidthPx, 1)
                            );
                            const anchoredFinalWidthPx = preClampWidthPx * canonicalSafetyScale;
                            // Only ordinary Close-Up participates in this experiment.
                            // Retain the existing targets for fullscreen and extra zoom.
                            const closeUpSize = ENABLE_CLOSE_UP_SIZE_PROGRESSION && !activeRoom && !isFullScreen && !isMaxZoom
                                ? getCloseUpSize({
                                    widthCm: innerWidthCm, heightCm: innerHeightCm,
                                    outerWidthCm: outerFrameWidthCm, outerHeightCm: outerFrameHeightCm,
                                    viewportWidth: zoneSize.width, viewportHeight: zoneSize.height,
                                })
                                : null;
                            const displayedFrameWidthPct = isHovered || isMaxZoom || isFullScreen || isZoomedByDefault
                                ? frameWidthPct * zoomScale
                                : frameWidthPct;
                            // isMaxZoom is excluded from isSharedPreviewView by
                            // design (see above), so this never fights double-
                            // tap's own deliberately-past-the-safe-bounds zoom.
                            const adjustedDisplayedFrameWidthPct = Math.max(
                                1,
                                isSharedPreviewView
                                    ? ((closeUpSize?.width ?? anchoredFinalWidthPx) / Math.max(zoneSize.width, 1)) * 100
                                    : displayedFrameWidthPct
                            );
                            // Room-scene hover keeps this even though it's no
                            // longer part of isSharedPreviewView above — this is
                            // what keeps the RAIL'S thickness looking consistent
                            // across every reveal-zoom state. Without it, the
                            // rail scaled directly off the room's own (very
                            // different, wall-to-wall) pixelsPerCm instead of a
                            // fixed reference, so it jumped to a visibly
                            // different proportion the instant hover engaged —
                            // the frame's overall size is room-specific now, but
                            // its moulding shouldn't visibly lurch on top of that.
                            const shouldUseSixtyBySixtyMouldingReference = (
                                isSharedPreviewView || (isHovered && activeRoom && !isMaxZoom && !isFullScreen)
                            );
                            if (shouldUseSixtyBySixtyMouldingReference) {
                                const SIXTY_CM_INNER = 60;
                                const referenceOuterWidthCm = SIXTY_CM_INNER + (railWidthCm * 2);
                                const referenceFrameWidthPct = (referenceOuterWidthCm / SOFA_CM) * SOFA_BODY_PCT;
                                const referenceBaseWidthPx = (referenceFrameWidthPct / 100) * zoneSize.width;
                                const referenceMaxWidthPx = zoneSize.width * 0.85;
                                const referenceMaxHeightPx = zoneSize.height * 0.90;
                                const safeReferenceWidthPx = referenceBaseWidthPx > 0 ? referenceBaseWidthPx : 1;
                                const referenceScale = Math.max(
                                    1.0,
                                    Math.min(8.0, referenceMaxWidthPx / safeReferenceWidthPx, referenceMaxHeightPx / safeReferenceWidthPx)
                                );
                                const referenceRailPx = (railWidthCm / referenceOuterWidthCm) * referenceBaseWidthPx * referenceScale;
                                const finalFrameWidthPx = Math.max(1, (adjustedDisplayedFrameWidthPct / 100) * zoneSize.width);
                                const displayScale = finalFrameWidthPx / renderedFrameWidthPx;
                                projectedRailPx = referenceRailPx / Math.max(displayScale, 0.01);
                                mouldingPctW = (projectedRailPx / renderedFrameWidthPx) * 100;
                                mouldingPctH = (projectedRailPx / renderedFrameHeightPx) * 100;
                            }

                            // Mat insets start from the physical mat-to-frame ratio.
                            // "No Mat" yields zero on every edge; the clamp below
                            // preserves a visible artwork opening for every frame size.
                            if (fitEnabled) {
                                mouldingPctW = railWidthIn / fitGeometry.outerWidth * 100;
                                mouldingPctH = railWidthIn / fitGeometry.outerHeight * 100;
                            }
                            if (selectedFrame?.prodigiProduct) {
                                const displayedWidthPx = (adjustedDisplayedFrameWidthPct / 100) * zoneSize.width;
                                const displayedHeightPx = displayedWidthPx * (outerFrameHeightCm / outerFrameWidthCm);
                                const physicalRailPx = displayedWidthPx * railWidthCm / outerFrameWidthCm;
                                // Close-Up fits many physical sizes into the same viewport. Keep
                                // each family's face recognisable there; room scenes retain their
                                // true wall-relative scale, and 3D/AR geometry is unchanged.
                                const previewRailPx = isSharedPreviewView && railWidthCm > 0
                                    ? Math.min(railWidthCm * 10, Math.max(railWidthCm * 6, physicalRailPx))
                                    : physicalRailPx;
                                const safeRailPx = Math.min(previewRailPx, Math.min(displayedWidthPx, displayedHeightPx) * 0.18);
                                mouldingPctW = safeRailPx / displayedWidthPx * 100;
                                mouldingPctH = safeRailPx / displayedHeightPx * 100;
                            }
                            // Mat insets are derived from the true physical mat-to-frame ratio,
                            // ensuring exact physical scale alignment across Plain View (Close-Up),
                            // calibrated Room Scenes, 3D AR models, and thumbnail captures.
                            const outerWidthIn = selectedFrame?.prodigiProduct
                                ? (outerFrameWidthCm / 2.54)
                                : (fitGeometry ? fitGeometry.outerWidth : (wInch + 2 * railWidthIn));
                            const outerHeightIn = selectedFrame?.prodigiProduct
                                ? (outerFrameHeightCm / 2.54)
                                : (fitGeometry ? fitGeometry.outerHeight : (hInch + 2 * railWidthIn));

                            const rawMatPctW = (matReveal.sideIn / outerWidthIn) * 100;
                            const rawMatPctTop = (matReveal.topIn / outerHeightIn) * 100;
                            const rawMatPctBottom = (matReveal.bottomIn / outerHeightIn) * 100;
                            const matPctW = Math.max(0, Math.min(rawMatPctW, MAT_RENDER_MAX_PCT - mouldingPctW));
                            const matPctTop = Math.max(0, Math.min(rawMatPctTop, MAT_RENDER_MAX_PCT - mouldingPctH));
                            const matPctBottom = Math.max(0, Math.min(rawMatPctBottom, MAT_RENDER_MAX_PCT - mouldingPctH));

                            // Canvas Print mount styles (glassType 'canvas'): Floater reveals a
                            // small gap between the canvas edge and the frame's inner wall;
                            // Traditional lets the frame's inner lip overlap and hide the canvas
                            // edge. Both a fixed physical inch amount converted to %, same
                            // derivation as matPct above, so they scale sensibly across sizes.
                            const supplierGapIn = (selectedFrame?.canvasGapMm || 6.35) / 25.4;
                            const floaterGapPctW = (supplierGapIn / (outerFrameWidthCm / 2.54)) * 100;
                            const floaterGapPctH = (supplierGapIn / (outerFrameHeightCm / 2.54)) * 100;
                            const traditionalOverlapPctW = Math.min(0.375 / (wInch + 2 * railWidthIn) * 100, mouldingPctW);
                            const traditionalOverlapPctH = Math.min(0.375 / (hInch + 2 * railWidthIn) * 100, mouldingPctH);

                            // Calculate push down amount so the top of the frame isn't hidden behind the header in max zoom
                            const pushDownAmount = (() => {
                                if (!isMaxZoom) return 0;
                                const baseWidthPx = (frameWidthPct / 100) * zoneSize.width;
                                const baseHeightPx = baseWidthPx * (outerFrameHeightCm / outerFrameWidthCm);
                                const targetHeight = baseHeightPx * zoomScale;
                                const overflowTop = (targetHeight - zoneSize.height) / 2;
                                return overflowTop > 0 ? (overflowTop * 2) + 40 : 0;
                            })();

                            // Plain wall/sofa mode is still pure flex-centring and
                            // stays exactly as-is. A room scene anchors its backdrop
                            // to the zone's own top (see the scene backdrop's own
                            // sceneTop) and — since the zone above now also sets
                            // justify-start for this case — the frame's natural
                            // (margin-top: 0) position is flush with that same top,
                            // not an assumed centre point. So this is a direct
                            // top-of-zone distance to the hang point's pixel
                            // position, minus half the frame's own height to land
                            // its CENTRE (not its top) on the hang point — no
                            // flex-centring math to predict or cancel out. Reuses
                            // the same marginTop channel pushDownAmount already
                            // uses; they never fight over it — the room backdrop
                            // fades out during hover/max-zoom/full screen (same
                            // condition gates this to 0 then), which is the only
                            // time pushDownAmount is ever nonzero.
                            const roomSceneVerticalOffsetPx = (() => {
                                if (!roomLayout || !roomPlacement || isHovered || isMaxZoom || isFullScreen) return 0;
                                const visualTop = computeReferenceAnchoredTop(
                                    activeRoom,
                                    roomLayout,
                                    renderedFrameHeightPx,
                                    selectedSize?.id,
                                    orientation,
                                    outerFrameHeightCm
                                );
                                return visualTop;
                            })();

                            const roomSceneHorizontalOffsetPx = (() => {
                                if (!roomLayout || !roomPlacement || isHovered || isMaxZoom || isFullScreen) return 0;
                                // The scene itself fills the visualizer even when a short
                                // viewport caps the artwork's cm-to-pixel scale. Position
                                // against that full wall, not the capped scale.
                                const hangX = roomPlacement.leftPct / 100 * zoneSize.width;
                                return roomLayout.left + hangX - zoneSize.width / 2;
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
                            const baseFrameWidthPx = (adjustedDisplayedFrameWidthPct / 100) * zoneSize.width;

                            // On-screen preview only — never affects what's stored on the
                            // cart item or sent to print. Inspiration/catalogue selections set
                            // uploadedImage to a full-resolution Cloudinary asset (needed later
                            // for the actual print), which is overkill for a live preview and
                            // was the main cause of the visualizer taking forever to load an
                            // inspiration pick. getThumbnailUrl no-ops for blob:/data:/non-
                            // Cloudinary URLs, so user uploads and external sources render
                            // exactly as before.
                            // The starter image is a crop, not customer content. Match
                            // that crop to the selected frame orientation; real uploads
                            // and catalogue/preset images always keep their original file.
                            const visualizerImage = isPlaceholder
                                ? getDemoImageForOrientation(isSquareFrame ? 'square' : orientation)
                                : uploadedImage;
                            // A flat width cap (1400, then 2400) was either too soft for a
                            // heavily zoomed room scene or wasteful for a small honest-scale
                            // one — Studio Loft's wide 420cm wall gives the hover/zoom formula
                            // more room to zoom in than a tighter wall does, so the same cap
                            // that's plenty for one scene falls short for another. Sizing the
                            // request from baseFrameWidthPx (the frame's actual on-screen CSS
                            // width, already computed above) times devicePixelRatio fetches
                            // exactly what THIS render needs on THIS screen, whichever scene or
                            // zoom state produced it. Quantized to steps of 200px so dragging,
                            // resizing, or a fractional zoom scale doesn't mint a fresh
                            // Cloudinary transform (and cache miss) for every pixel; clamped to
                            // [400, 4000] so a tiny preview still gets a usable minimum and a
                            // fullscreen 3x-DPR render can't demand a print-resolution fetch.
                            const targetImageWidthPx = Math.min(4000, Math.max(400,
                                Math.ceil((baseFrameWidthPx * (window.devicePixelRatio || 1)) / 200) * 200
                            ));
                            targetImageWidthRef.current = targetImageWidthPx;
                            const displayImage = getThumbnailUrl(visualizerImage, committedImageWidthPx);
                            // Artwork fills its opening edge-to-edge. object-cover only
                            // changes the preview crop; the uploaded source is untouched.
                            // Keep measurement guides in one predictable place across
                            // Close-Up and room scenes: width below, height on the right.
                            const dimHorizontalClass = isHovered || isZoomedByDefault ? 'top-full mt-6' : 'top-full mt-4';
                            const dimVerticalClass = isHovered || isZoomedByDefault ? '-right-6' : '-right-4';
                            const dimFontSizePx = isHovered || isZoomedByDefault ? 14 : Math.max(8, Math.min(10, baseFrameWidthPx / 12));

                            return (
                                <div
                                    onMouseEnter={(event) => {
                                        // Debounced rather than immediate: a room scene's
                                        // zoomed frame is a much bigger, repositioned box
                                        // than its resting one, so the instant it commits,
                                        // the cursor can find itself just outside the new
                                        // geometry — which fires mouseleave, shrinks it
                                        // back, puts the cursor back inside the (now
                                        // resting) frame, and re-fires mouseenter. Requiring
                                        // the pointer to sit still on the frame for a beat
                                        // before committing to "hovered" breaks that loop;
                                        // leaving still exits immediately below, so this
                                        // only adds a beat of hover-intent, not lag on exit.
                                        window.clearTimeout(hoverEnterTimeoutRef.current);
                                        if (activeRoom) {
                                            const { left, top, right, bottom } = event.currentTarget.getBoundingClientRect();
                                            // A small cushion includes antialiased frame edges but
                                            // does not expand the effective target into the wall.
                                            hoverHitBoundsRef.current = { left: left - 6, top: top - 6, right: right + 6, bottom: bottom + 6 };
                                        }
                                        hoverEnterTimeoutRef.current = window.setTimeout(() => {
                                            setIsHovered(true);
                                        }, 80);
                                    }}
                                    onMouseLeave={(event) => {
                                        // Reverse the enter transition immediately. The same
                                        // ZOOM_MOTION duration/easing then carries the frame,
                                        // scene, and chrome back to their resting geometry, so
                                        // moving away is the exact visual inverse of moving in.
                                        const bounds = hoverHitBoundsRef.current;
                                        const remainsInsideStableTarget = activeRoom && bounds &&
                                            event.clientX >= bounds.left && event.clientX <= bounds.right &&
                                            event.clientY >= bounds.top && event.clientY <= bounds.bottom;
                                        if (remainsInsideStableTarget) return;
                                        window.clearTimeout(hoverEnterTimeoutRef.current);
                                        hoverHitBoundsRef.current = null;
                                        setIsHovered(false);
                                        setIsMaxZoom(false);
                                    }}
                                    onDoubleClick={() => {
                                        if (isHovered) setIsMaxZoom(!isMaxZoom);
                                    }}
                                    // The rendered piece itself. tests/e2e/visualizer-overlap.spec.js
                                    // asserts nothing in the pane covers this.
                                    data-testid="frame-render"
                                    ref={frameRenderRef}
                                    // Only the properties that actually change on
                                    // zoom. `transition-all` also animated every
                                    // inherited paint property on a subtree that
                                    // already relayouts each frame from the width
                                    // change — the one place here worth being
                                    // specific about.
                                    className={`relative select-none transition-[width,margin,transform,box-shadow] ${isTransitioning ? `scene-frame-transition ${ROOM_SCENE_MOTION}` : ZOOM_MOTION} ${
                                        isMaxZoom && !isFullScreen ? 'cursor-zoom-out' : isFullScreen ? '' : 'cursor-zoom-in'
                                    } ${
                                        isHovered || isMaxZoom || isFullScreen || isZoomedByDefault ? 'z-40' : 'z-10'
                                    }`}
                                    style={{
                                        width: `${adjustedDisplayedFrameWidthPct}%`,
                                        visibility: roomCannotFit ? 'hidden' : undefined,
                                        aspectRatio: `${outerFrameWidthCm} / ${outerFrameHeightCm}`,
                                        marginTop: `${pushDownAmount + roomSceneVerticalOffsetPx}px`,
                                        marginLeft: `${pushRightAmount}px`,
                                        boxShadow: getFrameWallShadow(
                                            renderedFrame || selectedFrame,
                                            isHovered || isMaxZoom || isFullScreen || isZoomedByDefault
                                        ),
                                        // -11px is a fixed horizontal nudge for the frame's own
                                        // drop shadow (shadow-[...25px_50px...] renders
                                        // asymmetrically, so the frame+shadow composite's visual
                                        // centre sits slightly right of its true box centre without
                                        // this). Used to carry a -35px vertical component too, to
                                        // lift the frame clear of the reference sofa that used to
                                        // render below it in plain-wall mode; now that the sofa's
                                        // gone the frame is simply flex-centred in the pane, so
                                        // that vertical lift is gone with it.
                                        // A contained room can be narrower than the port;
                                        // follow its calibrated hang point rather than the
                                        // port midpoint (notably in the entryway).
                                        transform: activeRoom
                                            ? `translateX(${roomSceneHorizontalOffsetPx}px)`
                                            : 'translate(1px, 4px)',
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
                                        by design — instead of hard-unmounting).
                                        Close-Up also shows the selected dimensions;
                                        the Dimensions panel toggle controls all views. */}
                                    {showDimensions && (
                                        <>
                                            <div style={{ fontSize: `${dimFontSizePx}px` }} className={`absolute ${dimHorizontalClass} left-0 w-full flex items-center justify-center ${wallInkClass} font-mono border-t ${wallInkBorderClass} ${wallInkBlend} opacity-80 transition-all ${ZOOM_MOTION} whitespace-nowrap overflow-visible pointer-events-none`}>
                                                <div className={`absolute left-0 -top-1.5 sm:-top-2 h-1.5 sm:h-2 w-px ${wallInkBgClass}`} />
                                                <div className={`absolute right-0 -top-1.5 sm:-top-2 h-1.5 sm:h-2 w-px ${wallInkBgClass}`} />
                                                <span className="absolute bottom-1">
                                                {(() => {
                                                    if (unit === 'in') {
                                                        const inVals = selectedSize?.prodigiSizeInches?.match(/\d+(?:\.\d+)?/g)?.map(v => Math.round(parseFloat(v)));
                                                        if (inVals && inVals.length >= 2) {
                                                            const val = orientation === 'landscape' ? Math.max(...inVals) : Math.min(...inVals);
                                                            return `${val} in`;
                                                        }
                                                        return `${Math.round(wInch || 0)} in`;
                                                    }
                                                    const cmVals = selectedSize?.prodigiSizeCm?.match(/\d+(?:\.\d+)?/g)?.map(v => Math.round(parseFloat(v)));
                                                    if (cmVals && cmVals.length >= 2) {
                                                        const val = orientation === 'landscape' ? Math.max(...cmVals) : Math.min(...cmVals);
                                                        return `${val} cm`;
                                                    }
                                                    return `${Math.round(innerWidthCm || 0)} cm`;
                                                })()}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: `${dimFontSizePx}px` }} className={`absolute ${dimVerticalClass} top-0 h-full flex flex-col items-center justify-center ${wallInkClass} font-mono border-r ${wallInkBorderClass} pr-1 ${wallInkBlend} opacity-80 transition-all ${ZOOM_MOTION} whitespace-nowrap overflow-visible pointer-events-none`}>
                                                <div className={`absolute right-0 top-0 w-1.5 sm:w-2 h-px ${wallInkBgClass}`} />
                                                <div className={`absolute right-0 bottom-0 w-1.5 sm:w-2 h-px ${wallInkBgClass}`} />
                                                <span style={{ writingMode: 'vertical-rl' }}>
                                                    {(() => {
                                                        if (unit === 'in') {
                                                            const inVals = selectedSize?.prodigiSizeInches?.match(/\d+(?:\.\d+)?/g)?.map(v => Math.round(parseFloat(v)));
                                                            if (inVals && inVals.length >= 2) {
                                                                const val = orientation === 'landscape' ? Math.min(...inVals) : Math.max(...inVals);
                                                                return `${val} in`;
                                                            }
                                                            return `${Math.round(hInch || 0)} in`;
                                                        }
                                                        const cmVals = selectedSize?.prodigiSizeCm?.match(/\d+(?:\.\d+)?/g)?.map(v => Math.round(parseFloat(v)));
                                                        if (cmVals && cmVals.length >= 2) {
                                                            const val = orientation === 'landscape' ? Math.min(...cmVals) : Math.max(...cmVals);
                                                            return `${val} cm`;
                                                        }
                                                        return `${Math.round(innerHeightCm || 0)} cm`;
                                                    })()}
                                                </span>
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
                                            {glassType === 'float-glass' && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-white/20 to-white/0 pointer-events-none mix-blend-screen z-40" />
                                            )}
                                            {glassType === 'museum' && (
                                                <div className="absolute inset-0 bg-stone-900/5 pointer-events-none mix-blend-multiply z-40" />
                                            )}
                                        </div>
                                    ) : (
                                        !isCanvasOnly ? (
                                            <>
                                                {/* Outer Frame Edge — 4 Mitered 3D Borders */}
                                                {selectedFrame?.borderImageSource && !getFrameRail(selectedFrame) ? (
                                                    <div 
                                                        className="absolute inset-0 transition-all duration-300 z-20 pointer-events-none"
                                                        style={{
                                                            borderStyle: "solid",
                                                            borderWidth: "1px",
                                                            borderColor: "transparent",
                                                            borderImageWidth: `${mouldingPctH}% ${mouldingPctW}%`,
                                                            borderImageSource: `url(${selectedFrame.borderImageSource})`,
                                                            borderImageSlice: `${selectedFrame.borderImageSlicePct ?? ((railWidthIn / (8 + 2 * railWidthIn)) * 100)}%`,
                                                            borderImageRepeat: "stretch"
                                                        }}
                                                    >
                                                        {/* Inner depth shadow */}
                                                        <div 
                                                            className="absolute pointer-events-none z-20"
                                                            style={{
                                                                top: `${mouldingPctH}%`,
                                                                bottom: `${mouldingPctH}%`,
                                                                left: `${mouldingPctW}%`,
                                                                right: `${mouldingPctW}%`,
                                                                boxShadow: getFrameInnerShadow(renderedFrame || selectedFrame)
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                <div className="absolute inset-0 transition-all duration-300">
                                                    {/* Top */}
                                                    <FrameMouldingSide
                                                        side="top"
                                                        frame={renderedFrame || selectedFrame}
                                                        outgoingFrame={outgoingFrame}
                                                        isCrossfading={isFrameCrossfading}
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
                                                        frame={renderedFrame || selectedFrame}
                                                        outgoingFrame={outgoingFrame}
                                                        isCrossfading={isFrameCrossfading}
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
                                                        frame={renderedFrame || selectedFrame}
                                                        outgoingFrame={outgoingFrame}
                                                        isCrossfading={isFrameCrossfading}
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
                                                        frame={renderedFrame || selectedFrame}
                                                        outgoingFrame={outgoingFrame}
                                                        isCrossfading={isFrameCrossfading}
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
                                                    <div className="absolute inset-0 pointer-events-none z-20" style={{ boxShadow: getFrameInnerShadow(renderedFrame || selectedFrame) }} />
                                                </div>
                                                )}
                                                {/* Matting Background */}
                                                <div
                                                    className="absolute shadow-[0_2px_5px_rgba(0,0,0,0.15),_0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-300"
                                                    style={{
                                                        top: `${mouldingPctH}%`,
                                                        bottom: `${mouldingPctH}%`,
                                                        left: `${mouldingPctW}%`,
                                                        right: `${mouldingPctW}%`,
                                                        backgroundColor: (!isCanvasGlazing && matWidth !== 'none') ? matColor.hex : (effectiveCanvasMountStyle === 'floater' ? '#78716c' : '#fff'),
                                                        backgroundImage: (!isCanvasGlazing && matWidth !== 'none') ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.02) 100%)' : 'none'
                                                    }}
                                                >
                                                    {/* Shadow cast by the frame moulding lip onto the mount board */}
                                                    {!isCanvasGlazing && matWidth !== 'none' && (
                                                        <div className="absolute inset-0 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.18)] pointer-events-none z-10" />
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
                                                        backgroundImage: uploadedImage && !['Black', 'White'].includes(canvasWrap) ? `url(${displayImage})` : 'none',
                                                        backgroundColor: canvasWrap === 'Black' ? '#181818' : '#f4f1e9',
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
                                                        backgroundImage: uploadedImage && !['Black', 'White'].includes(canvasWrap) ? `url(${displayImage})` : 'none',
                                                        backgroundColor: canvasWrap === 'Black' ? '#181818' : '#f4f1e9',
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
                                            className={`absolute overflow-hidden transition-all duration-300 ${isCanvasGlazing && effectiveCanvasMountStyle === 'traditional' ? 'z-[5]' : 'z-20'} ${isCanvasOnly || isCanvasGlazing ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]' : 'shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]'}`}
                                        style={{
                                            top: isCanvasOnly || isPreset ? '0%' : isCanvasGlazing ? (effectiveCanvasMountStyle === 'floater' ? `${mouldingPctH + floaterGapPctH}%` : `${Math.max(0, mouldingPctH - traditionalOverlapPctH)}%`) : `${mouldingPctH + matPctTop}%`,
                                            bottom: isCanvasOnly || isPreset ? '0%' : isCanvasGlazing ? (effectiveCanvasMountStyle === 'floater' ? `${mouldingPctH + floaterGapPctH}%` : `${Math.max(0, mouldingPctH - traditionalOverlapPctH)}%`) : `${mouldingPctH + matPctBottom}%`,
                                            left: isCanvasOnly || isPreset ? '0%' : isCanvasGlazing ? (effectiveCanvasMountStyle === 'floater' ? `${mouldingPctW + floaterGapPctW}%` : `${Math.max(0, mouldingPctW - traditionalOverlapPctW)}%`) : `${mouldingPctW + matPctW}%`,
                                            right: isCanvasOnly || isPreset ? '0%' : isCanvasGlazing ? (effectiveCanvasMountStyle === 'floater' ? `${mouldingPctW + floaterGapPctW}%` : `${Math.max(0, mouldingPctW - traditionalOverlapPctW)}%`) : `${mouldingPctW + matPctW}%`,
                                            backgroundColor: (!isCanvasOnly && !isCanvasGlazing && matWidth !== 'none' && !isPreset) ? matColor.hex : 'transparent'
                                        }}
                                    >
                                        {/* Inner Mat Bevel (precision 45-degree bevel cut exposing archival white core #f7f4ee matching 3D matBevel) */}
                                        {selectedFrame?.id !== 'frame-canvas' && !isCanvasGlazing && matWidth !== 'none' && !isPreset && (
                                            <>
                                                {/* Soft shadow cast by 4-ply board onto print */}
                                                <div className="absolute inset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.22),_inset_0_0_1px_rgba(0,0,0,0.15)] pointer-events-none z-30" />
                                                {/* Crisp white-core bevel edge */}
                                                <div className="absolute inset-0 border border-[#f7f4ee]/85 pointer-events-none z-30" />
                                                {/* Light catch on top & left cut facets */}
                                                <div className="absolute inset-0 border-t border-l border-white/60 pointer-events-none z-30" />
                                                {/* Subtle shade on bottom & right cut facets */}
                                                <div className="absolute inset-0 border-b border-r border-black/10 pointer-events-none z-30" />
                                            </>
                                        )}

                                        {uploadedImage ? (
                                            <img
                                                src={displayImage}
                                                alt="Artwork"
                                                className="w-full h-full object-cover"
                                                style={{
                                                    imageRendering: '-webkit-optimize-contrast',
                                                    transform: 'translateZ(0)',
                                                    backfaceVisibility: 'hidden',
                                                    ...(fitEnabled ? cropStyle(imageNaturalSize, fitCrop) : {}),
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
                                        {!isCanvasOnly && !isCanvasGlazing && glassType === 'standard' && (
                                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none mix-blend-overlay z-40" />
                                        )}
                                        {!isCanvasOnly && !isCanvasGlazing && glassType === 'float-glass' && (
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-white/20 to-white/0 pointer-events-none mix-blend-screen z-40" />
                                        )}
                                        {!isCanvasOnly && !isCanvasGlazing && glassType === 'museum' && (
                                            <div className="absolute inset-0 bg-stone-900/5 pointer-events-none mix-blend-multiply z-40" />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                        {/* ── ROOM SCENE FOREGROUND ──
                            A few near-field objects should visually occlude a
                            frame when the configured piece collides with them.
                            Keep this as a separate foreground pass so the
                            room backdrop can stay behind the frame, while
                            entryway console artefacts can sit in front. */}
                        {[
                            renderRoomForeground(departingRoom, departingRoomLayout, 'outgoing'),
                            renderRoomForeground(activeRoom, roomLayout, isTransitioning ? 'incoming' : ''),
                        ]}
                        
                        {/* The zoomed-in disclaimer that used to fade in here is
                            gone: with the note pinned under the pane it's on
                            screen in every non-full-screen state already, so
                            fading a second copy in over the wall would have
                            been two notes at once. */}
                    </div>

                </div>

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
                    itself, since it's the only way to exit. Hover only hides
                    it in room scenes — in Plain scene hover doesn't zoom
                    anything (isZoomedByDefault is already true there), so
                    there's nothing for the button to be clearing out of the
                    way of. */}
                <button
                    onClick={() => (isFullScreen ? exitFullScreen() : enterFullScreen())}
                    data-testid="visualizer-chrome"
                    className={`group absolute ${isFullScreen ? 'bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 sm:bottom-6 sm:right-6' : 'bottom-3.5 right-3.5 sm:bottom-4 sm:right-6'} z-30 w-10 h-10 flex items-center justify-center rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all ${CHROME_MOTION} bg-white/95 backdrop-blur text-stone-700 ${
                        ((isHovered && activeRoom) || isMaxZoom) && !isFullScreen ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                    }`}
                    aria-label={isFullScreen ? 'Exit full screen' : 'Full screen'}
                >
                    {/* Hover hint — same glassmorphic pill style as InfoTooltip
                        above. Native `title` was dropped in favor of this: it's
                        instant and consistently styled, where title's tooltip
                        is browser-dependent and shows only after a ~1s delay. */}
                    <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden group-hover:block whitespace-nowrap px-2.5 py-1 bg-stone-900/95 backdrop-blur-sm text-stone-100 text-[10px] font-medium rounded-lg shadow-xl border border-stone-850 z-50">
                        {isFullScreen ? 'Exit full screen' : 'Full screen'}
                    </span>
                    <span className="relative w-[18px] h-[18px] flex items-center justify-center">
                        <Maximize2 size={16} strokeWidth={1.3} className={`absolute transition-all duration-300 ${isFullScreen ? 'opacity-0 rotate-45 scale-75' : 'opacity-100 rotate-0 scale-100'}`} />
                        <X size={18} className={`absolute transition-all duration-300 ${isFullScreen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-45 scale-75'}`} />
                    </span>
                </button>

                {/* AR Toggle — mirrors the full-screen button's own
                    positioning/visibility rules (opposite corner, hidden
                    during full-screen and max-zoom for the same reasons:
                    nothing useful to do from either state, just clutter).
                    Whether AR actually works on this device is decided
                    inside ArPreviewModal itself once opened (model-viewer's
                    own capability probe) — this button always opens the
                    modal, which is also where the "AR isn't available
                    here, but here's a 3D look" fallback message lives. */}
                {/* Faded rather than unmounted while zoomed, matching the
                    full-screen button opposite it. Unmounting made it vanish
                    on the same frame the piece started growing — a hard cut
                    against a 260ms move, which is exactly the kind of
                    mismatch that reads as a glitch rather than a transition.
                    Hover only hides it in room scenes, same reasoning as the
                    full-screen button — Plain scene hover doesn't zoom
                    anything, so the button has nothing to get out of the
                    way of there. */}
                {!isFullScreen && selectedFrame?.id !== 'frame-canvas' && (
                    <button
                        onClick={() => setIsArOpen(true)}
                        data-testid="visualizer-chrome"
                        className={`group absolute bottom-3.5 left-3.5 sm:bottom-4 sm:left-6 z-30 w-10 h-10 flex items-center justify-center rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all ${CHROME_MOTION} bg-white/95 backdrop-blur text-stone-700 ${
                            ((isHovered && activeRoom) || isMaxZoom) ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                        }`}
                        aria-label="View this frame on your wall in AR"
                    >
                        {/* Hover hint — same style as the full-screen button's;
                            see that one's comment for why title was dropped.
                            Wording differs by input: a mouse-and-keyboard
                            desktop can only ever get the 3D viewer (AR needs a
                            phone's camera+gyro), so promising "on your wall"
                            there would be a hint for something that can't
                            happen on that device. Touch devices get both,
                            since ArViewer itself offers a 3D/AR choice there. */}
                        <span className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block whitespace-nowrap px-2.5 py-1 bg-stone-900/95 backdrop-blur-sm text-stone-100 text-[10px] font-medium rounded-lg shadow-xl border border-stone-850 z-50">
                            {isHoverCapable() ? 'View in 3D' : 'View in 3D or on your wall'}
                        </span>
                        <img
                            src="/icons/ar-spatial-cube.png"
                            alt=""
                            className="w-[27px] h-[27px] object-contain"
                        />
                    </button>
                )}

            </div>

            </div>

            {/* RIGHT: CONFIGURATION DASHBOARD — fades in with the same
                paneVisible flag as the visualizer pane so it doesn't just
                hard-pop back in the instant it remounts after a full-screen
                exit. */}
            {!isFullScreen && (
            <div className={`flex flex-col relative shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10 transition-all duration-300 ${paneVisible ? 'opacity-100' : 'opacity-0'} ${isSideBySide ? 'w-[30%] flex-none h-[calc(100dvh-47px)] overflow-hidden' : 'w-full flex-1 h-auto'}`} style={{ backgroundColor: wallColor.hex }}>
                {/* Premium Tint Overlay: Keeps the sidebar 90% white, letting 10% of the wall color bleed through */}
                <div className="absolute inset-0 bg-white/90" />
                
                <div className={`flex-1 p-5 space-y-6 custom-scrollbar relative z-10 ${isSideBySide ? 'overflow-y-auto pb-4' : 'pb-3 sm:pb-4'}`}>
                    
                    {/* Header */}
                    <div>
                        <h1 className="text-xl font-serif font-bold text-stone-900 mb-1">Start Framing</h1>
                        <p className="text-sm text-stone-500">Perfectly customized to your space.</p>
                    </div>

                    {/* Only ever appears when clampSizeToValidRange actually
                        had to adjust an Inspiration/Museum/catalogue
                        selection's listed size — a manually-picked or
                        manually-typed size never triggers this. */}
                    {sizeClampNotice && (
                        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                            <Info size={14} className="mt-0.5 shrink-0 text-amber-600" />
                            <p className="flex-1">{sizeClampNotice}</p>
                            <button
                                type="button"
                                onClick={() => setSizeClampNotice('')}
                                className="shrink-0 text-amber-500 hover:text-amber-700"
                                aria-label="Dismiss"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* 1. Artwork */}
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                            <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepArtwork}</span>
                            Image
                        </h2>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <ArtworkImportMenu
                                isPlaceholder={isPlaceholder}
                                isUploading={isUploading}
                                onFile={applyImageFile}
                            />

                            {/* Inspiration Trigger */}
                            <button
                                onClick={() => navigate('/curated-art')}
                                className="border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center hover:bg-stone-50 hover:border-stone-400 transition-colors h-[72px] text-center"
                            >
                                <ImagePlus size={16} className="text-stone-500" />
                                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">Museum Art</span>
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
                                    style={{ backgroundImage: `url(${isPreset && uploadedImage ? getThumbnailUrl(uploadedImage, 80) : (selectedFrame.thumbnailImage || selectedFrame.cornerImage || selectedFrame.previewImg)})` }}
                                />
                                <div className="text-left">
                                    <p className="text-sm font-bold text-stone-900">{isPreset && presetTitle ? presetTitle : selectedFrame.name}</p>
                                    <p className="text-[10px] text-stone-500">{isPreset && presetDims ? presetDims : displayCategoryName(FRAME_STYLES.find(frame => frame.id === selectedFrame.id)?.category || selectedFrame.category)}</p>
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
                                {/* Unit + measurement-lines control — moved in
                                    from the visualizer's top-left chrome, right
                                    beside the section it actually governs.
                                    normal-case/tracking-normal counteract this
                                    heading's own uppercase styling, same as the
                                    Size guide link below does. */}
                                <div className="shrink-0 flex h-6 items-stretch overflow-hidden rounded-full border border-stone-200 bg-white text-[10px] font-bold normal-case tracking-normal shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setShowDimensions(!showDimensions)}
                                        className={`flex w-6 items-center justify-center border-r border-stone-200 transition-colors ${
                                            showDimensions ? 'bg-stone-100 text-stone-900' : 'text-stone-400 hover:bg-stone-50 hover:text-stone-700'
                                        }`}
                                        title={showDimensions ? 'Hide measurement lines' : 'Show measurement lines'}
                                        aria-pressed={showDimensions}
                                    >
                                        <Ruler size={12} className="shrink-0" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUnit('cm')}
                                        className={`w-7 border-r border-stone-200 transition-colors ${
                                            unit === 'cm' ? 'bg-stone-100 text-stone-900' : 'text-stone-400 hover:bg-stone-50 hover:text-stone-700'
                                        }`}
                                    >
                                        cm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUnit('in')}
                                        className={`w-6 transition-colors ${
                                            unit === 'in' ? 'bg-stone-100 text-stone-900' : 'text-stone-400 hover:bg-stone-50 hover:text-stone-700'
                                        }`}
                                    >
                                        in
                                    </button>
                                </div>
                            </span>
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            {isImageBelowMinDpi ? (
                                <div className="col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900" role="alert">
                                    This image ({activeImagePixelSize.w} × {activeImagePixelSize.h} px) is below our {minimumPrintDpi} DPI print quality minimum for the available sizes. Please upload a higher-resolution image.
                                </div>
                            ) : isProdigiFrame && finalSizesList.length === 0 ? (
                                <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900" role="status">
                                    No orderable sizes are currently available for this frame finish.
                                </div>
                            ) : null}
                            {(!showAllSizes && finalSizesList.length > 6) ? (
                                <>
                                    <div className="flex flex-col gap-2">
                                        {leftColumnCollapsed.map(renderSizeButton)}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {rightColumnCollapsed.map(renderSizeButton)}
                                    </div>
                                </>
                            ) : (
                                finalSizesList.map(renderSizeButton)
                            )}

                            {!showAllSizes && finalSizesList.length > 6 && finalSizesList.length > collapsedShownCount && (
                                <button
                                    data-size-list-toggle
                                    onClick={toggleShowAllSizes(true)}
                                    className="col-span-2 py-2 px-3 rounded-xl border border-dashed border-stone-300 text-stone-500 hover:text-stone-900 hover:border-stone-500 hover:bg-stone-50 transition-all text-xs font-bold tracking-wider text-center"
                                    style={{ fontVariant: 'all-small-caps' }}
                                >
                                    + more sizes ({finalSizesList.length - collapsedShownCount} more)
                                </button>
                            )}

                            {showAllSizes && finalSizesList.length > 6 && finalSizesList.length > collapsedShownCount && (
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
                            </h2>

                        <div className="flex bg-stone-100 p-1 rounded-xl">
                            <button
                                onClick={() => setOrientation('portrait')}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${orientation === 'portrait' ? 'bg-white shadow-sm text-stone-900 font-bold' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                Portrait
                            </button>
                            <button
                                onClick={() => setOrientation('landscape')}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${orientation === 'landscape' ? 'bg-white shadow-sm text-stone-900 font-bold' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                Landscape
                            </button>
                        </div>
                    </section>
                    )}

                    {/* 5. Image Position & Crop */}
                    {fitEnabled && <FrameFitPanel step={stepImagePosition} image={uploadedImage} natural={imageNaturalSize}
                        size={selectedSize} orientation={orientation} mat={matWidth} rail={railWidthIn}
                        frame={selectedFrame} matColor={matColor.hex} matPrice={matColor.price || 75}
                        minimumDpi={minimumNativeFloorDpiForFrame(selectedFrame)}
                        contentBounds={activeContentBounds}
                        unit={unit} price={buildCartItem(null).totalPrice} position={fitPosition} onPosition={setFitPosition}
                        availableSizes={isProdigiFrame ? prodigiSizes : finalSizesList}
                        prodigiConfiguration={prodigiConfiguration}
                        currency={isProdigiFrame ? 'GBP' : 'GHS'}
                        onApply={choice => { setSelectedSize(choice.size);
                            setOrientation(choice.orientation); setMatWidth(choice.mat); setFitPosition(choice.position); }}
                        error={fitError}
                        />}

                    {selectedFrame?.prodigiProduct && (
                        <ProdigiConfigurationPanel
                            key={selectedFrame.id}
                            step={stepProdigi}
                            frame={selectedFrame}
                            size={selectedSize}
                            selection={prodigiSelection}
                            onSelectionChange={setProdigiSelection}
                            onVisualOptionsChange={updateProdigiVisualOptions}
                        />
                    )}

                    {/* 5. Matting & 6. Glass Type (Hidden for Canvas) */}
                    {!selectedFrame?.prodigiProduct && selectedFrame?.id !== 'frame-canvas' && (
                        <>
                            {/* 5. Matting — two separate menus: Mat Width (a
                                free-form slider, styled after
                                custompictureframes.com's own mat-width picker)
                                and Mat Color (unchanged). EXPERIMENTAL — the
                                user is trying this shape out and may ask to
                                revert to the old fixed Narrow/Standard/Wide
                                presets, so keep this block self-contained. */}
                            {!isPreset && !isCanvasGlazing && (
                                <>
                                <section>
                                    {(() => {
                                        const sliderIndex = matWidthToSliderIndex(matWidth);
                                        const sizeMaxSliderIndex = matWidthToSliderIndex(sizeMaxMatWidthIn);
                                        const isNoMat = matWidth === 'none';
                                        const widthLabel = isNoMat
                                            ? 'No Mount'
                                            : unit === 'cm'
                                                ? `${(Number(matWidth) * 2.54).toFixed(1)} cm`
                                                : `${Number(matWidth).toFixed(2)} in`;
                                        return (
                                            <>
                                                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-3">
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex shrink-0 items-center justify-center text-[10px]">{stepMatting}</span>
                                                        <span>
                                                            Mount Width
                                                            <InfoTooltip text="Drag to the far left for no mount. The first step right is a 1 inch mount; each step after adds a quarter inch, up to 8 inches (less on smaller prints, so the mount never overwhelms the artwork)." />
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 text-xs font-bold text-stone-900 tabular-nums normal-case">
                                                        {widthLabel}
                                                    </span>
                                                </h2>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={sizeMaxSliderIndex}
                                                    step={1}
                                                    value={sliderIndex}
                                                    onChange={(e) => {
                                                        setMatWidth(sliderIndexToMatWidth(parseInt(e.target.value, 10)));
                                                    }}
                                                    className="w-full h-1.5 accent-fw-gold cursor-pointer"
                                                    aria-label="Mount width"
                                                />
                                            </>
                                        );
                                    })()}
                                </section>

                                {matWidth !== 'none' && (
                                    <section>
                                        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                                            <span>Mount Colour</span>
                                        </h2>
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
                                    </section>
                                )}
                                </>
                            )}

                            {/* 6. Glass Type */}
                            <section>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                            <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepGlazing}</span>
                                    <span>
                                        Glazing
                                        <InfoTooltip text="We use gallery-grade, shatterproof framing acrylic. Museum option blocks 99% UV." />
                                    </span>
                                </h2>
                                <div className="space-y-2">
                                    {[
                                        { id: 'standard', name: 'Shatterproof Perspex', desc: 'Clear, lightweight protection.', price: 0 },
                                        { id: 'non-glare', name: 'Non-Glare Acrylic', desc: 'Reduces reflections in bright rooms.', price: 100 },
                                        { id: 'museum', name: 'Museum Glazing', desc: '99% UV protection, zero reflection.', price: 200 },
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
                    {!selectedFrame?.prodigiProduct && <section>
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
                    </section>}
                </div>

                {/* Sticky Checkout Footer */}
                <div className={`bottom-0 z-20 backdrop-blur-md border-t border-stone-200 ${isSideBySide ? 'relative bg-white/85 py-1.5 px-3 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]' : 'sticky rounded-t-[22px] bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-14px_36px_rgba(28,25,23,0.10)]'}`}>
                    {fitError && (
                        <div className="w-full text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 mb-2 text-center">
                            {fitError}
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <div className={`${isSideBySide ? 'min-w-[78px]' : 'min-w-[86px]'} shrink-0`}>
                            {isImageBelowMinDpi ? (
                                <span className="max-w-56 text-[10px] leading-4 text-rose-800">Image resolution is below {minimumPrintDpi} DPI minimum.</span>
                            ) : isPrintQualityPending ? (
                                <span className="max-w-56 text-[10px] leading-4 text-stone-500">Checking print resolution…</span>
                            ) : selectedFrame?.prodigiProduct && !hasOrderableProdigiProduct ? (
                                <span className="max-w-56 text-[10px] leading-4 text-amber-800">Preview ready · this finish is not currently available to order.</span>
                            ) : selectedFrame?.prodigiProduct && (prodigiSelection?.quoteItemsGbp || prodigiSelection?.quoteTotalGbp) ? (
                                <div className="flex w-full flex-col items-start leading-none">
                                    <div className="flex flex-col items-start">
                                        <span className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-stone-400">Item price</span>
                                        <Price amount={prodigiSelection.quoteItemsGbp || prodigiSelection.quoteTotalGbp} currency="GBP" className={`${isSideBySide ? 'text-lg' : 'text-xl'} font-bold text-stone-900 tracking-tight leading-none`} />
                                    </div>
                                    <span className={`${isSideBySide ? 'mt-0.5 text-[9px] leading-none' : 'mt-1 text-[10px] leading-none'} text-stone-400`}>Excl. delivery &amp; tax</span>
                                </div>
                            ) : selectedFrame?.prodigiProduct ? (
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-xs text-stone-400 font-medium animate-pulse">Calculating price…</span>
                                </div>
                            ) : !selectedFrame?.prodigiProduct ? <Price
                                amount={
                                    Math.round((selectedSize?.price || 0) * (selectedFrame?.priceMod || 1)) +
                                    (selectedFrame?.id !== 'frame-canvas' && glassType !== 'canvas-floater' && glassType !== 'canvas-traditional' && matWidth !== 'none' ? (matColor.price || 75) : 0) +
                                    (!isCanvasOnly ? (glassType === 'non-glare' ? 100 : glassType === 'museum' ? 200 : 0) : 0) +
                (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-floater' ? 400 : 0) +
                (selectedFrame?.id !== 'frame-canvas' && glassType === 'canvas-traditional' ? 350 : 0) +
                                    (hardwareType === 'french-cleat' ? 50 : 0)
                                }
                                className="text-base sm:text-lg font-bold text-stone-900 tracking-tight leading-none"
                            /> : null}
                            {isCloudUploadPending && (
                                <span className="text-[8px] text-stone-500 whitespace-nowrap">
                                    Finishing image upload…
                                </span>
                            )}
                        </div>
                        <div className={`grid min-w-0 flex-1 grid-cols-2 ${isSideBySide ? 'gap-1.5' : 'gap-2'}`}>
                            <button
                                onClick={() => completeCheckoutAction('cart')}
                                disabled={!hasImage || isImageBelowMinDpi || isPrintQualityPending || isCloudUploadPending || loadingAction !== null || Boolean(selectedFrame?.prodigiProduct && !prodigiSelection?.quoteTotalGbp)}
                                className={`flex-1 bg-white border rounded-full text-[10px] font-bold uppercase tracking-[0.06em] transition-colors flex items-center justify-center gap-1 shadow-sm whitespace-nowrap ${isSideBySide ? 'h-10 px-1.5' : 'h-11 px-2'} ${!hasImage || isImageBelowMinDpi || isPrintQualityPending || isCloudUploadPending || loadingAction !== null || (selectedFrame?.prodigiProduct && !prodigiSelection?.quoteTotalGbp) ? 'opacity-50 cursor-not-allowed border-stone-200 text-stone-400 bg-stone-50' : 'text-stone-900 border-stone-300 hover:bg-stone-50'}`}
                            >
                                {(loadingAction === 'cart' || (isCloudUploadPending && !loadingAction)) && <Loader size={12} className="animate-spin" />}
                                {loadingAction === 'cart' ? 'Adding…' : isCloudUploadPending ? 'Uploading…' : (wasAddedToCart ? 'Added' : 'Add to Cart')}
                            </button>
                            <button
                                onClick={() => {
                                    if (wasAddedToCart) {
                                        if (!user) {
                                            setShowAuthModal(true);
                                        } else {
                                            navigate('/checkout');
                                        }
                                        return;
                                    }
                                    completeCheckoutAction('pay');
                                }}
                                disabled={!hasImage || isImageBelowMinDpi || isPrintQualityPending || isCloudUploadPending || loadingAction !== null || Boolean(selectedFrame?.prodigiProduct && !prodigiSelection?.quoteTotalGbp)}
                                className={`flex-1 border rounded-full text-[10px] font-bold uppercase tracking-[0.06em] transition-colors flex items-center justify-center gap-1 shadow-sm whitespace-nowrap ${isSideBySide ? 'h-10 px-1.5' : 'h-11 px-2'} ${!hasImage || isImageBelowMinDpi || isPrintQualityPending || isCloudUploadPending || loadingAction !== null || (selectedFrame?.prodigiProduct && !prodigiSelection?.quoteTotalGbp) ? 'opacity-50 cursor-not-allowed border-stone-200 text-stone-400 bg-stone-50' : 'bg-[#c9a84c] border-[#c9a84c] text-[#0a0a0a] hover:bg-[#d4b55c]'}`}
                            >
                                {loadingAction === 'pay' && <Loader size={12} className="animate-spin" />}
                                {loadingAction === 'pay' ? 'Preparing…' : isCloudUploadPending ? 'Uploading…' : 'Pay Now'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Frame Selection Modal — gated here (rather than relying on its
                own isOpen-guard return null) so it fully unmounts on close,
                restoring the selected frame's current catalogue tab on reopen. */}
            {isFrameModalOpen && (
                <FrameSelectionModal
                    isOpen={isFrameModalOpen}
                    onClose={() => setIsFrameModalOpen(false)}
                    selectedFrame={selectedFrame}
                    onSelect={selectFrameStyle}
                />
            )}

            {/* Met Art Selection Modal */}
            <MetArtSelectionModal 
                isOpen={isMetModalOpen} 
                onClose={handleMetModalClose} 
                onSelect={handleMetArtSelect}
            />

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                returnTo="/checkout"
            />

            <ArViewer
                isOpen={isArOpen}
                onClose={() => setIsArOpen(false)}
                frame={selectedFrame}
                widthIn={selectedFrame?.prodigiProduct ? Math.max(1, wInch - matReveal.sideIn * 2) : wInch}
                heightIn={selectedFrame?.prodigiProduct ? Math.max(1, hInch - matReveal.topIn - matReveal.bottomIn) : hInch}
                matReveal={matReveal}
                matColorHex={matColor?.hex}
                glassType={glassType}
                artworkUrl={productionImage || uploadedImage}
                hardwareType={selectedFrame?.canvasOnly
                    ? 'none'
                    : selectedFrame?.prodigiProduct
                        ? prodigiHangingHardware(selectedFrame, selectedSize).id
                        : hardwareType}
                canvasWrap={canvasWrap}
            />
        </div>
    );
};

export default CustomizeFramePage;

