import React, { useState, useEffect, useMemo } from 'react';
import { Heart, Search, Loader2, Film } from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES } from '../data/constants';
import { useWishlist } from '../context/WishlistContext';
import { fetchMoviePosterData } from '../utils/moviePoster';

import { MOVIES_LOCAL_COLLECTIONS } from '../data/moviesLocal';
import { getThumbnailUrl } from '../services/storage';

const DEFAULT_TAB = 'IMDB Top 200';
const GENRES = Object.keys(MOVIES_LOCAL_COLLECTIONS).filter(k => k !== DEFAULT_TAB);
const OMDB_API_KEY = 'trilogy';

// Minimum acceptable print quality for large-format wall art viewed from a
// normal distance (not held close) — sizes that would need upscaling past this
// (source pixels / print inches) are deprioritized in favor of a smaller size
// the poster's actual resolution can support cleanly.
const MIN_PRINT_DPI = 120;

function loadImageNaturalSize(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = url;
    });
}

// Picks the portrait FRAME_SIZES entry whose aspect ratio best matches the
// poster's actual aspect ratio, preferring sizes the poster's resolution can
// support at MIN_PRINT_DPI over ones that would require upscaling.
function pickBestFrameSize(naturalWidth, naturalHeight) {
    const imageRatio = naturalWidth / naturalHeight;

    const seen = new Set();
    const candidates = FRAME_SIZES.filter(s => {
        if (s.height <= s.width) return false; // portrait only, matches CustomizeFramePage's own filter
        const key = `${s.width}x${s.height}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const scored = candidates.map(size => ({
        size,
        ratioDiff: Math.abs((size.width / size.height) - imageRatio),
        fitsResolution: (size.width * MIN_PRINT_DPI) <= naturalWidth && (size.height * MIN_PRINT_DPI) <= naturalHeight
    }));

    const feasible = scored.filter(s => s.fitsResolution);
    const pool = feasible.length > 0 ? feasible : scored;
    // Only prefer the larger of two equally-good ratio matches when resolution
    // genuinely isn't a constraint (a bigger statement print, same reasoning as
    // the previous hardcoded 24x36 default). When falling back because NOTHING
    // is resolution-feasible (e.g. a ~300px search thumbnail), do the opposite —
    // prefer the smaller size, to minimize how far short of print quality it falls.
    const preferLarger = feasible.length > 0;

    // Sort by aspect-ratio closeness; among near-identical matches (many
    // portrait sizes share an exact 2:3 ratio, for instance), break ties per
    // preferLarger above.
    const RATIO_TIE_EPSILON = 0.005;
    pool.sort((a, b) => {
        const ratioDelta = a.ratioDiff - b.ratioDiff;
        if (Math.abs(ratioDelta) > RATIO_TIE_EPSILON) return ratioDelta;
        const areaDelta = (b.size.width * b.size.height) - (a.size.width * a.size.height);
        return preferLarger ? areaDelta : -areaDelta;
    });
    return pool[0]?.size || FRAME_SIZES.find(s => s.id === '24x36');
}

const MovieProductCard = ({ product, onGetThis }) => {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const liked = isInWishlist(product.id);
    const [hovered, setHovered] = useState(false);

    return (
        <div
            className="group relative flex flex-col gap-3 cursor-pointer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative overflow-hidden bg-white flex items-center justify-center border border-stone-200/50 shadow-sm" style={{ aspectRatio: '2 / 3' }}>
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
                {product.year && <p className="text-xs text-stone-500 truncate mt-0.5">{product.year}</p>}
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mt-1">
                    <button onClick={() => onGetThis(product)} className="text-stone-900 hover:text-stone-700 font-bold transition-colors duration-150">Get This</button>
                </div>
            </div>
        </div>
    );
};

const MoviePosterPage = ({ setProductMode, setSelectedFrame, setSelectedSize, navigate, isSubPage = false, initialSelectedProduct = null, onConsumedInitialSelection, disableWindowScroll = false }) => {
    // disableWindowScroll is true only inside the in-studio Inspiration
    // modal, where window isn't the real scroll container — isSubPage
    // alone isn't enough (it's also true on the real /inspiration route,
    // where window IS the real scroll container).
    const scrollToTop = () => { if (!disableWindowScroll) window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('fw_movie_tab') || DEFAULT_TAB);

    // Framing style choice modal — pre-opened when arriving via the
    // cross-category Search tab with a specific movie already picked.
    const [selectedProduct, setSelectedProduct] = useState(() => initialSelectedProduct);
    // Which style is currently being prepared ('original' | 'print' | null) —
    // both styles now involve async work (dimension detection / OMDb + palette
    // fetch), so the loading indicator needs to know which button to show it on.
    const [generatingStyle, setGeneratingStyle] = useState(null);

    useEffect(() => {
        if (initialSelectedProduct && onConsumedInitialSelection) onConsumedInitialSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Search state
    const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('fw_movie_search') || '');
    const [searchResults, setSearchResults] = useState(() => {
        const saved = sessionStorage.getItem('fw_movie_results');
        return saved ? JSON.parse(saved) : [];
    });
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(() => parseInt(sessionStorage.getItem('fw_movie_page') || '1', 10));
    const itemsPerPage = 24;

    // Persist state
    useEffect(() => { sessionStorage.setItem('fw_movie_tab', activeTab); }, [activeTab]);
    useEffect(() => { sessionStorage.setItem('fw_movie_search', searchQuery); }, [searchQuery]);
    useEffect(() => { sessionStorage.setItem('fw_movie_results', JSON.stringify(searchResults)); }, [searchResults]);
    useEffect(() => { sessionStorage.setItem('fw_movie_page', currentPage.toString()); }, [currentPage]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchError(false);
        setCurrentPage(1);

        try {
            // OMDb caps at 10 results per page — fetch several pages in parallel
            // to get a result count comparable to the other Inspiration categories.
            // Promise.allSettled (not Promise.all + a per-request .catch that
            // swallows failures into {Search: []}) so a total API outage can be
            // told apart from a legitimate "no movies match" response — the old
            // per-request catch made every page request "succeed" with an empty
            // result no matter what actually went wrong, so an outage silently
            // looked identical to zero search results.
            const pageCount = 5;
            const settled = await Promise.allSettled(
                Array.from({ length: pageCount }, (_, i) =>
                    fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(searchQuery)}&type=movie&page=${i + 1}&apikey=${OMDB_API_KEY}`)
                        .then(r => { if (!r.ok) throw new Error('OMDb request failed'); return r.json(); })
                )
            );

            const fulfilled = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
            if (fulfilled.length === 0) {
                setSearchResults([]);
                setSearchError(true);
                return;
            }

            const processed = fulfilled
                .flatMap(data => data.Search || [])
                .filter(item => item.Poster && item.Poster !== 'N/A')
                .map(item => ({
                    id: item.imdbID,
                    title: item.Title,
                    year: item.Year,
                    image: item.Poster
                }));

            // Deduplicate by imdbID (already canonical, unlike iTunes collection ids)
            const seen = new Set();
            const unique = processed.filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });

            setSearchResults(unique);
        } catch (err) {
            console.error("Failed to search movies", err);
            setSearchError(true);
        } finally {
            setIsSearching(false);
        }
    };

    const handleGetThis = (movie) => {
        setSelectedProduct(movie);
    };

    const handleChooseStyle = async (movie, style) => {
        setGeneratingStyle(style);
        try {
            const frameObj = FRAME_STYLES.find(f => f.id === 'frame-10512') || FRAME_STYLES[0];

            if (style === 'original') {
                // Detect the poster's actual aspect ratio/resolution and pick
                // the portrait size that best fits it, falling back to the
                // standard "one sheet" 24x36 if the image can't be read.
                let sizeObj;
                try {
                    const { w, h } = await loadImageNaturalSize(movie.image);
                    sizeObj = pickBestFrameSize(w, h);
                } catch (err) {
                    sizeObj = FRAME_SIZES.find(s => s.id === '24x36') || FRAME_SIZES[0];
                }

                setSelectedProduct(null);
                setProductMode('frame');
                if (frameObj) setSelectedFrame(frameObj);
                if (sizeObj) setSelectedSize(sizeObj);

                navigate('/frame/customize', {
                    state: {
                        presetImage: movie.image,
                        presetTitle: movie.title,
                        initialFrame: frameObj || null,
                        initialSize: sizeObj || null,
                        orientation: 'portrait',
                        initialMatWidth: 'narrow',
                        isMoviePoster: true
                    }
                });
                return;
            }

            // style === 'print'
            const posterData = await fetchMoviePosterData(movie);

            setSelectedProduct(null);
            setProductMode('frame');
            if (frameObj) setSelectedFrame(frameObj);

            // Default to a large portrait size — the poster layout adapts to
            // any portrait aspect ratio, this is just a sensible starting point.
            const sizeObj = FRAME_SIZES.find(s => s.id === '24x36') || FRAME_SIZES[0];
            if (sizeObj) setSelectedSize(sizeObj);

            navigate('/frame/customize', {
                state: {
                    posterData,
                    presetTitle: `${movie.title} Poster`,
                    initialFrame: frameObj || null,
                    initialSize: sizeObj || null,
                    orientation: 'portrait',
                    initialMatWidth: 'none',
                    isMoviePosterPrint: true
                }
            });
        } catch (err) {
            console.error('Failed to generate movie poster:', err);
            alert('Failed to fetch movie details. Please try again.');
        } finally {
            setGeneratingStyle(null);
        }
    };

    // Determine current artworks to display
    const currentArtworks = useMemo(() => {
        if (activeTab === 'Search') {
            return searchResults;
        }
        return MOVIES_LOCAL_COLLECTIONS[activeTab] || [];
    }, [activeTab, searchResults]);

    const totalPages = Math.ceil(currentArtworks.length / itemsPerPage);
    const paginatedArtworks = currentArtworks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className={isSubPage ? "text-stone-900" : "min-h-screen bg-[#faf9f8] text-stone-900"} style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <header className="border-b border-stone-200">
                <div className={`max-w-[2560px] mx-auto px-6 md:px-12 pb-3 sm:pb-6 ${isSubPage ? 'pt-1' : 'pt-8'}`}>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1 sm:mb-2 flex items-center gap-2">
                                Cinema
                            </p>
                            <h1 className="font-serif font-light text-2xl md:text-3xl text-stone-900 tracking-tight leading-none mb-1 sm:mb-3">
                                Movie Posters
                            </h1>
                            <p className="hidden sm:block text-sm text-stone-500 font-light max-w-xl leading-relaxed">
                                The IMDB Top 200 and hundreds more across Action, Comedy, Drama, and more. Or, search for your favorite film to frame.
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

                    <button
                        onClick={() => { setActiveTab(DEFAULT_TAB); setCurrentPage(1); }}
                        className={`flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                            activeTab === DEFAULT_TAB
                                ? 'bg-stone-900 text-white shadow-md'
                                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                        }`}
                    >
                        {DEFAULT_TAB}
                    </button>

                    {GENRES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setActiveTab(cat); setCurrentPage(1); }}
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

                {/* Search Bar */}
                {activeTab === 'Search' && (
                    <div className="max-w-[2560px] mx-auto px-6 md:px-12 mt-4">
                        <form onSubmit={handleSearch} className="max-w-md relative">
                            <input
                                type="text"
                                placeholder="Search any movie title..."
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
                    </div>
                )}
            </div>

            {/* Grid */}
            <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-8 pb-16">
                {currentArtworks.length === 0 ? (
                    <div className="w-full flex flex-col items-center justify-center py-24 text-stone-400">
                        {activeTab === 'Search' && searchError ? (
                            <>
                                <Search size={32} className="mb-4 text-stone-300" />
                                <p className="text-sm font-medium">Couldn't reach the movie search right now — try again in a moment.</p>
                            </>
                        ) : activeTab === 'Search' ? (
                            <>
                                <Search size={32} className="mb-4 text-stone-300" />
                                <p className="text-sm font-medium">Search for a movie to begin</p>
                            </>
                        ) : (
                            <>
                                <Film size={32} className="mb-4 text-stone-300" />
                                <p className="text-sm font-medium">No posters in this category yet</p>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
                            {paginatedArtworks.map((product, idx) => (
                                <MovieProductCard
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
                            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-900 transition-colors"
                        >
                            ✕
                        </button>

                        <h2 className="text-2xl font-serif mb-6 text-stone-900">Choose Framing Style</h2>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Original Poster Option */}
                            <button
                                onClick={() => handleChooseStyle(selectedProduct, 'original')}
                                disabled={!!generatingStyle}
                                className="group flex flex-col items-center gap-4 p-4 rounded-xl border border-stone-200 hover:border-stone-900 transition-all text-center disabled:opacity-50"
                            >
                                <div className="w-[60%] mx-auto aspect-[2/3] bg-stone-100 p-2 rounded-lg flex items-center justify-center relative">
                                    <div className="w-full h-full bg-white shadow-sm border border-stone-200 overflow-hidden">
                                        <img src={selectedProduct.image} alt="poster" className="w-full h-full object-cover" />
                                    </div>
                                    {generatingStyle === 'original' && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 rounded-lg z-10">
                                            <Loader2 size={24} className="animate-spin text-stone-900" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900">Loading</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-stone-900 group-hover:text-stone-600 transition-colors">Original Poster</h3>
                                    <p className="text-xs text-stone-500 mt-1">The official one-sheet, framed exactly as released.</p>
                                </div>
                            </button>

                            {/* Poster Print Option */}
                            <button
                                onClick={() => handleChooseStyle(selectedProduct, 'print')}
                                disabled={!!generatingStyle}
                                className="group flex flex-col items-center gap-4 p-4 rounded-xl border border-stone-200 hover:border-stone-900 transition-all text-center disabled:opacity-50"
                            >
                                <div className="w-[60%] mx-auto aspect-[2/3] bg-stone-900 p-2 rounded-lg flex flex-col gap-1.5 relative">
                                    <img src={selectedProduct.image} alt="poster" className="w-full h-[70%] object-cover bg-stone-800" />
                                    <div className="flex-1 flex flex-col items-center justify-center gap-1 px-1">
                                        <div className="w-3/4 h-1.5 bg-stone-200 rounded-full" />
                                        <div className="w-1/2 h-1 bg-stone-500 rounded-full mt-0.5" />
                                        <div className="w-2/3 h-1 bg-stone-600 rounded-full" />
                                    </div>
                                    {generatingStyle === 'print' && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 rounded-lg z-10">
                                            <Loader2 size={24} className="animate-spin text-stone-900" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900">Generating</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-stone-900 group-hover:text-stone-600 transition-colors">Poster Print</h3>
                                    <p className="text-xs text-stone-500 mt-1">Director, cast, and rating alongside the poster art.</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MoviePosterPage;
