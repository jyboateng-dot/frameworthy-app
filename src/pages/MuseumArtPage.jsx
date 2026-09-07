import React, { useState, useEffect, useMemo } from 'react';
import { Heart, RefreshCw, ChevronDown } from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES, findSizeByDimension, formatDimensions } from '../data/constants';
import { useUnit } from '../context/UnitContext';
import { useWishlist } from '../context/WishlistContext';
import { getThumbnailUrl } from '../services/storage';

// Bymuseum's own artist browser (bymuseum.com/artists/) is a two-tier
// thing — a paginated index of portrait+bio artist cards, then a filtered
// grid per artist. We don't have portrait photos or biographies for any of
// the 608 artists here (that's a separate content project), so this keeps
// just the mechanic that our data actually supports: the most-represented
// artists as quick pills, everyone else in a searchable "More" dropdown —
// same primary/secondary pattern the old category picker used before
// Artists & Masterpieces was promoted to its own tab.
//
// Curated by hand rather than sorted by count — these are the artists
// worth surfacing as a first impression, not necessarily the ones with the
// most pieces in the catalogue. Exact spelling/casing must match the
// `artist` string in artists_and_masterpieces.json (e.g. "Leonardo da
// Vinci", lowercase "da") or the pill silently filters to zero results.
const CURATED_PRIMARY_ARTISTS = [
    'Leonardo da Vinci',
    'Vincent Van Gogh',
    'Rembrandt',
    'Gustav Klimt',
    'Claude Monet',
    'Wassily Kandinsky',
];

// Artists & Masterpieces — a standalone Inspiration category, not a
// sub-picker inside a broader "Museum Art" section anymore. It used to sit
// behind a 96-way category browser (Artists & Masterpieces plus 95 subject/
// decor buckets scraped from bymuseum.com), but those other 95 turned out to
// have no real title/artist metadata to match against a high-res source, and
// after filtering out everything that couldn't clear FrameWorthy's print-
// quality DPI floor, 77 of them were completely empty — dead tabs. Artists &
// Masterpieces is the one bucket that got the full Wikimedia Commons
// high-res replacement treatment (real named paintings, real artists, so it
// was actually matchable), so it's promoted to its own top-level Inspiration
// tab and the rest were dropped rather than shipped as broken categories.
//
// Product data is still fetched on demand rather than bundled — at ~6,940
// items it's lighter than before but still sizable enough that a single
// export-const import would ship it to every visitor on page load.
const DATA_URL = '/museum-data/artists_and_masterpieces.json';

const MuseumProductCard = ({ product, onGetThis }) => {
    const { unit } = useUnit();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const liked = isInWishlist(product.id);
    const [hovered, setHovered] = useState(false);

    // Default dimensions for ByMuseum art
    const dims = '40 x 50 cm';

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
                {product.artist && (
                    <p className="text-[10px] text-stone-500 font-light truncate" title={product.artist}>{product.artist}</p>
                )}
                <p className="text-[10px] text-stone-500 font-light leading-snug">{formatDimensions(dims, unit, product.orientation)}</p>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mt-1">
                    <button onClick={() => onGetThis(product)} className="text-stone-900 hover:text-stone-700 font-bold transition-colors duration-150">Get This</button>
                </div>
            </div>
        </div>
    );
};

const MuseumArtPage = ({ setProductMode, setSelectedFrame, setSelectedSize, navigate, isSubPage = false, disableWindowScroll = false }) => {
    const scrollToTop = () => { if (!disableWindowScroll) window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const [products, setProducts] = useState(null); // null = still loading
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch(DATA_URL)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(data => { if (!cancelled) setProducts(Array.isArray(data) ? data : []); })
            .catch(() => { if (!cancelled) setLoadError(true); });
        return () => { cancelled = true; };
    }, []);

    const [activeArtist, setActiveArtist] = useState(() => sessionStorage.getItem('fw_museum_artist') || '');
    const [currentPage, setCurrentPage] = useState(() => parseInt(sessionStorage.getItem('fw_museum_page') || '1', 10));
    const itemsPerPage = 24;

    useEffect(() => { sessionStorage.setItem('fw_museum_page', currentPage.toString()); }, [currentPage]);
    useEffect(() => { sessionStorage.setItem('fw_museum_artist', activeArtist); }, [activeArtist]);

    // Counted from the loaded products themselves rather than a separate
    // data file — artist attribution already lives on every item (100%
    // coverage, since only genuine Wikimedia matches survived the DPI
    // filter), so there's nothing extra to fetch or keep in sync.
    const { primaryArtists, secondaryArtists } = useMemo(() => {
        const allArtists = new Set();
        for (const p of (products || [])) {
            if (p.artist) allArtists.add(p.artist);
        }
        // Curated list first, in the exact order specified — only artists
        // actually present in the loaded data, so a typo/rename upstream
        // degrades to "fewer pills" rather than a broken empty pill.
        const primary = CURATED_PRIMARY_ARTISTS.filter(name => allArtists.has(name));
        const primarySet = new Set(primary);
        const secondary = Array.from(allArtists)
            .filter(name => !primarySet.has(name))
            .sort((a, b) => a.localeCompare(b));
        return { primaryArtists: primary, secondaryArtists: secondary };
    }, [products]);

    const handleArtistChange = (artist) => {
        setActiveArtist(artist);
        setCurrentPage(1);
        scrollToTop();
    };

    const handleGetThis = (product) => {
        setProductMode('frame');
        const dims = '40 x 50 cm';

        const frameObj = FRAME_STYLES.find(f => f.id === 'frame-8446') || FRAME_STYLES[0];
        if (frameObj) setSelectedFrame(frameObj);

        const sizeObj = findSizeByDimension(dims) || FRAME_SIZES.find(s => s.id === '16x20') || FRAME_SIZES[0];
        if (sizeObj) setSelectedSize(sizeObj);

        navigate('/frame/customize', {
            state: {
                presetImage: product.image,
                presetTitle: product.artist ? `${product.title} — ${product.artist}` : product.title,
                initialFrame: frameObj || null,
                initialSize: sizeObj || null,
                orientation: product.orientation || sizeObj?.orientation || 'portrait'
            }
        });
    };

    const allItems = products || [];
    const items = useMemo(
        () => activeArtist ? allItems.filter(p => p.artist === activeArtist) : allItems,
        [allItems, activeArtist]
    );
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedArtworks = useMemo(() => items.slice(startIndex, startIndex + itemsPerPage), [items, startIndex]);

    // A page number restored from a previous session (or from before a
    // dataset shrink) can exceed the current totalPages — without this, the
    // grid silently renders zero cards instead of showing the empty state.
    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    useEffect(() => {
        scrollToTop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    if (loadError) {
        return (
            <div className="w-full flex flex-col items-center justify-center py-20 text-stone-400">
                <p className="text-sm font-medium">Couldn't load Artists & Masterpieces.</p>
                <p className="text-xs text-stone-500 mt-1">Please try again in a moment.</p>
            </div>
        );
    }

    return (
        <div className={isSubPage ? "text-stone-900" : "min-h-screen bg-[#faf9f8] text-stone-900"} style={{ fontFamily: "'Inter', sans-serif" }}>
            <header className="border-b border-stone-200">
                <div className={`max-w-[2560px] mx-auto px-6 md:px-12 pb-4 ${isSubPage ? 'pt-1' : 'pt-8'}`}>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1">Artists Collection</p>
                            <h1 className="font-serif font-light text-2xl md:text-3xl text-stone-900 tracking-tight leading-none mb-2">
                                Artists & Masterpieces
                            </h1>
                            <p className="text-sm text-stone-500 font-light max-w-lg leading-relaxed">
                                Masterpieces recreated by hand. High quality prints ready to be framed.
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-[9px] uppercase tracking-[0.28em] text-stone-400 mb-1">COLLECTION</p>
                            <p className="font-serif text-3xl text-stone-900 font-light leading-none">
                                {items.length} <span className="text-xs text-stone-500 font-light ml-1">pieces</span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {primaryArtists.length > 0 && (
                <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-20 py-3">
                    <div className="max-w-[2560px] mx-auto px-6 md:px-12 flex items-center gap-2 overflow-x-auto no-scrollbar after:content-[''] after:pr-6 md:after:pr-12">
                        <button
                            onClick={() => handleArtistChange('')}
                            className={`flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                                activeArtist === ''
                                    ? 'bg-stone-900 text-white shadow-md'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                            }`}
                        >
                            All
                        </button>
                        {primaryArtists.map(artist => (
                            <button
                                key={artist}
                                onClick={() => handleArtistChange(artist)}
                                className={`flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                                    activeArtist === artist
                                        ? 'bg-stone-900 text-white shadow-md'
                                        : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                                }`}
                            >
                                {artist}
                            </button>
                        ))}

                        {secondaryArtists.length > 0 && (
                            <div className="relative flex-shrink-0 flex items-center">
                                <select
                                    value={secondaryArtists.includes(activeArtist) ? activeArtist : ''}
                                    onChange={(e) => handleArtistChange(e.target.value)}
                                    className={`appearance-none w-28 pl-4 pr-6 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 outline-none border cursor-pointer ${
                                        secondaryArtists.includes(activeArtist)
                                            ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                                            : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border-stone-200'
                                    }`}
                                >
                                    <option value="" disabled className="text-stone-400">More Artists</option>
                                    {secondaryArtists.map(artist => (
                                        <option key={artist} value={artist} className="text-stone-800 bg-white">
                                            {artist}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    size={10}
                                    strokeWidth={2.5}
                                    className={`absolute right-2.5 pointer-events-none transition-colors ${
                                        secondaryArtists.includes(activeArtist) ? 'text-white' : 'text-stone-500'
                                    }`}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-8 pb-12">
                {products === null ? (
                    <div className="w-full flex flex-col items-center justify-center py-24 text-stone-400">
                        <RefreshCw size={24} className="animate-spin mb-4" />
                        <p className="text-sm font-medium">Loading Artists & Masterpieces...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="w-full flex flex-col items-center justify-center py-24 text-stone-400">
                        <p className="text-sm font-medium">No artworks found.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
                            {paginatedArtworks.map(product => (
                                <MuseumProductCard
                                    key={product.id}
                                    product={product}
                                    onGetThis={handleGetThis}
                                />
                            ))}
                        </div>

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

export default MuseumArtPage;
