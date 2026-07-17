import React, { useState, useEffect, useMemo } from 'react';
import { Heart, RefreshCw, ChevronDown } from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES, findSizeByDimension, formatDimensions } from '../data/constants';
import { useUnit } from '../context/UnitContext';
import { MET_LOCAL_COLLECTIONS } from '../data/metLocal';
import WEB_MET_DIMS from '../data/web_met_dims.json';
import { getThumbnailUrl } from '../services/storage';

const PRIMARY_COLLECTIONS_ORDER = [
    'Classic Masterpieces',
    'Claude Monet',
    'Drawings and Prints',
    'European Paintings',
    'Japanese Prints',
    'Photographs',
    'Vincent van Gogh'
];

const COLLECTION_LABELS = {
    'Vincent van Gogh': 'Van Gogh',
    'Modern and Contemporary Art': 'Modern & Contemporary Art'
};

const MetProductCard = ({ product, onGetThis }) => {
    const { unit } = useUnit();
    const [hovered, setHovered] = useState(false);
    const [liked, setLiked] = useState(false);

    const filename = product.image.split('/').pop();
    const dims = WEB_MET_DIMS[filename] || '40 x 50 cm';

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
                    onClick={e => { e.stopPropagation(); setLiked(l => !l); }} 
                    className={`absolute top-2.5 right-2.5 p-1.5 transition-colors duration-200 z-10 ${liked ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
                >
                    <Heart size={13} fill={liked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                </button>
            </div>
            
            <div className="flex flex-col gap-1 px-1">
                <h3 className="text-sm text-stone-900 font-medium leading-tight truncate" title={product.title}>{product.title}</h3>
                <p className="text-xs text-stone-500 truncate">{product.artist}</p>
                <p className="text-[10px] text-stone-500 font-light leading-snug">{formatDimensions(dims, unit, product.orientation)}</p>
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

    // Get all collections that have at least 1 downloaded file
    const availableCollections = useMemo(() => {
        return Object.keys(MET_LOCAL_COLLECTIONS).filter(
            key => MET_LOCAL_COLLECTIONS[key] && MET_LOCAL_COLLECTIONS[key].length > 0
        );
    }, []);

    // Categorize into Primary (paintings/prints) and Secondary (others)
    // Primary tabs are ALWAYS displayed in the user-specified order
    const primary = PRIMARY_COLLECTIONS_ORDER;
            
    const secondary = useMemo(() => {
        return Object.keys(MET_LOCAL_COLLECTIONS).filter(
            c => !PRIMARY_COLLECTIONS_ORDER.includes(c) && MET_LOCAL_COLLECTIONS[c] && MET_LOCAL_COLLECTIONS[c].length > 0
        );
    }, [availableCollections]);

    // Initial selected category
    const [activeCategory, setActiveCategory] = useState(primary[0]);
    const [secondarySelected, setSecondarySelected] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 24;

    const currentArtworks = useMemo(() => {
        if (!activeCategory || !MET_LOCAL_COLLECTIONS[activeCategory]) return [];
        return MET_LOCAL_COLLECTIONS[activeCategory];
    }, [activeCategory]);

    const handleCategoryChange = (cat, isSecondary = false) => {
        setActiveCategory(cat);
        setCurrentPage(1);
        if (!isSecondary) {
            setSecondarySelected(''); // reset dropdown
        }
    };

    const handleGetThis = (product) => {
        if (onSelect) {
            onSelect(product);
            return;
        }
        setProductMode('frame');
        const filename = product.image.split('/').pop();
        const dims = WEB_MET_DIMS[filename] || '40 x 50 cm';
        
        const frameObj = FRAME_STYLES.find(f => f.id === 'frame-10512') || FRAME_STYLES[0];
        if (frameObj) setSelectedFrame(frameObj);
        
        const sizeObj = findSizeByDimension(dims) || FRAME_SIZES.find(s => s.id === '16x20') || FRAME_SIZES[0];
        if (sizeObj) setSelectedSize(sizeObj);

        navigate('/frame/customize', {
            state: {
                presetImage: product.image,
                presetTitle: product.title,
                initialFrame: frameObj || null,
                initialSize: sizeObj || null,
                orientation: product.orientation || sizeObj?.orientation
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

    if (availableCollections.length === 0) {
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
                <div className={`max-w-screen-xl mx-auto px-6 md:px-12 pb-4 ${isSubPage ? 'pt-1' : 'pt-8'}`}>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1">Met Museum Archive</p>
                            <h1 className="font-serif font-light text-xl md:text-2xl text-stone-900 tracking-tight leading-none mb-2">
                                Met Museum Collection
                            </h1>
                            <p className="text-sm text-stone-500 font-light max-w-lg leading-relaxed">
                                Statically served public domain masterpieces from the Metropolitan Museum of Art. Ready to be previewed and framed.
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-[9px] uppercase tracking-[0.28em] text-stone-400 mb-1">COLLECTION</p>
                            <p className="font-serif text-3xl text-stone-900 font-light leading-none">
                                {availableCollections.length} <span className="text-xs text-stone-500 font-light ml-1">categories</span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Categories Navigation */}
            <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-12 z-20 py-3 mt-1">
                <div className="max-w-screen-xl mx-auto px-6 md:px-12 flex items-center gap-2 overflow-x-auto no-scrollbar after:content-[''] after:pr-6 md:after:pr-12">
                    {primary.map(cat => (
                        <button
                            key={cat}
                            onClick={() => handleCategoryChange(cat)}
                            className={`flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                                activeCategory === cat && secondarySelected === ''
                                    ? 'bg-stone-900 text-white shadow-md'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                            }`}
                        >
                            {COLLECTION_LABELS[cat] || cat}
                        </button>
                    ))}

                    {secondary.length > 0 && (
                        <div className="relative flex-shrink-0 flex items-center">
                            <select
                                value={secondarySelected}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSecondarySelected(val);
                                    handleCategoryChange(val, true);
                                }}
                                className={`appearance-none w-20 pl-4 pr-6 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 outline-none border cursor-pointer ${
                                    secondarySelected !== ''
                                        ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                                        : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border-stone-200'
                                }`}
                            >
                                <option value="" disabled className="text-stone-400">More</option>
                                {secondary.map(cat => (
                                    <option key={cat} value={cat} className="text-stone-850 bg-white">
                                        {COLLECTION_LABELS[cat] || cat}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown 
                                size={10} 
                                strokeWidth={2.5}
                                className={`absolute right-2.5 pointer-events-none transition-colors ${
                                    secondarySelected !== '' ? 'text-white' : 'text-stone-500'
                                }`}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Artwork Grid */}
            <main className="max-w-screen-xl mx-auto px-6 md:px-12 pt-8 pb-12">
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

export default MetArtPage;
