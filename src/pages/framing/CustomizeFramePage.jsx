import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
    ImagePlus,
    Check,
    Ruler,
    Palette,
    Frame,
    ImageUp,
    ChevronDown,
    Info,
    Loader
} from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES, MAT_COLORS, formatDimensions, findSizeByDimension } from '../../data/constants';
import WEB_MET_DIMS from '../../data/web_met_dims.json';
import { useUnit } from '../../context/UnitContext';
import { useCart } from '../../context/CartContext';
import { uploadImageToCloud } from '../../services/storage';
import FrameSelectionModal from '../../components/FrameSelectionModal';
import MetArtSelectionModal from '../../components/MetArtSelectionModal';
import InspirationSelectionModal from '../../components/InspirationSelectionModal';
import { renderAlbumPoster } from '../../utils/albumPoster';
import { renderMoviePoster } from '../../utils/moviePoster';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../../components/AuthModal';

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
    setCollageImages,
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
    const [showDimensions, setShowDimensions] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    // True while the background Cloudinary upload for the current image is
    // in flight — until it resolves, `uploadedImage` is a blob: URL that
    // won't survive a page reload, so Add to Cart/Buy Now must wait for it.
    const [isCloudUploadPending, setIsCloudUploadPending] = useState(false);
    const [isFrameModalOpen, setIsFrameModalOpen] = useState(false);
    const [isWallPickerOpen, setIsWallPickerOpen] = useState(false);
    const [isDimPickerOpen, setIsDimPickerOpen] = useState(false);
    const [isMetModalOpen, setIsMetModalOpen] = useState(false);
    const [isInspirationModalOpen, setIsInspirationModalOpen] = useState(false);
    const [selectedUploadId, setSelectedUploadId] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isMaxZoom, setIsMaxZoom] = useState(false);
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

    useEffect(() => {
        const handleResize = () => setWindowSize({
            width: window.innerWidth,
            height: window.innerHeight
        });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isLandscape = windowSize.width > windowSize.height;
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
    // onto the Frame Studio — used identically by both entry points:
    //  - real navigation (header/hamburger → /inspiration → navigate here with
    //    location.state), via the Initial Setup effect below
    //  - the in-studio Inspiration modal (InspirationSelectionModal forwards the
    //    same state object through its onApplySelection prop)
    // Add new fields/categories HERE and both paths pick them up automatically.
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
        if (!selectedFrame) setSelectedFrame(FRAME_STYLES[0]);
        if (!selectedSize) setSelectedSize(FRAME_SIZES[2]); // 16x20 default

        // Sync state if coming from Inspiration 'Get This' or Landings — same
        // handler the in-studio Inspiration modal uses, so both entry points
        // behave identically.
        if (location.state && Object.keys(location.state).length > 0) {
            applyInspirationSelection(location.state);

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
            // Use standard 300 DPI print resolution for crisp text in both the visualizer and the final production print
            const previewDPI = Math.max(300, (window.devicePixelRatio || 1) * 144);
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
        if (matWidth !== 'none') base += (matColor.price || 75);
        if (glassType === 'non-glare') base += 100;
        if (glassType === 'museum') base += 200;
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
        const calculatedHeight = frameHeightPx + sofaHeightPx + dynamicPadding;
        
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
        // We also skip auto-detect if the current image is the preset image loaded on mount.
        if (location.state?.presetImage || location.state?.posterData || uploadedImage === initialPresetImageRef.current) {
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
        const effectImage = uploadedImage;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (cancelled || effectImage !== latestUploadedImageRef.current) return;
            setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            // Album posters and movie posters are always portrait, regardless of
            // the source image's actual pixel aspect ratio — don't let
            // auto-detection override the intentional portrait lock for these flows.
            if (!isAlbumPoster && !isMoviePoster && !isMoviePosterPrint) {
                const isLandscape = img.naturalWidth > img.naturalHeight;
                setOrientation(isLandscape ? 'landscape' : 'portrait');
            }
            setIsOptimized(false); // Reset optimization state for new image
            setIsImageLoading(false); // Hide spinner safely even if cached

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
        img.src = uploadedImage;
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
            if (!isCanvasPrint) {
                ctx.fillStyle = selectedFrame?.baseColor || '#342e2b';
                ctx.fillRect(offsetX, offsetY, w, h);
            }

            const matPct = (!isCanvasPrint && matWidth !== 'none') ? ({ narrow: 0.04, standard: 0.06, wide: 0.08 }[matWidth] || 0.04) : 0;
            const matW = Math.round(w * matPct);
            const matH = Math.round(h * matPct);
            const matLeft = offsetX + borderW, matTop = offsetY + borderH, matRight = offsetX + w - borderW, matBottom = offsetY + h - borderH;
            if (matPct > 0) {
                ctx.fillStyle = matColor?.hex || '#ffffff';
                ctx.fillRect(matLeft, matTop, matRight - matLeft, matBottom - matTop);
            }

            const artLeft = matLeft + matW;
            const artTop = matTop + matH;
            const artW = Math.max(1, (matRight - matW) - artLeft);
            const artH = Math.max(1, (matBottom - matH) - artTop);

            // Canvas prints wrap edge-to-edge (cover); framed art is
            // letterboxed within the mat opening (contain) — mirrors the
            // object-fit rules used in the live visualizer.
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const boxAspect = artW / artH;
            let drawW, drawH;
            const widthConstrained = imgAspect > boxAspect;
            if (isCanvasPrint ? widthConstrained : !widthConstrained) {
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
            (selectedFrame?.id !== 'frame-canvas' && matWidth !== 'none' ? (matColor.price || 75) : 0) +
            (selectedFrame?.id !== 'frame-canvas' ? (glassType === 'non-glare' ? 100 : glassType === 'museum' ? 200 : 0) : 0) +
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

    // Filter and sort sizes ascending by area (width * height)
    const uniqueSizes = [];
    const sizeSeen = new Set();
    const sortedSizes = [...FRAME_SIZES].sort((a, b) => (a.width * a.height) - (b.width * b.height));
    
    // Check if the image is square
    const isSquareArtwork = isAlbumArt || (imageNaturalSize && imageNaturalSize.w > 0 && Math.abs(imageNaturalSize.w - imageNaturalSize.h) <= 5);
    
    for (const size of sortedSizes) {
        // If it's a square image (like album art), only allow square sizes
        if (isSquareArtwork && size.width !== size.height) {
            continue;
        }

        // Album posters and movie posters are always portrait — only offer
        // naturally-portrait, non-square sizes.
        if ((isAlbumPoster || isMoviePoster || isMoviePosterPrint) && size.height <= size.width) {
            continue;
        }

        const key = `${size.width}x${size.height}`;
        const isAlias = ['sm', 'md', 'lg', 'xl', 'lg-land', 'xl-land', 'Small', 'Medium', 'Large', 'Statement'].includes(size.id);
        if (!sizeSeen.has(key) && !isAlias) {
            sizeSeen.add(key);
            uniqueSizes.push(size);
        }
    }

    // Identify the most popular 6 small sizes and 6 large sizes
    const popSmallIds = ['5x7', '8x10', 'a4', '11x14', '12x12', 'a3'];
    const popLargeIds = ['24x36', '20x30', '18x24', 'a2', '16x20', '12x18'];

    const popSmall = popSmallIds.map(id => uniqueSizes.find(s => s.id === id)).filter(Boolean);
    const popLarge = popLargeIds.map(id => uniqueSizes.find(s => s.id === id)).filter(Boolean);

    // Build the initial 12 sizes by interleaving small (left) and large (right)
    const initial12 = [];
    for (let i = 0; i < 6; i++) {
        if (popSmall[i]) initial12.push(popSmall[i]);
        if (popLarge[i]) initial12.push(popLarge[i]);
    }

    // The remaining sizes are anything not in the initial 12
    const initial12Keys = new Set(initial12.map(s => `${s.width}x${s.height}`));
    const remainingSizes = uniqueSizes.filter(s => !initial12Keys.has(`${s.width}x${s.height}`));

    // Combine them for the final display order (initial 12 first, followed by the rest when expanded)
    let finalSizesList = [...initial12, ...remainingSizes];

    // If selectedSize is custom and not in the list, inject it at the beginning
    if (selectedSize && !finalSizesList.find(s => s.id === selectedSize.id)) {
        finalSizesList = [selectedSize, ...finalSizesList];
    }

    let stepCounter = 1;
    const stepArtwork = stepCounter++;
    const stepFrameStyle = stepCounter++;
    const stepDimensions = stepCounter++;
    
    const showOrientation = !isPreset && !isAlbumArt && !isAlbumPoster && !isMoviePoster && !isMoviePosterPrint;
    const stepOrientation = showOrientation ? stepCounter++ : null;
    
    const showMatting = selectedFrame?.id !== 'frame-canvas' && !isPreset;
    const stepMatting = showMatting ? stepCounter++ : null;
    
    const showGlazing = selectedFrame?.id !== 'frame-canvas';
    const stepGlazing = showGlazing ? stepCounter++ : null;
    
    const stepHardware = stepCounter++;

    if (!selectedSize || !selectedFrame) return <div className="min-h-screen bg-[#faf9f8]" />;

    return (
        <div className={`flex ${isSideBySide ? 'flex-row h-[calc(100dvh-56px)] overflow-hidden' : 'flex-col min-h-[calc(100dvh-56px)]'} bg-[#faf9f8]`}>
            
            {/* LEFT: IMMERSIVE VISUALIZER */}
            <div 
                className={`shrink-0 relative flex items-center justify-center border-r border-stone-200 transition-all duration-700 ease-in-out ${isMaxZoom ? 'overflow-auto' : 'overflow-hidden'} [scrollbar-gutter:stable] ${isSideBySide ? 'w-[70%] h-auto shrink' : 'w-full'}`} 
                style={{ 
                    backgroundColor: wallColor.hex,
                    height: !isSideBySide ? `${visualizerMetrics.height}px` : undefined 
                }}
            >

                
                {/* Wall Color Palette - Floating Top Right */}
                <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-20">
                    <button
                        onClick={() => setIsWallPickerOpen(!isWallPickerOpen)}
                        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all bg-white/95 backdrop-blur text-stone-700 font-semibold text-xs ml-auto"
                        title="Change Wall Color"
                    >
                        <div className="w-4 h-4 rounded-full border border-stone-200 shrink-0" style={{ backgroundColor: wallColor.hex, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }} />
                        <span className="hidden sm:inline">Wall Color</span>
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
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2 text-center w-full whitespace-nowrap sm:hidden">Wall Color</p>
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
                    </div>
                </div>

                {/* Dimension Toggle & Unit Selector - Dynamic Pill */}
                <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-20 flex items-stretch bg-white/95 backdrop-blur border border-stone-200 rounded-full shadow-sm hover:shadow-md transition-all overflow-hidden h-8 sm:h-9">
                    <button
                        onClick={() => setShowDimensions(!showDimensions)}
                        className={`flex items-center gap-1.5 px-3 h-full text-xs font-semibold transition-colors ${
                            showDimensions ? 'bg-stone-100 text-stone-900 border-r border-stone-200' : 'text-stone-600 hover:text-stone-900 bg-white'
                        }`}
                        title="Toggle Dimensions"
                    >
                        <Ruler size={14} className="shrink-0" />
                        <span className="hidden sm:inline">Dimensions</span>
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
                        className="absolute left-0 top-12 sm:top-14 w-full h-[calc(65%-3rem)] sm:h-[calc(65%-3.5rem)] flex flex-col items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    >

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
                            const frameWidthPct = (innerWidthCm / SOFA_CM) * SOFA_BODY_PCT;
                            
                            // Moulding: Standard visual thickness
                            // Instead of strictly physical math (which makes borders look paper-thin on large frames 
                            // and brutally thick on small frames), we render all frame widths as a standard visual width.
                            // 5% of the shortest edge provides a beautiful, standard proportion for all frames.
                            const standardVisualPct = 5; 
                            const minSide = Math.min(wInch, hInch);
                            const mouldingPctW = (minSide / wInch) * standardVisualPct;
                            const mouldingPctH = (minSide / hInch) * standardVisualPct;
                            
                            // Mat inset as % of frame width/height
                            // Clamp the max inset so we don't mathematically collapse the artwork to 0 or negative
                            const rawMatPctW = matWidth !== 'none' ? (currentMatInches / wInch) * 100 : 0;
                            const rawMatPctH = matWidth !== 'none' ? (currentMatInches / hInch) * 100 : 0;
                            const matPctW = Math.max(0, Math.min(rawMatPctW, 45 - mouldingPctW));
                            const matPctH = Math.max(0, Math.min(rawMatPctH, 45 - mouldingPctH));

                            // ─── DYNAMIC ZOOM CLAMPING (Never Overlap/Cutoff) ───
                            const zoomScale = (() => {
                                if (!isHovered) return 1.0;
                                
                                // Calculate unzoomed dimensions in pixels relative to the physical container
                                const baseWidthPx = (frameWidthPct / 100) * zoneSize.width;
                                const baseHeightPx = baseWidthPx * (hInch / wInch);
                                
                                // Safe zoom boundaries: never exceed 90% of zone height or 85% of zone width
                                const maxZoomWidthPx = zoneSize.width * 0.85;
                                const maxZoomHeightPx = zoneSize.height * 0.90;
                                
                                const safeBaseW = baseWidthPx > 0 ? baseWidthPx : 1;
                                const safeBaseH = baseHeightPx > 0 ? baseHeightPx : 1;
                                
                                const scaleW = maxZoomWidthPx / safeBaseW;
                                const scaleH = maxZoomHeightPx / safeBaseH;
                                
                                // Max possible scale that fits safely inside the visual bounds
                                let maxScale = Math.min(scaleW, scaleH);
                                
                                if (isMaxZoom) {
                                    // Deep inspection mode: push past boundaries if necessary (but don't get completely ridiculous)
                                    return Math.max(3.5, maxScale * 2.25);
                                }
                                
                                // Cap at 8.0x to prevent over-pixelation on tiny frames, never shrink below 1.0x
                                return Math.max(1.0, Math.min(8.0, maxScale));
                            })();

                            // Calculate push down amount so the top of the frame isn't hidden behind the header in max zoom
                            const pushDownAmount = (() => {
                                if (!isHovered || !isMaxZoom) return 0;
                                const baseWidthPx = (frameWidthPct / 100) * zoneSize.width;
                                const baseHeightPx = baseWidthPx * (hInch / wInch);
                                const targetHeight = baseHeightPx * zoomScale;
                                const overflowTop = (targetHeight - zoneSize.height) / 2;
                                return overflowTop > 0 ? (overflowTop * 2) + 40 : 0;
                            })();

                            const pushRightAmount = (() => {
                                if (!isHovered || !isMaxZoom) return 0;
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
                                        const now = Date.now();
                                        const DOUBLE_TAP_DELAY = 300;
                                        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
                                            if (isHovered) setIsMaxZoom(!isMaxZoom);
                                        }
                                        lastTapRef.current = now;
                                    }}
                                    onDoubleClick={() => {
                                        if (isHovered) setIsMaxZoom(!isMaxZoom);
                                    }}
                                    className={`relative shadow-[0_25px_50px_rgba(0,0,0,0.3)] select-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                        isMaxZoom ? 'cursor-zoom-out' : 'cursor-zoom-in'
                                    } ${
                                        isHovered 
                                            ? 'shadow-[0_50px_100px_rgba(0,0,0,0.55)] z-40' 
                                            : 'z-10'
                                    }`}
                                    style={{
                                        width: isHovered 
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

                                    {/* Dimension Overlays */}
                                    {showDimensions && (
                                        <>
                                            <div style={{ fontSize: `${dimFontSizePx}px` }} className={`absolute ${dimTopClass} left-0 w-full flex items-center justify-center text-stone-800 font-mono border-t border-stone-800 pt-1 mix-blend-color-burn opacity-80 whitespace-nowrap overflow-visible pointer-events-none`}>
                                                <div className="absolute left-0 top-0 h-1.5 sm:h-2 w-px bg-stone-800" />
                                                <div className="absolute right-0 top-0 h-1.5 sm:h-2 w-px bg-stone-800" />
                                                {unit === 'in' ? wInch.toFixed(1) : innerWidthCm.toFixed(1)} {unit === 'in' ? 'in' : 'cm'}
                                            </div>
                                            <div style={{ fontSize: `${dimFontSizePx}px` }} className={`absolute ${dimRightClass} top-0 h-full flex flex-col items-center justify-center text-stone-800 font-mono border-r border-stone-800 pr-1 mix-blend-color-burn opacity-80 whitespace-nowrap overflow-visible pointer-events-none`}>
                                                <div className="absolute right-0 top-0 w-1.5 sm:w-2 h-px bg-stone-800" />
                                                <div className="absolute right-0 bottom-0 w-1.5 sm:w-2 h-px bg-stone-800" />
                                                <span style={{ writingMode: 'vertical-rl' }}>{unit === 'in' ? hInch.toFixed(1) : innerHeightCm.toFixed(1)} {unit === 'in' ? 'in' : 'cm'}</span>
                                            </div>
                                        </>
                                    )}

                                    {isPreset ? (
                                        <div className="absolute inset-0 shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden z-20">
                                            {uploadedImage && (
                                                <img
                                                    src={uploadedImage}
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
                                                    <div 
                                                        className="absolute top-0 left-0 right-0 z-10"
                                                        style={{
                                                            height: `${mouldingPctH}%`,
                                                            backgroundImage: getSideBackground('top', selectedFrame),
                                                            clipPath: `polygon(0 0, 100% 0, ${100 - mouldingPctW}% 100%, ${mouldingPctW}% 100%)`
                                                        }}
                                                    />
                                                    {/* Bottom */}
                                                    <div 
                                                        className="absolute bottom-0 left-0 right-0 z-10"
                                                        style={{
                                                            height: `${mouldingPctH}%`,
                                                            backgroundImage: getSideBackground('bottom', selectedFrame),
                                                            clipPath: `polygon(${mouldingPctW}% 0, ${100 - mouldingPctW}% 0, 100% 100%, 0 100%)`
                                                        }}
                                                    />
                                                    {/* Left */}
                                                    <div 
                                                        className="absolute top-0 bottom-0 left-0 z-10"
                                                        style={{
                                                            width: `${mouldingPctW}%`,
                                                            backgroundImage: getSideBackground('left', selectedFrame),
                                                            clipPath: `polygon(0 0, 100% ${mouldingPctH}%, 100% ${100 - mouldingPctH}%, 0 100%)`
                                                        }}
                                                    />
                                                    {/* Right */}
                                                    <div 
                                                        className="absolute top-0 bottom-0 right-0 z-10"
                                                        style={{
                                                            width: `${mouldingPctW}%`,
                                                            backgroundImage: getSideBackground('right', selectedFrame),
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
                                                        backgroundColor: matWidth !== 'none' ? matColor.hex : '#fff'
                                                    }}
                                                >
                                                    {/* Outer Mat Bevel (where mat meets frame) */}
                                                    {matWidth !== 'none' && (
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
                                                        backgroundImage: uploadedImage ? `url(${uploadedImage})` : 'none',
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
                                                        backgroundImage: uploadedImage ? `url(${uploadedImage})` : 'none',
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
                                            className={`absolute overflow-hidden transition-all duration-300 z-20 ${selectedFrame?.id === 'frame-canvas' ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]' : 'shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]'}`}
                                        style={{
                                            top: selectedFrame?.id === 'frame-canvas' || isPreset ? '0%' : `${mouldingPctH + matPctH}%`,
                                            bottom: selectedFrame?.id === 'frame-canvas' || isPreset ? '0%' : `${mouldingPctH + matPctH}%`,
                                            left: selectedFrame?.id === 'frame-canvas' || isPreset ? '0%' : `${mouldingPctW + matPctW}%`,
                                            right: selectedFrame?.id === 'frame-canvas' || isPreset ? '0%' : `${mouldingPctW + matPctW}%`,
                                            backgroundColor: (selectedFrame?.id !== 'frame-canvas' && matWidth !== 'none' && !isPreset) ? matColor.hex : 'transparent'
                                        }}
                                    >
                                        {/* Inner Mat Bevel (where mat meets artwork) */}
                                        {selectedFrame?.id !== 'frame-canvas' && matWidth !== 'none' && !isPreset && (
                                            <div className="absolute inset-0 shadow-[0_1px_3px_rgba(0,0,0,0.2)] pointer-events-none z-30" />
                                        )}
                                        
                                        {uploadedImage ? (
                                            <img
                                                src={uploadedImage}
                                                alt="Artwork"
                                                className={`w-full h-full ${selectedFrame?.id === 'frame-canvas' || isPreset ? 'object-cover' : 'object-contain'}`}
                                                style={{
                                                    imageRendering: '-webkit-optimize-contrast',
                                                    transform: 'translateZ(0)',
                                                    backfaceVisibility: 'hidden',
                                                    backgroundColor: (selectedFrame?.id !== 'frame-canvas' && matWidth !== 'none' && !isPreset) ? matColor.hex : 'transparent'
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
                        
                        {/* Zoomed-In Disclaimer (flows below frame on hover) */}
                        <div
                            className={`text-[7px] sm:text-[9px] text-stone-600/70 select-none pointer-events-none text-center font-medium mix-blend-multiply px-2 leading-relaxed tracking-wide transition-all duration-500 mt-6 z-20 flex flex-col items-center ${
                                isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 h-0 overflow-hidden mt-0'
                            }`}
                        >
                            <span className="whitespace-nowrap">Note: Visualizer renderings are digital approximations. Finished products will feature</span>
                            <span className="whitespace-nowrap">the exact physical moulding profiles, textures, and details shown in our catalogue.</span>
                        </div>
                    </div>

                    {/* ── SCALE REFERENCE: 160cm Sofa ── */}
                    <div 
                        className={`absolute bottom-5 left-1/2 -translate-x-1/2 w-[48%] pointer-events-none flex flex-col items-center justify-end transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isHovered ? 'opacity-0 scale-75 translate-y-10' : 'opacity-100 scale-100 translate-y-0'
                        }`}
                    >
                        <div className="relative w-full">
                            <svg viewBox="0 0 800 250" className="w-full h-auto text-stone-900 opacity-[0.12]" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M50 250 L750 250 L750 150 L700 150 L700 200 L100 200 L100 150 L50 150 Z" />
                                <rect x="120" y="100" width="270" height="100" rx="10" />
                                <rect x="410" y="100" width="270" height="100" rx="10" />
                            </svg>
                        </div>

                        {/* Sofa Dimension Overlay */}
                        {showDimensions && (
                            <div className="relative w-[87.5%] -mt-1 flex items-center justify-center text-stone-800 font-mono text-[8px] sm:text-[10px] whitespace-nowrap border-b border-stone-800 pb-0.5 mix-blend-color-burn opacity-80">
                                <div className="absolute left-0 bottom-0 h-1.5 sm:h-2 w-px bg-stone-800" />
                                <div className="absolute right-0 bottom-0 h-1.5 sm:h-2 w-px bg-stone-800" />
                                Standard 2-Seater Sofa - {unit === 'in' ? (160 / 2.54).toFixed(1) : '160.0'} {unit === 'in' ? 'in' : 'cm'}
                            </div>
                        )}
                        <div className="text-[7px] sm:text-[9px] text-stone-600/70 select-none text-center font-medium mix-blend-multiply px-2 leading-tight tracking-wide mt-1 translate-y-1.5 flex flex-col items-center">
                            <span className="whitespace-nowrap">Note: Visualizer renderings are digital approximations. Finished products will feature</span>
                            <span className="whitespace-nowrap">the exact physical moulding profiles, textures, and details shown in our catalogue.</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* RIGHT: CONFIGURATION DASHBOARD */}
            <div className={`flex flex-col relative shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10 ${isSideBySide ? 'w-[30%] flex-none h-[calc(100dvh-56px)] overflow-hidden' : 'w-full flex-1 h-auto'}`} style={{ backgroundColor: wallColor.hex }}>
                {/* Premium Tint Overlay: Keeps the sidebar 90% white, letting 10% of the wall color bleed through */}
                <div className="absolute inset-0 bg-white/90" />
                
                <div className={`flex-1 p-5 space-y-6 custom-scrollbar pb-24 relative z-10 ${isSideBySide ? 'overflow-y-auto' : ''}`}>
                    
                    {/* Header */}
                    <div>
                        <h1 className="text-[1.375rem] font-serif font-bold text-stone-900 mb-1">Customize Your Frame</h1>
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
                                        <ImageUp size={16} className={(!uploadedImage || uploadedImage === 'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1600&q=80&sat=-20&con=-10') ? 'text-stone-400' : 'text-stone-950'} />
                                        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-750 truncate w-full">
                                            {(!uploadedImage || uploadedImage === 'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1600&q=80&sat=-20&con=-10') ? 'Upload Image' : 'Replace Image'}
                                        </span>
                                    </>
                                )}
                            </label>

                            {/* Inspiration Trigger */}
                            <button
                                onClick={() => setIsInspirationModalOpen(true)}
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
                                    style={{ backgroundImage: `url(${isPreset && uploadedImage ? uploadedImage : selectedFrame.previewImg})` }}
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
                    <section className={isPreset ? 'opacity-50 pointer-events-none' : ''}>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                            <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepDimensions}</span>
                            <span>
                                Dimensions
                                <InfoTooltip text="Dimensions show the inner opening size. Every frame is built custom to fit." />
                            </span>
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            {(showAllSizes ? finalSizesList : finalSizesList.slice(0, 12)).map(size => (
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
                                </button>
                            ))}
                            
                            {!showAllSizes && finalSizesList.length > 12 && (
                                <button 
                                    onClick={() => setShowAllSizes(true)}
                                    className="col-span-2 py-2 px-3 rounded-xl border border-dashed border-stone-300 text-stone-500 hover:text-stone-900 hover:border-stone-500 hover:bg-stone-50 transition-all text-xs font-bold tracking-wider text-center"
                                    style={{ fontVariant: 'all-small-caps' }}
                                >
                                    + more sizes ({finalSizesList.length - 12} more)
                                </button>
                            )}
                            
                            {showAllSizes && finalSizesList.length > 12 && (
                                <button 
                                    onClick={() => setShowAllSizes(false)}
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
                            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
                                <span className="bg-stone-100 text-stone-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{stepOrientation}</span>
                                Orientation
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
                            {!isPreset && (
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
                                    ].map(glass => (
                                        <button
                                            key={glass.id}
                                            onClick={() => setGlassType(glass.id)}
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
                        <span className="text-lg font-bold text-stone-900 tracking-tight">GHS {
                            Math.round((selectedSize?.price || 0) * (selectedFrame?.priceMod || 1)) +
                            (selectedFrame?.id !== 'frame-canvas' && matWidth !== 'none' ? (matColor.price || 75) : 0) +
                            (selectedFrame?.id !== 'frame-canvas' ? (glassType === 'non-glare' ? 100 : glassType === 'museum' ? 200 : 0) : 0) +
                            (hardwareType === 'french-cleat' ? 50 : 0)
                        }</span>
                        <span className="text-[8px] text-stone-500 whitespace-nowrap">
                            {isCloudUploadPending ? 'Finishing image upload…' : 'Delivery fee paid to the courier on delivery'}
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

            {/* Inspiration Selection Modal */}
            <InspirationSelectionModal 
                isOpen={isInspirationModalOpen}
                onClose={() => setIsInspirationModalOpen(false)}
                onApplySelection={applyInspirationSelection}
                setSelectedFrame={setSelectedFrame}
                setSelectedSize={setSelectedSize}
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
