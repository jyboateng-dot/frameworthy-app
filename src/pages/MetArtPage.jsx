import React, { useState, useEffect, useMemo } from 'react';
import { Heart, RefreshCw } from 'lucide-react';
import { formatDimensions } from '../data/constants';
import { useUnit } from '../context/UnitContext';
import { useWishlist } from '../context/WishlistContext';
import { MET_LOCAL_COLLECTIONS } from '../data/metLocal';
import { getThumbnailUrl } from '../services/storage';
import CollectionPagination from '../components/common/CollectionPagination';
import { getMetArtworkPixelSize, getMetRecommendedSize, isMetArtworkPrintable, getSortedMetCategories } from '../utils/metArtworkSizing';
import { maxFramePrintSize } from '../utils/maxFramePrintSize';

const COLLECTION_LABELS = {
    'Vincent van Gogh': 'Van Gogh',
    'Modern and Contemporary Art': 'Modern & Contemporary Art'
};

const MetProductCard = ({ product, onGetThis }) => {
    const { unit } = useUnit();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const liked = isInWishlist(product.id);
    const [hovered, setHovered] = useState(false);

    const maxSize = useMemo(() => maxFramePrintSize(getMetArtworkPixelSize(product)), [product]);

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
                <h3 className="text-sm text-stone-900 font-medium leading-tight truncate" title={product.title}>{product.title}</h3>
                <p className="text-xs text-stone-500 truncate">{product.artist}</p>
                {maxSize && (
                    <p className="text-[10px] text-stone-500 font-light leading-snug">Max frame size {formatDimensions(maxSize.label, unit, maxSize.orientation)}</p>
                )}
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mt-1">
                    <button onClick={() => onGetThis(product)} className="text-stone-900 hover:text-stone-700 font-bold transition-colors duration-150">Get This</button>
                </div>
            </div>
        </div>
    );
};

const MetArtPage = ({ setProductMode, setSelectedFrame, setSelectedSize, navigate, isSubPage = false, onSelect = null, disableWindowScroll = false }) => {
    // disableWindowScroll is true only inside the in-studio Inspiration
    // modal, where window isn't the real scroll container — isSubPage
    // alone isn't enough (it's also true on the real /inspiration route,
    // where window IS the real scroll container).
    const scrollToTop = () => { if (!disableWindowScroll) window.scrollTo({ top: 0, behavior: 'smooth' }); };

    // Collections sorted such that categories with the biggest max frame sizes appear first
    const categories = useMemo(() => getSortedMetCategories(MET_LOCAL_COLLECTIONS), []);

    // Initial selected category — persisted so navigating away (e.g. to
    // customize a selection) and back to Inspiration restores the same
    // category/page instead of resetting.
    const [activeCategory, setActiveCategory] = useState(() => {
        const saved = sessionStorage.getItem('fw_met_category');
        return (saved && categories.includes(saved)) ? saved : (categories[0] || '');
    });
    const [currentPage, setCurrentPage] = useState(() => parseInt(sessionStorage.getItem('fw_met_page') || '1', 10));
    const itemsPerPage = 24;

    useEffect(() => { sessionStorage.setItem('fw_met_category', activeCategory || ''); }, [activeCategory]);
    useEffect(() => { sessionStorage.setItem('fw_met_page', currentPage.toString()); }, [currentPage]);

    const currentArtworks = useMemo(() => {
        if (!activeCategory || !MET_LOCAL_COLLECTIONS[activeCategory]) return [];
        return MET_LOCAL_COLLECTIONS[activeCategory].filter(isMetArtworkPrintable);
    }, [activeCategory]);

    const handleCategoryChange = (cat) => {
        setActiveCategory(cat);
        setCurrentPage(1);
    };

    const handleGetThis = (product) => {
        if (onSelect) {
            onSelect(product);
            return;
        }
        setProductMode('frame');
        const pixelSize = getMetArtworkPixelSize(product);
        const maxSize = maxFramePrintSize(pixelSize);
        const sizeObj = maxSize || getMetRecommendedSize(product);
        const orientation = maxSize?.orientation || product.orientation || sizeObj?.orientation;
        if (sizeObj && setSelectedSize) setSelectedSize(sizeObj);

        navigate('/frame/customize', {
            state: {
                presetImage: product.image,
                presetTitle: product.title,
                initialSize: sizeObj || null,
                imageWidth: pixelSize?.w || null,
                imageHeight: pixelSize?.h || null,
                orientation
            }
        });
    };

    // Pagination
    const totalPages = Math.ceil(currentArtworks.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedArtworks = currentArtworks.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        scrollToTop();
    }, [currentPage]);

    if (categories.length === 0) {
        return (
            <div className="w-full flex flex-col items-center justify-center py-20 text-stone-400">
                <RefreshCw size={24} className="animate-spin mb-4" />
                <p className="text-sm font-medium">Preparing local Met Art collection...</p>
                <p className="text-xs text-stone-500 mt-1">Please wait, downloading masterpieces in the background.</p>
            </div>
        );
    }

    return (
        <div className={isSubPage ? "text-stone-900" : "min-h-screen bg-[#faf9f8] text-stone-900"} style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <header className="border-b border-stone-200">
                <div className={`max-w-[2560px] mx-auto px-6 md:px-12 pb-4 ${isSubPage ? 'pt-1' : 'pt-8'}`}>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1">Met Museum Archive</p>
                            <h1 className="font-serif font-light text-2xl md:text-3xl text-stone-900 tracking-tight leading-none mb-2">
                                Met Museum Collection
                            </h1>
                            <p className="text-sm text-stone-500 font-light max-w-lg leading-relaxed">
                                Statically served public domain masterpieces from the Metropolitan Museum of Art. Ready to be previewed and framed.
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-[9px] uppercase tracking-[0.28em] text-stone-400 mb-1">COLLECTION</p>
                            <p className="font-serif text-3xl text-stone-900 font-light leading-none">
                                {categories.length} <span className="text-xs text-stone-500 font-light ml-1">categories</span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Categories Navigation */}
            <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-12 z-20 py-3 mt-1">
                <div className="max-w-[2560px] mx-auto px-6 md:px-12 flex items-center gap-2 overflow-x-auto no-scrollbar after:content-[''] after:pr-6 md:after:pr-12">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => handleCategoryChange(cat)}
                            className={`flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                                activeCategory === cat
                                    ? 'bg-stone-900 text-white shadow-md'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                            }`}
                        >
                            {COLLECTION_LABELS[cat] || cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Artwork Grid */}
            <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-8 pb-12">
                {currentArtworks.length === 0 ? (
                    <div className="w-full flex flex-col items-center justify-center py-24 text-stone-400">
                        <RefreshCw size={24} className="animate-spin mb-4" />
                        <p className="text-sm font-medium">Downloading "{COLLECTION_LABELS[activeCategory] || activeCategory}" collection...</p>
                        <p className="text-xs text-stone-500 mt-1">Please wait, the background downloader is processing this folder.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
                            {paginatedArtworks.map(product => (
                                <MetProductCard 
                                    key={product.id}
                                    product={product}
                                    onGetThis={handleGetThis}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        <CollectionPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={nextPage => { setCurrentPage(nextPage); scrollToTop(); }}
                        />
                    </>
                )}
            </main>
        </div>
    );
};

export default MetArtPage;
