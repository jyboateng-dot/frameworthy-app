import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ArrowRight, Heart, Search, ArrowUp } from 'lucide-react';
import { FRAME_SIZES, findSizeByDimension, formatDimensions, parseCustomSize } from '../data/constants';
import { activeFrameOrDefault } from '../data/frameBrowsing';
import { useUnit } from '../context/UnitContext';
import { useWishlist } from '../context/WishlistContext';
import PageMeta from '../components/common/PageMeta';

/* Page-level sub-renderers from other files */
import OriginalArtistsPage from './OriginalArtistsPage';
import PrestigePaintingsPage from './PrestigePaintingsPage';
import CanvasArtPage from './CanvasArtPage';
import GlossyArtPage from './GlossyArtPage';
import WebImagesPage from './WebImagesPage';
import MuseumSourceArtPage from './MuseumSourceArtPage';
// Lazy: each of these carries several MB of catalogue data (Met Museum,
// album covers, movie posters) — only download it for the tab actually
// opened, not for every Inspiration visit.
const MetArtPage = lazy(() => import('./MetArtPage'));
const AlbumArtPage = lazy(() => import('./AlbumArtPage'));
const MoviePosterPage = lazy(() => import('./MoviePosterPage'));
const SearchPage = lazy(() => import('./SearchPage'));
const MuseumArtPage = lazy(() => import('./MuseumArtPage'));

import { PRODUCTS } from '../data/framed_prints';
import { getThumbnailUrl } from '../services/storage';
import { MUSEUM_SOURCES } from '../data/museumSources';
import { ARCHIVAL_SOURCES } from '../data/archivalSources';
import { prefetchMuseumSnapshot } from '../services/museumApi';
import CollectionPagination from '../components/common/CollectionPagination';

const OPEN_COLLECTION_SECTIONS = [
    { id: 'originals', label: 'Original Paintings' },
    { id: 'met', label: 'Met Museum Collection' },
    ...[
        'paris-musees',
        'art-institute-of-chicago',
        'rijksmuseum',
        'national-gallery-of-art',
        'smithsonian-open-access',
        'cleveland-museum-of-art',
    ].map(sourceId => {
        const source = MUSEUM_SOURCES.find(item => item.id === sourceId);
        return { id: source.id, label: source.name };
    }),
    ...ARCHIVAL_SOURCES
        .filter(source => ['biodiversity-heritage-library', 'nasa-open-media'].includes(source.id))
        .map(source => ({ id: source.id, label: source.name })),
];

const TabLoadingFallback = () => (
    <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-200 border-t-[#c9a84c] rounded-full animate-spin" />
    </div>
);

const ProductCard = ({ product, onGetThis }) => {
    const { unit } = useUnit();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const liked = isInWishlist(product.id);
    const [hovered, setHovered] = useState(false);

    return (
        <article
            className="group flex flex-col"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative overflow-hidden bg-white flex items-center justify-center border border-stone-200/50" style={{ aspectRatio: '1 / 1' }}>
                <img src={getThumbnailUrl(product.image)} alt={product.title} loading="lazy" className="w-full h-full object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
                <div className={`absolute inset-0 bg-stone-50/20 flex items-center justify-center gap-3 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                    <button onClick={() => onGetThis(product)} className="px-6 py-2.5 bg-white/70 backdrop-blur-md text-stone-900 border border-white/60 hover:bg-white/90 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 shadow-sm rounded-sm">Get This</button>
                </div>
                <button onClick={e => { e.stopPropagation(); toggleWishlist(product); }} className={`absolute top-2.5 right-2.5 p-1.5 transition-colors duration-200 z-10 ${liked ? 'text-[#e41e31]' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Heart size={13} fill={liked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                </button>
            </div>
            <div className="pt-3 pb-2 border-b border-stone-200">
                <h3 className="font-serif font-light text-sm text-stone-900 leading-snug mb-1">{product.title}</h3>
                <p className="text-[10px] text-stone-500 font-light leading-snug mb-2">{formatDimensions(product.dims, unit)}</p>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                    <button onClick={() => onGetThis(product)} className="text-stone-900 hover:text-stone-700 font-bold transition-colors duration-150">Get This</button>
                </div>
            </div>
        </article>
    );
};

const InspirationPage = ({ setProductMode, setSelectedFrame, setSelectedSize, navigate, isModal = false }) => {
    // Original/Prestige Paintings, Canvas Art, and Glossy Art were briefly
    // shelved (not in the tab row) between 2026-09-03 and 2026-09-07, then
    // restored. Framed Prints ('inspiration') went back out on 2026-09-07 —
    // its content block, data, and tab entry are all still in place (see
    // renderTabs) so it's a one-line re-add whenever it comes back. A
    // session that had 'inspiration' active before this shouldn't land on
    // an unreachable tab with no pill to select it back out of, hence the
    // guard below.
    const [currentSection, setCurrentSection] = useState(() => {
        const stored = sessionStorage.getItem('fw_insp_section');
        return stored && OPEN_COLLECTION_SECTIONS.some(section => section.id === stored) ? stored : 'met';
    });

    useEffect(() => {
        const sourceIds = OPEN_COLLECTION_SECTIONS.map(section => section.id)
            .filter(sourceId => [...MUSEUM_SOURCES, ...ARCHIVAL_SOURCES].some(source => source.id === sourceId));
        const warm = () => sourceIds.forEach(sourceId => prefetchMuseumSnapshot(sourceId));
        if ('requestIdleCallback' in window) {
            const id = window.requestIdleCallback(warm, { timeout: 1200 });
            return () => window.cancelIdleCallback(id);
        }
        const id = window.setTimeout(warm, 250);
        return () => window.clearTimeout(id);
    }, []);
    // A result picked from the cross-category Search tab that needs its
    // native category's "Choose Framing Style" modal opened immediately —
    // Album/Movie results can't navigate directly like the flat-catalog
    // categories since they require that two-option (Original/Poster Print)
    // flow, so handing off to the target page and pre-selecting the item is
    // simpler than duplicating that whole modal + async-generation flow here.
    const [pendingSelection, setPendingSelection] = useState(null);
    const [activeSeries, setActiveSeries] = useState(() => sessionStorage.getItem('fw_insp_series') || 'all');
    const [page, setPage] = useState(() => parseInt(sessionStorage.getItem('fw_insp_page') || '1', 10));
    const PAGE_SIZE = 24;

    useEffect(() => { sessionStorage.setItem('fw_insp_section', currentSection); }, [currentSection]);
    useEffect(() => { sessionStorage.setItem('fw_insp_series', activeSeries); }, [activeSeries]);
    useEffect(() => { sessionStorage.setItem('fw_insp_page', page.toString()); }, [page]);

    // In-studio modal mode (isModal=true) renders this page inside a nested
    // scrollable div, not window — listening to window's scroll there would
    // silently save the hidden background page's position under the same
    // sessionStorage key the real /inspiration route reads from, and
    // restoring by scrolling window wouldn't move the visible modal content
    // anyway. Only wire this up on the real standalone route.
    const scrollToTop = () => { if (!isModal) window.scrollTo({ top: 0, behavior: 'smooth' }); };

    // Surfaces a floating "back to top" shortcut once scrolled deep into a
    // long tab (Original Paintings, Met Museum, etc. can run to many pages) —
    // same affordance as the visualizer's back-to-top button in the Frame
    // Studio, so long lists don't require a manual scroll all the way back up.
    const [showBackToTop, setShowBackToTop] = useState(false);

    // Restore and save scroll position
    useEffect(() => {
        if (isModal) return;

        const savedScroll = parseInt(sessionStorage.getItem('fw_insp_page_scroll') || '0', 10);
        if (savedScroll > 0) {
            // The active tab (often a lazy-loaded chunk with its own data
            // fetch — Album/Movie/Met collections) may still be rendering.
            // A fixed delay races that on a slow connection or large
            // dataset, so poll until the page is actually tall enough to
            // reach savedScroll, capping at ~1s so it can't hang forever.
            let attempts = 0;
            const tryScroll = () => {
                attempts++;
                const canReach = document.body.scrollHeight - window.innerHeight >= savedScroll;
                if (canReach || attempts >= 20) {
                    window.scrollTo(0, savedScroll);
                } else {
                    setTimeout(tryScroll, 50);
                }
            };
            setTimeout(tryScroll, 50);
        }

        const handleScroll = () => {
            sessionStorage.setItem('fw_insp_page_scroll', window.scrollY.toString());
            setShowBackToTop(window.scrollY > 400);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isModal]);

    // Resolves once and both applies the studio's own selected-frame/size
    // state AND returns the same values, so callers building `navigate`
    // state don't need to recompute the identical lookup a second time.
    const _loadFrameAndSize = (product) => {
        setProductMode('frame');
        const frame = activeFrameOrDefault();
        if (frame) setSelectedFrame(frame);
        const size = parseCustomSize(product.dims) || findSizeByDimension(product.dims) || FRAME_SIZES.find(s => s.id === product.sizeId);
        if (size) setSelectedSize(size);
        return { frame, size };
    };

    const handleGetThis = (product) => {
        const { frame: frameObj, size: sizeObj } = _loadFrameAndSize(product);

        let orientation = 'portrait';
        if (product.dims) {
            const nums = product.dims.match(/\d+(?:\.\d+)?/g);
            if (nums && nums.length >= 2) {
                const w = Number(nums[0]);
                const h = Number(nums[1]);
                if (w > h) orientation = 'landscape';
            }
        }

        navigate('/frame/customize', {
            state: {
                initialThickness: product.thickness || 'thin',
                initialLayout: product.layout || 'single',
                presetImage: product.fullRes,
                presetTitle: product.title,
                presetDims: product.dims,
                initialFrame: frameObj || null,
                initialSize: sizeObj || null,
                isPresetFramedPrint: true,
                orientation: orientation
            },
        });
    };

    // Inspiration logic
    const FRAMED_PRINTS_PRODUCTS = PRODUCTS.filter(p => p.dims !== 'Gallery set');
    const uniqueDims = Array.from(new Set(FRAMED_PRINTS_PRODUCTS.map(p => p.dims)));
    const INSPIRATION_TABS = [
        { label: 'All', value: 'all' },
        ...uniqueDims.map(d => ({ label: d, value: d }))
    ];

    const filteredInspiration = activeSeries === 'all' ? FRAMED_PRINTS_PRODUCTS : FRAMED_PRINTS_PRODUCTS.filter(p => p.dims === activeSeries);
    const totalPagesInspiration = Math.ceil(filteredInspiration.length / PAGE_SIZE);
    const paginatedInspiration = filteredInspiration.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);



    function renderTabs() {
        const sections = OPEN_COLLECTION_SECTIONS;
        return (
            <>
                <div className="pt-8 pb-2 px-6 md:px-12 max-w-[2560px] mx-auto">
                    <h1 className="font-serif font-light text-3xl md:text-4xl text-stone-900 tracking-tight leading-none">Public Domain Art</h1>
                </div>
                <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-30 py-3">
                    <div className="max-w-[2560px] mx-auto px-6 md:px-12 flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {sections.map(s => (
                            <React.Fragment key={s.id}>
                                <button
                                    onClick={() => {
                                        setCurrentSection(s.id);
                                        sessionStorage.setItem('fw_insp_section', s.id);
                                        setPage(1);
                                        setActiveSeries('all');
                                        sessionStorage.setItem('fw_insp_page_scroll', '0');
                                        scrollToTop();
                                    }}
                                    className={`flex items-center gap-2 flex-shrink-0 px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                                        currentSection === s.id
                                            ? 'bg-stone-900 text-white shadow-md'
                                            : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                                    }`}
                                >
                                    {s.id === 'search' && <Search size={14} strokeWidth={2.5} />}
                                    {s.label}
                                </button>
                                {s.id === 'search' && <div className="w-px h-5 bg-stone-300 mx-1 shrink-0" />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    return (
        <div className={isModal ? "min-h-full bg-[#faf9f8] text-stone-900" : "min-h-screen bg-[#faf9f8] text-stone-900"} style={{ fontFamily: "'Inter', sans-serif" }}>
            <PageMeta
                title="Public Domain Art"
                description="Browse public-domain art, movie posters, album covers, and museum prints to frame — or paste in your own image."
            />
            {renderTabs()}

            {currentSection === 'search' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <Suspense fallback={<TabLoadingFallback />}>
                    <SearchPage
                        setProductMode={setProductMode}
                        setSelectedFrame={setSelectedFrame}
                        setSelectedSize={setSelectedSize}
                        navigate={navigate}
                        isSubPage={true} disableWindowScroll={isModal}
                        onSelectAlbumMovie={(selection) => {
                            setPendingSelection(selection);
                            setCurrentSection(selection.type);
                        }}
                    />
                    </Suspense>
                </div>
            )}

            {currentSection === 'originals' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <OriginalArtistsPage />
                </div>
            )}
            {currentSection === 'prestige' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <PrestigePaintingsPage setProductMode={setProductMode} setSelectedFrame={setSelectedFrame} setSelectedSize={setSelectedSize} navigate={navigate} isSubPage={true} disableWindowScroll={isModal} />
                </div>
            )}
            {currentSection === 'canvas' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <CanvasArtPage setProductMode={setProductMode} setSelectedFrame={setSelectedFrame} setSelectedSize={setSelectedSize} navigate={navigate} isSubPage={true} disableWindowScroll={isModal} />
                </div>
            )}
            {currentSection === 'glossy' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <GlossyArtPage setProductMode={setProductMode} setSelectedFrame={setSelectedFrame} setSelectedSize={setSelectedSize} navigate={navigate} isSubPage={true} disableWindowScroll={isModal} />
                </div>
            )}
            {currentSection === 'web' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <WebImagesPage setProductMode={setProductMode} setSelectedFrame={setSelectedFrame} setSelectedSize={setSelectedSize} navigate={navigate} isSubPage={true} disableWindowScroll={isModal} />
                </div>
            )}
            {currentSection === 'met' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <Suspense fallback={<TabLoadingFallback />}>
                    <MetArtPage setProductMode={setProductMode} setSelectedFrame={setSelectedFrame} setSelectedSize={setSelectedSize} navigate={navigate} isSubPage={true} disableWindowScroll={isModal} />
                    </Suspense>
                </div>
            )}
            {currentSection === 'museum-sources' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <MuseumSourcesPage isSubPage={true} />
                </div>
            )}
            {OPEN_COLLECTION_SECTIONS.some(section => section.id === currentSection) && [...MUSEUM_SOURCES, ...ARCHIVAL_SOURCES].some(source => source.id === currentSection) && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <MuseumSourceArtPage
                        key={currentSection}
                        sourceId={currentSection}
                        setProductMode={setProductMode}
                        setSelectedSize={setSelectedSize}
                        navigate={navigate}
                        isSubPage={true}
                        disableWindowScroll={isModal}
                    />
                </div>
            )}
            {currentSection === 'museum' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <Suspense fallback={<TabLoadingFallback />}>
                    <MuseumArtPage setProductMode={setProductMode} setSelectedFrame={setSelectedFrame} setSelectedSize={setSelectedSize} navigate={navigate} isSubPage={true} disableWindowScroll={isModal} />
                    </Suspense>
                </div>
            )}
            {currentSection === 'albums' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <Suspense fallback={<TabLoadingFallback />}>
                    <AlbumArtPage
                        setProductMode={setProductMode} setSelectedFrame={setSelectedFrame} setSelectedSize={setSelectedSize} navigate={navigate} isSubPage={true} disableWindowScroll={isModal}
                        initialSelectedProduct={pendingSelection?.type === 'albums' ? pendingSelection.item : null}
                        onConsumedInitialSelection={() => setPendingSelection(null)}
                    />
                    </Suspense>
                </div>
            )}
            {currentSection === 'movies' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <Suspense fallback={<TabLoadingFallback />}>
                    <MoviePosterPage
                        setProductMode={setProductMode} setSelectedFrame={setSelectedFrame} setSelectedSize={setSelectedSize} navigate={navigate} isSubPage={true} disableWindowScroll={isModal}
                        initialSelectedProduct={pendingSelection?.type === 'movies' ? pendingSelection.item : null}
                        onConsumedInitialSelection={() => setPendingSelection(null)}
                    />
                    </Suspense>
                </div>
            )}

            {currentSection === 'inspiration' && (
                <>
                    {/* HEADER */}
                    <header className="border-b border-stone-200">
                        <div className="max-w-[2560px] mx-auto px-6 md:px-12 pt-4 pb-4">
 
                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                                <div className="mb-6">
                                    <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1">Framed Collections</p>
                                    <h2 className="font-serif text-3xl text-stone-900 font-light mb-3">
                                        Framed Prints
                                    </h2>
                                    <p className="text-sm text-stone-500 leading-relaxed max-w-2xl">
                                        Curated solid wood frames in various styles. Select a preset look or customize to preview them in the frame studio.
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-[9px] uppercase tracking-[0.28em] text-stone-400 mb-1">COLLECTION</p>
                                    <p className="font-serif text-3xl text-stone-900 font-light leading-none">
                                        {filteredInspiration.length}<span className="text-xs text-stone-500 font-light ml-1">prints</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Sub-tabs for Framed Prints */}
                    <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-[60px] z-20">
                        <div className="overflow-x-auto no-scrollbar max-w-[2560px] mx-auto px-6 md:px-12">
                            <div className="flex gap-8 min-w-max">
                                {INSPIRATION_TABS.map(t => (
                                <button
                                    key={t.value}
                                    onClick={() => { setActiveSeries(t.value); setPage(1); }}
                                    className={`py-3 text-[11px] tracking-normal font-bold transition-all duration-300 border-b-2 whitespace-nowrap ${
                                        activeSeries === t.value
                                            ? 'border-stone-900 text-stone-900'
                                            : 'border-transparent text-stone-400 hover:text-stone-600'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                            </div>
                        </div>
                    </div>

                    {/* GRID */}
                    <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-6 pb-12">
                        {filteredInspiration.length === 0 ? (
                            <div className="py-40 text-center text-stone-400 text-sm font-light">No prints in this series.</div>
                        ) : (
                            <>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-8">
                                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredInspiration.length)} of {filteredInspiration.length} prints
                                </p>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
                                    {paginatedInspiration.map(product => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            onGetThis={handleGetThis}
                                        />
                                    ))}
                                </div>

                                <CollectionPagination
                                    currentPage={page}
                                    totalPages={totalPagesInspiration}
                                    onPageChange={nextPage => { setPage(nextPage); scrollToTop(); }}
                                />
                            </>
                        )}
                    </main>

                    {/* FOOTER */}
                    {!isModal && (
                        <footer className="border-t border-stone-200 bg-[#faf9f8]">
                            <div className="max-w-[2560px] mx-auto px-6 md:px-12 py-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                                <div>
                                    <p className="text-[9px] uppercase tracking-[0.3em] text-stone-400 font-black mb-2">Handcrafted in our studio</p>
                                    <p className="font-serif font-light text-2xl text-stone-900">
                                        Upload your photo. <span className="text-stone-900 italic font-medium">We'll frame it.</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/frame/customize')}
                                    className="inline-flex items-center gap-2.5 px-7 py-3 bg-stone-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-stone-800 transition-colors duration-200 shrink-0"
                                >
                                    Start Framing <ArrowRight size={12} strokeWidth={3} />
                                </button>
                            </div>
                        </footer>
                    )}
                </>
            )}

            {/* Back to top — same affordance as the visualizer's floating
                button in the Frame Studio, shown once scrolled deep into any
                tab (several run to many pages: Original Paintings, Met
                Museum, etc.). Rendered outside the per-tab blocks so it
                applies uniformly across all of them. */}
            {!isModal && showBackToTop && (
                <button
                    onClick={scrollToTop}
                    aria-label="Back to top"
                    className="fixed bottom-6 right-4 sm:right-6 z-30 w-11 h-11 rounded-full bg-stone-900/25 text-white shadow-lg flex items-center justify-center hover:bg-stone-900/60 transition-colors"
                >
                    <ArrowUp size={18} />
                </button>
            )}
        </div>
    );
};

export default InspirationPage;
