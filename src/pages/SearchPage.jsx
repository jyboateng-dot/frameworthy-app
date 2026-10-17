import React, { useState, useEffect, useMemo } from 'react';
import { Search as SearchIcon, Loader2, Globe } from 'lucide-react';
import { FRAME_SIZES, findSizeByDimension, parseCustomSize } from '../data/constants';
import { DEFAULT_PRODIGI_FRAME } from '../data/frameBrowsing';
import SOURCE_DIMS from '../data/source_dims.json';
import WEB_MET_DIMS from '../data/web_met_dims.json';

import { PRODUCTS as ORIGINAL_PRODUCTS } from '../data/original_paintings';
import { PRODUCTS as PRESTIGE_PRODUCTS } from '../data/prestige_paintings';
import { PRODUCTS as CANVAS_PRODUCTS } from '../data/canvas_art';
import { PRODUCTS as GLOSSY_PRODUCTS } from '../data/glossy_art';
import { PRODUCTS as FRAMED_PRINT_PRODUCTS } from '../data/framed_prints';
import { UNSPLASH_IMAGES } from '../data/unsplashLocal';
import { MET_LOCAL_COLLECTIONS } from '../data/metLocal';
import { ALBUMS_LOCAL_COLLECTIONS } from '../data/albumsLocal';
import { MOVIES_LOCAL_COLLECTIONS } from '../data/moviesLocal';
import { getThumbnailUrl } from '../services/storage';

const CATEGORY_LABELS = {
    originals: 'Original Painting',
    prestige: 'Prestige Painting',
    canvas: 'Canvas Art',
    glossy: 'Glossy Art',
    inspiration: 'Framed Print',
    web: 'Web Image',
    met: 'Met Museum',
    albums: 'Album Artwork',
    movies: 'Movie Poster',
    museum: 'Artists & Masterpieces'
};

// Unlike every other bucket below (small static arrays bundled into the
// app), Artists & Masterpieces' ~6,940 products live in public/museum-data/
// and are fetched at runtime — see build_museum_search_index.mjs for why a
// search-specific index exists separately from the category file
// MuseumArtPage uses. Fetched once, lazily, only when the Search tab is
// actually visited.

// Cap per-category so no single huge local collection (Met, Albums, Movies)
// drowns out the rest of the grid — a handful of the best-matching results
// from every category reads as "search across everything", not "search Met".
const PER_CATEGORY_LIMIT = 6;
const TOTAL_LOCAL_LIMIT = 48;

function matches(text, q) {
    return typeof text === 'string' && text.toLowerCase().includes(q);
}

// Flattens the nested { genre: { artist: [...] } } / { category: [...] }
// local collections into a flat, deduped-by-id array once per module load —
// these datasets are static, so there's no need to re-flatten on every
// keystroke.
function flattenAlbums() {
    const seen = new Map();
    Object.values(ALBUMS_LOCAL_COLLECTIONS).forEach(byArtist => {
        Object.values(byArtist).forEach(albums => {
            albums.forEach(a => { if (!seen.has(a.id)) seen.set(a.id, a); });
        });
    });
    return Array.from(seen.values());
}

function flattenMovies() {
    const seen = new Map();
    Object.values(MOVIES_LOCAL_COLLECTIONS).forEach(list => {
        list.forEach(m => { if (!seen.has(m.id)) seen.set(m.id, m); });
    });
    return Array.from(seen.values());
}

function flattenMet() {
    const seen = new Map();
    Object.values(MET_LOCAL_COLLECTIONS).forEach(list => {
        (list || []).forEach(a => { if (!seen.has(a.id)) seen.set(a.id, a); });
    });
    return Array.from(seen.values());
}

const FLAT_ALBUMS = flattenAlbums();
const FLAT_MOVIES = flattenMovies();
const FLAT_MET = flattenMet();

function resolveSizeFromDims(dims) {
    return parseCustomSize(dims) || findSizeByDimension(dims) || null;
}

const ResultCard = ({ result, onGetThis }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            className="group relative flex flex-col gap-2 cursor-pointer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative overflow-hidden bg-white flex items-center justify-center border border-stone-200/50 shadow-sm" style={{ aspectRatio: '1 / 1' }}>
                <img
                    src={getThumbnailUrl(result.image)}
                    alt={result.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div className={`absolute inset-0 bg-stone-900/10 flex items-center justify-center gap-3 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onGetThis(result); }}
                        className="px-6 py-2.5 bg-white/90 backdrop-blur-md text-stone-900 border border-white/60 hover:bg-white text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 shadow-sm rounded-full"
                    >
                        Get This
                    </button>
                </div>
                <span className="absolute top-2.5 left-2.5 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[9px] font-bold uppercase tracking-wider text-stone-600">
                    {result.categoryLabel}
                </span>
            </div>
            <div className="flex flex-col px-1">
                <h3 className="text-sm font-semibold text-stone-900 leading-tight truncate" title={result.title}>{result.title}</h3>
                {result.subtitle && <p className="text-xs text-stone-500 truncate mt-0.5">{result.subtitle}</p>}
                <button
                    onClick={() => onGetThis(result)}
                    className="text-left text-[10px] uppercase tracking-wider font-bold text-stone-900 hover:text-stone-700 transition-colors mt-1.5"
                >
                    Get This
                </button>
            </div>
        </div>
    );
};

const SearchPage = ({ setProductMode, setSelectedSize, navigate, isSubPage = false, onSelectAlbumMovie }) => {
    const [query, setQuery] = useState(() => sessionStorage.getItem('fw_search_query') || '');
    const [debouncedQuery, setDebouncedQuery] = useState(query);
    const [webResults, setWebResults] = useState([]);
    const [webLoading, setWebLoading] = useState(false);
    const [webError, setWebError] = useState(false);
    const [webPage, setWebPage] = useState(1);
    const [hasMoreWeb, setHasMoreWeb] = useState(false);
    const [museumIndex, setMuseumIndex] = useState(null); // null = not yet loaded

    useEffect(() => { sessionStorage.setItem('fw_search_query', query); }, [query]);

    // Loaded once, on first mount of the Search tab — not gated behind a
    // query, since the fetch takes a moment and shouldn't add latency to the
    // user's first keystroke.
    useEffect(() => {
        let cancelled = false;
        fetch('/museum-data/search-index.json')
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(data => { if (!cancelled) setMuseumIndex(Array.isArray(data) ? data : []); })
            .catch(() => { if (!cancelled) setMuseumIndex([]); });
        return () => { cancelled = true; };
    }, []);

    // Debounce so local filtering + the live web request don't fire on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => {
            const trimmed = query.trim();
            if (trimmed !== debouncedQuery) {
                setDebouncedQuery(trimmed);
                setWebPage(1);
                setWebResults([]);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [query, debouncedQuery]);

    const localResults = useMemo(() => {
        const q = debouncedQuery.toLowerCase();
        if (!q) return [];

        const buckets = [];

        buckets.push(['originals', ORIGINAL_PRODUCTS.filter(p => matches(p.title, q))]);
        buckets.push(['prestige', PRESTIGE_PRODUCTS.filter(p => matches(p.title, q))]);
        buckets.push(['canvas', CANVAS_PRODUCTS.filter(p => matches(p.title, q))]);
        buckets.push(['glossy', GLOSSY_PRODUCTS.filter(p => matches(p.title, q))]);
        buckets.push(['inspiration', FRAMED_PRINT_PRODUCTS.filter(p => matches(p.title, q))]);
        buckets.push(['web', UNSPLASH_IMAGES.filter(p => matches(p.title, q) || matches(p.artist, q))]);
        buckets.push(['met', FLAT_MET.filter(p => matches(p.title, q) || matches(p.artist, q))]);
        buckets.push(['albums', FLAT_ALBUMS.filter(p => matches(p.title, q) || matches(p.artist, q))]);
        buckets.push(['movies', FLAT_MOVIES.filter(p => matches(p.title, q))]);
        buckets.push(['museum', (museumIndex || []).filter(p => matches(p.title, q) || matches(p.artist, q))]);

        const results = [];
        buckets.forEach(([category, items]) => {
            items.slice(0, PER_CATEGORY_LIMIT).forEach(raw => {
                let title, subtitle, image;
                switch (category) {
                    case 'web':
                        title = raw.title; subtitle = raw.artist; image = `/unsplash_collection/${raw.filename}`;
                        break;
                    case 'met':
                        title = raw.title; subtitle = raw.artist; image = raw.image;
                        break;
                    case 'albums':
                        title = raw.title; subtitle = raw.artist; image = raw.image;
                        break;
                    case 'movies':
                        title = raw.title; subtitle = raw.year; image = raw.image;
                        break;
                    case 'museum':
                        title = raw.title; subtitle = raw.artist; image = raw.image;
                        break;
                    default:
                        title = raw.title; subtitle = raw.dims; image = raw.image;
                }
                results.push({
                    key: `${category}-${raw.id || raw.image}`,
                    category,
                    categoryLabel: CATEGORY_LABELS[category],
                    title, subtitle, image,
                    raw
                });
            });
        });

        return results.slice(0, TOTAL_LOCAL_LIMIT);
    }, [debouncedQuery, museumIndex]);

    // Live web fallback via Openverse — a free, keyless, CC-licensed image
    // search API. Only images cleared for commercial use/modification are
    // requested, since these get printed as physical products.
    useEffect(() => {
        // The web-results section this feeds is only rendered while
        // hasQuery is true (see the !hasQuery placeholder branch below), so
        // there's nothing to reset here — the next real query just
        // overwrites this state before it's ever displayed.
        if (!debouncedQuery) return;
        let cancelled = false;
        // Standard "flip on loading before the fetch starts" idiom — flagged
        // by react-hooks/set-state-in-effect, but there's no external event
        // to hang this off; the effect starting *is* the event.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWebLoading(true);
        setWebError(false);
        // Anonymous (keyless) Openverse requests cap page_size at 20.
        fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(debouncedQuery)}&page_size=20&page=${webPage}&license_type=commercial,modification`)
            .then(res => {
                if (!res.ok) throw new Error('Openverse request failed');
                return res.json();
            })
            .then(data => {
                if (cancelled) return;
                const newResults = (data.results || []).filter(r => r.thumbnail || r.url);
                setWebResults(prev => webPage === 1 ? newResults : [...prev, ...newResults]);
                setHasMoreWeb(webPage < (data.page_count || 1));
            })
            .catch(() => {
                if (!cancelled) { 
                    if (webPage === 1) setWebResults([]); 
                    setWebError(true); 
                }
            })
            .finally(() => {
                if (!cancelled) setWebLoading(false);
            });
        return () => { cancelled = true; };
    }, [debouncedQuery, webPage]);

    const webResultsMapped = useMemo(() => webResults.map(r => ({
        key: `openverse-${r.id}`,
        category: 'openverse',
        categoryLabel: 'From the Web',
        title: r.title || 'Untitled',
        subtitle: r.creator ? `by ${r.creator}` : null,
        image: r.thumbnail || r.url,
        raw: r
    })), [webResults]);

    const handleGetThis = (result) => {
        if (result.category === 'albums' || result.category === 'movies') {
            if (onSelectAlbumMovie) onSelectAlbumMovie({ type: result.category, item: result.raw });
            return;
        }

        // Only the 'inspiration' case below (a locked-preset Framed Print,
        // same as InspirationPage's own Framed Prints flow) still needs this
        // — everywhere else the customer's current frame selection should
        // stand, not get silently swapped for a category default.
        const frameObj = DEFAULT_PRODIGI_FRAME;
        setProductMode('frame');

        switch (result.category) {
            case 'originals':
            case 'prestige':
            case 'canvas':
            case 'glossy': {
                const p = result.raw;
                const filename = p.image.split('/').pop();
                const bestFitDims = SOURCE_DIMS[filename] || p.dims;
                const sizeObj = resolveSizeFromDims(bestFitDims) || FRAME_SIZES.find(s => s.id === p.sizeId) || FRAME_SIZES[0];
                if (sizeObj) setSelectedSize(sizeObj);
                navigate('/frame/customize', {
                    state: {
                        presetImage: p.fullRes,
                        initialSize: sizeObj || null,
                        orientation: sizeObj?.orientation,
                        initialThickness: 'thick',
                        initialLayout: 'single',
                    }
                });
                return;
            }
            case 'inspiration': {
                const p = result.raw;
                const sizeObj = resolveSizeFromDims(p.dims) || FRAME_SIZES.find(s => s.id === p.sizeId) || FRAME_SIZES[0];
                if (sizeObj) setSelectedSize(sizeObj);
                navigate('/frame/customize', {
                    state: {
                        initialThickness: p.thickness || 'thin',
                        initialLayout: p.layout || 'single',
                        presetImage: p.fullRes,
                        presetTitle: p.title,
                        presetDims: p.dims,
                        initialFrame: frameObj || null,
                        initialSize: sizeObj || null,
                        orientation: sizeObj?.orientation,
                        isPresetFramedPrint: true
                    }
                });
                return;
            }
            case 'web': {
                const p = result.raw;
                const dims = WEB_MET_DIMS[p.filename] || '40 x 50 cm';
                const sizeObj = resolveSizeFromDims(dims) || FRAME_SIZES.find(s => s.id === '16x20') || FRAME_SIZES[0];
                if (sizeObj) setSelectedSize(sizeObj);
                navigate('/frame/customize', {
                    state: {
                        presetImage: `/unsplash_collection/${p.filename}`,
                        initialSize: sizeObj || null,
                        orientation: sizeObj?.orientation,
                    }
                });
                return;
            }
            case 'met': {
                const p = result.raw;
                navigate('/frame/customize', {
                    state: {
                        presetImage: p.image,
                        orientation: p.orientation || 'portrait'
                    }
                });
                return;
            }
            case 'museum': {
                const p = result.raw;
                navigate('/frame/customize', {
                    state: {
                        presetImage: p.image,
                        presetTitle: p.artist ? `${p.title} — ${p.artist}` : p.title,
                        orientation: p.orientation || 'portrait'
                    }
                });
                return;
            }
            case 'openverse': {
                const sizeObj = FRAME_SIZES.find(s => s.id === '16x20') || FRAME_SIZES[0];
                if (sizeObj) setSelectedSize(sizeObj);
                navigate('/frame/customize', {
                    state: {
                        presetImage: result.raw.url || result.raw.thumbnail,
                        presetTitle: result.title !== 'Untitled' ? result.title : null,
                        initialSize: sizeObj || null,
                    }
                });
                return;
            }
            default:
                return;
        }
    };

    const hasQuery = debouncedQuery.length > 0;
    const isTyping = query !== debouncedQuery;
    const noResults = hasQuery && !isTyping && !webLoading && localResults.length === 0 && webResultsMapped.length === 0;

    return (
        <div className={isSubPage ? "text-stone-900" : "min-h-screen bg-[#faf9f8] text-stone-900"} style={{ fontFamily: "'Inter', sans-serif" }}>
            <header className="border-b border-stone-200">
                <div className={`max-w-[2560px] mx-auto px-6 md:px-12 pb-6 ${isSubPage ? 'pt-1' : 'pt-8'}`}>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-2 flex items-center gap-2">
                        <SearchIcon size={12} /> Search Everything
                    </p>
                    <h1 className="font-serif font-light text-2xl md:text-3xl text-stone-900 tracking-tight leading-none mb-3">
                        Find Something to Frame
                    </h1>
                    <p className="text-sm text-stone-500 font-light max-w-lg leading-relaxed mb-5">
                        Search across every collection in FrameWorthy — paintings, museum art, album covers, movie posters, and more — plus the open web.
                    </p>
                    <div className="relative max-w-lg">
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search by title, artist, or keyword..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:border-stone-900 transition-all shadow-sm"
                        />
                        <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                    </div>
                </div>
            </header>

            <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-8 pb-16">
                {!hasQuery ? (
                    <div className="w-full flex flex-col items-center justify-center py-20 text-stone-400">
                        <SearchIcon size={28} className="mb-4 opacity-40" />
                        <p className="text-sm font-medium text-stone-500">Start typing to search everything FrameWorthy has to offer.</p>
                    </div>
                ) : (
                    <>
                        {localResults.length > 0 && (
                            <section className="mb-14">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-6">From Your Collections</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
                                    {localResults.map(result => (
                                        <ResultCard key={result.key} result={result} onGetThis={handleGetThis} />
                                    ))}
                                </div>
                            </section>
                        )}

                        <section>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-6 flex items-center gap-2">
                                <Globe size={12} /> From the Web
                            </h2>
                            {webLoading && webPage === 1 ? (
                                <div className="w-full flex justify-center py-12">
                                    <Loader2 size={20} className="animate-spin text-stone-400" />
                                </div>
                            ) : webError && webPage === 1 ? (
                                <p className="text-sm text-stone-400 py-6">Couldn't reach the web image search right now — your collections above are still searchable.</p>
                            ) : webResultsMapped.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
                                        {webResultsMapped.map(result => (
                                            <ResultCard key={result.key} result={result} onGetThis={handleGetThis} />
                                        ))}
                                    </div>
                                    {hasMoreWeb && (
                                        <div className="mt-12 flex justify-center">
                                            <button
                                                onClick={() => setWebPage(p => p + 1)}
                                                disabled={webLoading}
                                                className={`px-6 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-full transition-colors flex items-center gap-2 ${webLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {webLoading && <Loader2 size={16} className="animate-spin" />}
                                                {webLoading ? 'Loading...' : 'Load Next 20'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-stone-400 py-6">No web results for "{debouncedQuery}".</p>
                            )}
                        </section>

                        {noResults && (
                            <div className="w-full flex flex-col items-center justify-center py-12 text-stone-400">
                                <p className="text-sm font-medium">No results found for "{debouncedQuery}".</p>
                                <p className="text-xs text-stone-400 mt-1">Try a different title, artist, or keyword.</p>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default SearchPage;
