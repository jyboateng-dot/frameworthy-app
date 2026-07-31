import React, { useState, useEffect, useMemo } from 'react';
import { Heart, RefreshCw } from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES, findSizeByDimension, formatDimensions, parseCustomSize } from '../data/constants';
import { useUnit } from '../context/UnitContext';
import { useWishlist } from '../context/WishlistContext';
import { UNSPLASH_IMAGES } from '../data/unsplashLocal';
import WEB_MET_DIMS from '../data/web_met_dims.json';
import { getThumbnailUrl } from '../services/storage';

// Shuffle helper
const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// Module-level state survives route changes but resets on hard refresh/app close.
let currentShuffledImages = shuffleArray(UNSPLASH_IMAGES);

const ProductCard = ({ product, onGetThis }) => {
    const { unit } = useUnit();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const liked = isInWishlist(product.id);
    const [hovered, setHovered] = useState(false);

    return (
        <div 
            className="group relative flex flex-col gap-3 cursor-pointer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative overflow-hidden bg-white flex items-center justify-center border border-stone-200/50" style={{ aspectRatio: '1 / 1' }}>
                <img
                    src={getThumbnailUrl(product.image)}
                    alt={product.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div className={`absolute inset-0 bg-stone-50/20 flex items-center justify-center gap-3 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onGetThis(product); }}
                        className="px-6 py-2.5 bg-white/70 backdrop-blur-md text-stone-900 border border-white/60 hover:bg-white/90 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 shadow-sm rounded-sm"
                    >
                        Get This
                    </button>
                </div>
                <button 
                    onClick={e => { e.stopPropagation(); toggleWishlist(product); }}
                    className={`absolute top-2.5 right-2.5 p-1.5 transition-colors duration-200 z-10 ${liked ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
                    aria-label="Save"
                >
                    <Heart size={13} fill={liked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                </button>
            </div>
            
            <div className="flex flex-col gap-1 px-1">
                <div className="flex justify-between items-start gap-4">
                    <h3 className="text-sm text-stone-900 font-medium leading-tight">{product.title}</h3>
                </div>
                <p className="text-[10px] text-stone-500 font-light leading-snug">{formatDimensions(product.dims, unit)}</p>
                <p className="text-xs text-stone-500">{product.artist}</p>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mt-1">
                    <button onClick={() => onGetThis(product)} className="text-stone-900 hover:text-stone-700 font-bold transition-colors duration-150">Get This</button>
                </div>
            </div>
        </div>
    );
};

const WebImagesPage = ({ setProductMode, setSelectedFrame, setSelectedSize, navigate, isSubPage = false, disableWindowScroll = false }) => {
    const [shuffledImages, setShuffledImages] = useState(currentShuffledImages);
    const [loading, setLoading] = useState(false);
    
    // Pagination state — persisted so navigating away (e.g. to customize a
    // selection) and back to Inspiration restores the same page instead of
    // resetting (the shuffle order itself already survives via module state).
    const [currentPage, setCurrentPage] = useState(() => parseInt(sessionStorage.getItem('fw_web_page') || '1', 10));
    const itemsPerPage = 24;

    useEffect(() => { sessionStorage.setItem('fw_web_page', currentPage.toString()); }, [currentPage]);

    // disableWindowScroll is true only inside the in-studio Inspiration
    // modal, where window isn't the real scroll container — isSubPage
    // alone isn't enough (it's also true on the real /inspiration route,
    // where window IS the real scroll container).
    const scrollToTop = () => { if (!disableWindowScroll) window.scrollTo({ top: 0, behavior: 'smooth' }); };

    // Trigger state sync if UNSPLASH_IMAGES updates (e.g. after background download completes)
    useEffect(() => {
        if (shuffledImages.length === 0 && UNSPLASH_IMAGES.length > 0) {
            const initialShuffled = shuffleArray(UNSPLASH_IMAGES);
            currentShuffledImages = initialShuffled;
            setShuffledImages(initialShuffled);
        }
    }, [shuffledImages]);

    // Use the shuffled Unsplash local images
    const images = useMemo(() => {
        return shuffledImages.map((imgObj, i) => ({
            id: imgObj.id,
            title: `Unsplash Collection #${i + 1}`,
            artist: imgObj.artist || 'Unsplash Contributor',
            image: `https://res.cloudinary.com/uucoqdzr/image/upload/unsplash_collection/${imgObj.filename}`,
            productionImage: `https://res.cloudinary.com/uucoqdzr/image/upload/unsplash_collection/${imgObj.filename}`,
            description: `Beautiful high-resolution photograph by ${imgObj.artist || 'Unsplash Contributor'}.`,
            dims: WEB_MET_DIMS[imgObj.filename] || '40 x 50 cm'
        }));
    }, [shuffledImages]);

    const handleShuffle = () => {
        setLoading(true);
        const newShuffled = shuffleArray(UNSPLASH_IMAGES);
        currentShuffledImages = newShuffled;
        setShuffledImages(newShuffled);
        setCurrentPage(1);
        
        // Brief loading animation to simulate fetching new batch
        setTimeout(() => {
            setLoading(false);
            scrollToTop();
        }, 800);
    };

    useEffect(() => {
        scrollToTop();
    }, [currentPage]);

    const handleGetThis = (product) => {
        const defaultFrame = FRAME_STYLES.find(f => f.id === 'frame-10512') || FRAME_STYLES[0];
        const defaultSize = parseCustomSize(product.dims) || findSizeByDimension(product.dims) || FRAME_SIZES.find(s => s.id === '16x20') || FRAME_SIZES[0];
        
        setProductMode('frame');
        setSelectedFrame(defaultFrame);
        setSelectedSize(defaultSize);
        
        navigate('/frame/customize', {
            state: {
                presetImage: product.productionImage,
                presetTitle: product.title,
                initialFrame: defaultFrame,
                initialSize: defaultSize,
                orientation: defaultSize?.orientation,
            }
        });
    };

    // Calculate pagination
    const totalPages = Math.ceil(images.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentImages = images.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className={isSubPage ? "text-stone-900" : "min-h-screen bg-[#faf9f8] text-stone-900"} style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* HEADER */}
            <header className="border-b border-stone-200">
                <div className={`max-w-[2560px] mx-auto px-6 md:px-12 pb-4 ${isSubPage ? 'pt-1' : 'pt-8'}`}>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1">Web Collection</p>
                            <h1 className="font-serif font-light text-xl md:text-2xl text-stone-900 tracking-tight leading-none mb-2">
                                Web Images
                            </h1>
                            <p className="text-sm text-stone-500 font-light max-w-lg leading-relaxed">
                                A curated selection of high-resolution AI-generated and web-sourced inspirational images. Ready to be framed.
                            </p>
                        </div>
                        <div className="shrink-0 text-right flex flex-col items-end">
                            <p className="text-[9px] uppercase tracking-[0.28em] text-stone-400 mb-1">COLLECTION</p>
                            <p className="font-serif text-3xl text-stone-900 font-light leading-none mb-3">
                                {images.length}<span className="text-xs text-stone-500 font-light ml-1">images</span>
                            </p>
                            <button
                                onClick={handleShuffle}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-stone-200 shadow-sm bg-white hover:bg-stone-50 text-[10px] font-bold uppercase tracking-wider text-stone-600 transition-all active:scale-95"
                            >
                                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                                Shuffle Gallery
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-6 pb-12">
                {images.length === 0 ? (
                    <div className="w-full flex flex-col items-center justify-center py-20 text-stone-400">
                        <RefreshCw size={24} className="animate-spin mb-4" />
                        <p className="text-sm font-medium">Preparing local image collection...</p>
                        <p className="text-xs text-stone-500 mt-1">Please wait, downloading high-res images to your app folder.</p>
                    </div>
                ) : loading ? (
                    <div className="w-full flex justify-center py-20">
                        <div className="animate-pulse flex gap-2">
                            <div className="w-2 h-2 bg-stone-300 rounded-full"></div>
                            <div className="w-2 h-2 bg-stone-300 rounded-full animation-delay-200"></div>
                            <div className="w-2 h-2 bg-stone-300 rounded-full animation-delay-400"></div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
                            {currentImages.map((product) => (
                                <ProductCard 
                                    key={product.id} 
                                    product={product} 
                                    onGetThis={handleGetThis}
                                />
                            ))}
                        </div>
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-16 border-t border-stone-200 pt-8">
                                <button 
                                    onClick={() => {
                                        setCurrentPage(p => Math.max(1, p - 1));
                                        scrollToTop();
                                    }}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900 disabled:opacity-50 transition-colors"
                                >
                                    Previous
                                </button>
                                
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => {
                                                    setCurrentPage(pageNum);
                                                    scrollToTop();
                                                }}
                                                className={`w-8 h-8 flex items-center justify-center rounded-sm text-sm transition-colors ${
                                                    currentPage === pageNum 
                                                    ? 'bg-stone-900 text-white' 
                                                    : 'text-stone-500 hover:bg-stone-200'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <button 
                                    onClick={() => {
                                        setCurrentPage(p => Math.min(totalPages, p + 1));
                                        scrollToTop();
                                    }}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900 disabled:opacity-50 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default WebImagesPage;
