import React, { useState, useEffect, useMemo } from 'react';
import { Heart, Search, ChevronLeft, ChevronRight, Loader2, Music } from 'lucide-react';
import { FRAME_SIZES } from '../data/constants';
import { useWishlist } from '../context/WishlistContext';
import { fetchAlbumPosterData } from '../utils/albumPoster';

// We'll import ALBUMS_LOCAL_COLLECTIONS but it might be empty initially until the background script finishes
import { ALBUMS_LOCAL_COLLECTIONS } from '../data/albumsLocal';
import { getThumbnailUrl } from '../services/storage';

const GENRES = ['Pop', 'HipHop', 'Rock', 'R&B', 'Blues', 'Jazz', 'Indie', 'Afro Pop', 'African', 'Reggae', 'Dancehall'];

const AlbumProductCard = ({ product, onGetThis }) => {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const liked = isInWishlist(product.id);
    const [hovered, setHovered] = useState(false);

    return (
        <div 
            className="group relative flex flex-col gap-3 cursor-pointer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative overflow-hidden bg-white flex items-center justify-center border border-stone-200/50 shadow-sm" style={{ aspectRatio: '1 / 1' }}>
                <img
                    src={getThumbnailUrl(product.image)}
                    alt={product.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div className={`absolute inset-0 bg-stone-900/10 flex items-center justify-center gap-3 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onGetThis(product); }}
                        className="px-6 py-2.5 bg-white/90 backdrop-blur-md text-stone-900 border border-white/60 hover:bg-white text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 shadow-sm rounded-full"
                    >
                        Get This
                    </button>
                </div>
                <button 
                    onClick={e => { e.stopPropagation(); toggleWishlist(product); }}
                    className={`absolute top-3 right-3 p-2 bg-white/50 backdrop-blur-sm rounded-full transition-colors duration-200 z-10 ${liked ? 'text-red-500' : 'text-stone-600 hover:text-stone-900'}`}
                    aria-label="Save"
                >
                    <Heart size={14} fill={liked ? 'currentColor' : 'none'} strokeWidth={2} />
                </button>
            </div>
            
            <div className="flex flex-col px-1">
                <h3 className="text-sm font-bold text-stone-900 leading-tight truncate" title={product.title}>{product.title}</h3>
                <p className="text-xs text-stone-500 truncate mt-0.5">{product.artist}</p>
                {product.year && <p className="text-[10px] text-stone-600 mt-1">{product.year}</p>}
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mt-1">
                    <button onClick={() => onGetThis(product)} className="text-stone-900 hover:text-stone-700 font-bold transition-colors duration-150">Get This</button>
                </div>
            </div>
        </div>
    );
};

const AlbumArtPage = ({ setProductMode, setSelectedSize, navigate, isSubPage = false, initialSelectedProduct = null, onConsumedInitialSelection, disableWindowScroll = false }) => {
    // disableWindowScroll is true only inside the in-studio Inspiration
    // modal, where window isn't the real scroll container — isSubPage
    // alone isn't enough (it's also true on the real /inspiration route,
    // where window IS the real scroll container).
    const scrollToTop = () => { if (!disableWindowScroll) window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('fw_album_tab') || 'Pop'); // Can be 'Search' or a genre
    const [activeArtist, setActiveArtist] = useState(() => sessionStorage.getItem('fw_album_artist') || 'All');

    // Search state
    const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('fw_album_search') || '');
    const [searchResults, setSearchResults] = useState(() => {
        const saved = sessionStorage.getItem('fw_album_results');
        return saved ? JSON.parse(saved) : [];
    });
    const [isSearching, setIsSearching] = useState(false);

    // Framing style choice modal — pre-opened when arriving via the
    // cross-category Search tab with a specific album already picked.
    const [selectedProduct, setSelectedProduct] = useState(() => initialSelectedProduct);
    const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);

    useEffect(() => {
        if (initialSelectedProduct && onConsumedInitialSelection) onConsumedInitialSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Pagination
    const [currentPage, setCurrentPage] = useState(() => parseInt(sessionStorage.getItem('fw_album_page') || '1', 10));
    const itemsPerPage = 24;

    // Persist state
    useEffect(() => { sessionStorage.setItem('fw_album_tab', activeTab); }, [activeTab]);
    useEffect(() => { sessionStorage.setItem('fw_album_artist', activeArtist); }, [activeArtist]);
    useEffect(() => { sessionStorage.setItem('fw_album_search', searchQuery); }, [searchQuery]);
    useEffect(() => { sessionStorage.setItem('fw_album_results', JSON.stringify(searchResults)); }, [searchResults]);
    useEffect(() => { sessionStorage.setItem('fw_album_page', currentPage.toString()); }, [currentPage]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        
        setIsSearching(true);
        setCurrentPage(1);
        
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=album&limit=50`);
            const data = await response.json();
            
            const processed = (data.results || []).map(item => ({
                id: item.collectionId.toString(),
                title: item.collectionName,
                artist: item.artistName,
                image: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '1000x1000bb') : '',
                year: item.releaseDate ? item.releaseDate.substring(0, 4) : ''
            })).filter(item => item.image); // Must have an image
            
            // Deduplicate
            const seen = new Set();
            const unique = [];
            for (const item of processed) {
                const cleanTitle = item.title.toLowerCase().replace(/[([].*?[)\]]/g, '').trim();
                if (!seen.has(cleanTitle)) {
                    seen.add(cleanTitle);
                    unique.push(item);
                }
            }
            
            setSearchResults(unique);
        } catch (err) {
            console.error("Failed to search albums", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleGetThis = (product) => {
        setSelectedProduct(product);
    };

    const handleChooseStyle = async (product, style) => {
        if (style === 'cover') {
            setSelectedProduct(null);
            setProductMode('frame');

            const sizeObj = FRAME_SIZES.find(s => s.id === '12x12') || FRAME_SIZES[4];
            if (sizeObj) setSelectedSize(sizeObj);

            navigate('/frame/customize', {
                state: {
                    presetImage: product.image,
                    presetTitle: product.title,
                    initialSize: sizeObj || null,
                    orientation: 'portrait',
                    initialMatWidth: 'none',
                    isAlbumArt: true
                }
            });
            return;
        }

        // style === 'poster'
        setIsGeneratingPoster(true);
        try {
            const posterData = await fetchAlbumPosterData(product);

            setSelectedProduct(null);
            setProductMode('frame');

            // Default to a large portrait size — the poster layout adapts to any
            // portrait aspect ratio, this is just a sensible starting point.
            const sizeObj = FRAME_SIZES.find(s => s.id === '24x36') || FRAME_SIZES[0];
            if (sizeObj) setSelectedSize(sizeObj);

            navigate('/frame/customize', {
                state: {
                    posterData,
                    presetTitle: `${product.title} Poster`,
                    initialSize: sizeObj || null,
                    orientation: 'portrait',
                    initialMatWidth: 'none',
                    isAlbumPoster: true
                }
            });
        } catch (err) {
            console.error('Failed to generate poster:', err);
            alert('Failed to fetch album tracklist. Please try again.');
        } finally {
            setIsGeneratingPoster(false);
        }
    };

    // Determine current artworks to display
    const currentArtworks = useMemo(() => {
        if (activeTab === 'Search') {
            return searchResults;
        } else {
            if (ALBUMS_LOCAL_COLLECTIONS && ALBUMS_LOCAL_COLLECTIONS[activeTab]) {
                const genreData = ALBUMS_LOCAL_COLLECTIONS[activeTab];
                if (activeArtist === 'All') {
                    // Flatten all arrays of albums into one array
                    const allAlbums = Object.values(genreData).flat();
                    // Deduplicate by ID just in case
                    const uniqueAlbumsMap = new Map();
                    allAlbums.forEach(album => {
                        if (!uniqueAlbumsMap.has(album.id)) {
                            uniqueAlbumsMap.set(album.id, album);
                        }
                    });
                    const uniqueAlbums = Array.from(uniqueAlbumsMap.values());
                    
                    // Sort alphabetically by title
                    return uniqueAlbums.sort((a, b) => a.title.localeCompare(b.title));
                } else if (genreData[activeArtist]) {
                    return genreData[activeArtist];
                }
            }
            return [];
        }
    }, [activeTab, activeArtist, searchResults]);

    const totalPages = Math.ceil(currentArtworks.length / itemsPerPage);
    const paginatedArtworks = currentArtworks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Only surface the top 10 artist sub-tabs per genre (down from all ~20
    // downloaded) to keep this row from getting too crowded — the full set
    // stays in ALBUMS_LOCAL_COLLECTIONS/on disk and is still reachable via
    // the "All" tab, this just trims the individual filter buttons shown.
    const availableArtists = activeTab !== 'Search' && ALBUMS_LOCAL_COLLECTIONS && ALBUMS_LOCAL_COLLECTIONS[activeTab]
        ? ['All', ...Object.keys(ALBUMS_LOCAL_COLLECTIONS[activeTab]).slice(0, 10)]
        : [];

    return (
        <div className={isSubPage ? "text-stone-900" : "min-h-screen bg-[#faf9f8] text-stone-900"} style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <header className="border-b border-stone-200">
                <div className={`max-w-[2560px] mx-auto px-6 md:px-12 pb-3 sm:pb-6 ${isSubPage ? 'pt-1' : 'pt-8'}`}>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1 sm:mb-2 flex items-center gap-2">
                                Album Covers
                            </p>
                            <h1 className="font-serif font-light text-2xl md:text-3xl text-stone-900 tracking-tight leading-none mb-1 sm:mb-3">
                                Album Artwork
                            </h1>
                            <p className="hidden sm:block text-sm text-stone-500 font-light max-w-xl leading-relaxed">
                                Curated high-resolution album covers from the top artists across Pop, Hip-Hop, Rock, and more. Or, search for your favorite record to frame.
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-[60px] z-20 py-2 sm:py-3 mt-1">
                <div className="max-w-[2560px] mx-auto px-6 md:px-12 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    
                    <button
                        onClick={() => { setActiveTab('Search'); setCurrentPage(1); }}
                        className={`flex-shrink-0 flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                            activeTab === 'Search'
                                ? 'bg-stone-900 text-white shadow-md'
                                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                        }`}
                    >
                        <Search size={14} /> Search
                    </button>
                    
                    <div className="w-px h-6 bg-stone-200 mx-2 flex-shrink-0" />

                    {GENRES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => { 
                                setActiveTab(cat); 
                                setActiveArtist('All'); 
                                setCurrentPage(1); 
                            }}
                            className={`flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                                activeTab === cat
                                    ? 'bg-stone-900 text-white shadow-md'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Sub-navigation for Artists or Search Bar */}
                <div className="max-w-[2560px] mx-auto px-6 md:px-12 mt-2 sm:mt-4">
                    {activeTab === 'Search' ? (
                        <form onSubmit={handleSearch} className="max-w-md relative">
                            <input 
                                type="text" 
                                placeholder="Search any artist or album name..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-24 py-3 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:border-stone-900 transition-all shadow-sm"
                            />
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                            <button 
                                type="submit"
                                disabled={isSearching || !searchQuery.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-stone-900 text-white text-xs font-bold rounded-lg hover:bg-stone-800 disabled:opacity-50 transition-colors"
                            >
                                {isSearching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
                            </button>
                        </form>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {availableArtists.map(artist => (
                                <button
                                    key={artist}
                                    onClick={() => { setActiveArtist(artist); setCurrentPage(1); }}
                                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                                        activeArtist === artist 
                                            ? 'bg-stone-200 text-stone-900' 
                                            : 'bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                                    }`}
                                >
                                    {artist}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Grid */}
            <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-8 pb-16">
                {currentArtworks.length === 0 ? (
                    <div className="w-full flex flex-col items-center justify-center py-24 text-stone-600">
                        {activeTab === 'Search' ? (
                            <>
                                <Search size={32} className="mb-4 text-stone-300" />
                                <p className="text-sm font-medium">Search for an album to begin</p>
                            </>
                        ) : (
                            <>
                                <Loader2 size={24} className="animate-spin mb-4" />
                                <p className="text-sm font-medium">Fetching discography...</p>
                                <p className="text-xs text-stone-500 mt-1">If this persists, the background download is still running.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
                            {paginatedArtworks.map((product, idx) => (
                                <AlbumProductCard 
                                    key={product.id + idx}
                                    product={product}
                                    onGetThis={handleGetThis}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-16 border-t border-stone-200 pt-8">
                                <button 
                                    onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); scrollToTop(); }}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900 disabled:opacity-50 transition-colors"
                                >
                                    Previous
                                </button>
                                
                                <div className="flex gap-1 min-w-0 max-w-full overflow-x-auto no-scrollbar">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                        <button
                                            key={pageNum}
                                            onClick={() => { setCurrentPage(pageNum); scrollToTop(); }}
                                            className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-sm text-sm transition-colors ${
                                                currentPage === pageNum
                                                ? 'bg-stone-900 text-white'
                                                : 'text-stone-500 hover:bg-stone-200'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                </div>
                                
                                <button 
                                    onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); scrollToTop(); }}
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

            {/* Choose Framing Style Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-8 relative overflow-y-auto max-h-[90vh]">
                        <button
                            onClick={() => setSelectedProduct(null)}
                            className="absolute top-4 right-4 p-2 text-stone-600 hover:text-stone-900 transition-colors"
                            aria-label="Close"
                        >
                            ✕
                        </button>

                        <h2 className="text-2xl font-serif mb-6 text-stone-900">Choose Framing Style</h2>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Square Cover Option */}
                            <button
                                onClick={() => handleChooseStyle(selectedProduct, 'cover')}
                                disabled={isGeneratingPoster}
                                className="group flex flex-col items-center gap-4 p-4 rounded-xl border border-stone-200 hover:border-stone-900 transition-all text-center disabled:opacity-50"
                            >
                                <div className="w-[85%] mx-auto aspect-square bg-stone-100 p-4 rounded-lg flex items-center justify-center">
                                    <div className="w-full aspect-square bg-white shadow-sm border border-stone-200 flex items-center justify-center overflow-hidden">
                                        <img src={selectedProduct.image} alt={selectedProduct.title} className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-stone-900 group-hover:text-stone-600 transition-colors">Square Cover</h3>
                                    <p className="text-xs text-stone-500 mt-1">Classic 1:1 format focusing purely on the iconic artwork.</p>
                                </div>
                            </button>

                            {/* Poster Print Option */}
                            <button
                                onClick={() => handleChooseStyle(selectedProduct, 'poster')}
                                disabled={isGeneratingPoster}
                                className="group flex flex-col items-center gap-4 p-4 rounded-xl border border-stone-200 hover:border-stone-900 transition-all text-center disabled:opacity-50"
                            >
                                <div className="w-[60%] mx-auto aspect-[2/3] bg-stone-100 p-4 rounded-lg flex items-center justify-center relative">
                                    <div className="w-full aspect-[2/3] bg-white shadow-sm border border-stone-200 flex flex-col p-2 gap-2">
                                        <img src={selectedProduct.image} alt={selectedProduct.title} className="w-full aspect-square object-cover bg-stone-200" />
                                        <div className="flex gap-2 h-full">
                                            <div className="w-1/2 h-full flex flex-col gap-0.5">
                                                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="w-full h-1 bg-stone-200 rounded-full" />)}
                                            </div>
                                            <div className="w-1/2 h-full flex flex-col gap-1 items-end">
                                                <div className="w-full h-2 bg-stone-300 rounded-sm" />
                                                <div className="w-3/4 h-1.5 bg-stone-200 rounded-sm" />
                                                <div className="w-full mt-auto flex gap-0.5">
                                                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="w-full aspect-square bg-stone-200" />)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {isGeneratingPoster && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 rounded-lg z-10">
                                            <Loader2 size={24} className="animate-spin text-stone-900" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900">Generating</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-stone-900 group-hover:text-stone-600 transition-colors">Poster Print</h3>
                                    <p className="text-xs text-stone-500 mt-1">Tracklist, color palette, and release metadata alongside the cover.</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlbumArtPage;
