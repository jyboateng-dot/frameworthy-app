import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ArrowUp } from 'lucide-react';
import PageMeta from '../components/common/PageMeta';

/* Page-level sub-renderers from other files */
import OriginalArtistsPage from './OriginalArtistsPage';
import MuseumSourceArtPage from './MuseumSourceArtPage';
import MuseumSourcesPage from './MuseumSourcesPage';
// Lazy: these carry several MB of catalogue data (Met Museum) — only
// download it for the tab actually opened, not for every Inspiration visit.
const MetArtPage = lazy(() => import('./MetArtPage'));
const MuseumArtPage = lazy(() => import('./MuseumArtPage'));

import { MUSEUM_SOURCES } from '../data/museumSources';
import { ARCHIVAL_SOURCES } from '../data/archivalSources';
import { prefetchMuseumSnapshot } from '../services/museumApi';

const OPEN_COLLECTION_SECTIONS = [
    { id: 'originals', label: 'Original Paintings' },
    { id: 'museum', label: 'Historic Masterpieces' },
    { id: 'met', label: 'Met Museum Collection' },
    { id: 'library-of-congress', label: 'Library of Congress' },
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
        .filter(source => source.id !== 'library-of-congress')
        .map(source => ({ id: source.id, label: source.name })),
];

const TabLoadingFallback = () => (
    <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-200 border-t-[#c9a84c] rounded-full animate-spin" />
    </div>
);

const InspirationPage = ({ setProductMode, setSelectedFrame, setSelectedSize, navigate, isModal = false }) => {
    // A stored section that is no longer in the tab row falls back to 'met'
    // so a returning session never lands on an unreachable tab.
    const [currentSection, setCurrentSection] = useState(() => {
        const stored = sessionStorage.getItem('fw_insp_section');
        return stored && OPEN_COLLECTION_SECTIONS.some(section => section.id === stored) ? stored : 'met';
    });

    useEffect(() => {
        const sourceIds = OPEN_COLLECTION_SECTIONS.map(section => section.id)
            .filter(sourceId => [...MUSEUM_SOURCES, ...ARCHIVAL_SOURCES].some(source => source.id === sourceId));
        const warm = () => {
            sourceIds.forEach(sourceId => prefetchMuseumSnapshot(sourceId, 1));
            import('./MuseumArtPage').then(mod => mod.prefetchHistoricMasterpieces?.()).catch(() => {});
            import('./MetArtPage').catch(() => {});
        };
        const id = window.setTimeout(warm, 50);
        return () => window.clearTimeout(id);
    }, []);
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

    function renderTabs() {
        const sections = OPEN_COLLECTION_SECTIONS;
        return (
            <>
                <div className="pt-8 pb-2 px-6 md:px-12 max-w-[2560px] mx-auto">
                    <h1 className="font-serif font-light text-3xl md:text-4xl text-stone-900 tracking-tight leading-none">Museum Art</h1>
                </div>
                <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-30 py-3">
                    <div className="max-w-[2560px] mx-auto px-6 md:px-12 flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {sections.map(s => (
                            <React.Fragment key={s.id}>
                                <button
                                    onMouseEnter={() => {
                                        if (s.id === 'museum') {
                                            import('./MuseumArtPage').then(mod => mod.prefetchHistoricMasterpieces?.()).catch(() => {});
                                        } else if (s.id === 'met') {
                                            import('./MetArtPage').catch(() => {});
                                        } else if ([...MUSEUM_SOURCES, ...ARCHIVAL_SOURCES].some(src => src.id === s.id)) {
                                            prefetchMuseumSnapshot(s.id, 1);
                                        }
                                    }}
                                    onClick={() => {
                                        setCurrentSection(s.id);
                                        sessionStorage.setItem('fw_insp_section', s.id);
                                        sessionStorage.setItem('fw_insp_page_scroll', '0');
                                        scrollToTop();
                                    }}
                                    className={`flex items-center gap-2 flex-shrink-0 px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                                        currentSection === s.id
                                            ? 'bg-stone-900 text-white shadow-md'
                                            : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                                    }`}
                                >
                                    {s.label}
                                </button>
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
                title="Museum Art"
                description="Browse museum art, historical masterpieces, vintage prints, and open-access collections ready for custom framing."
            />
            {renderTabs()}

            {currentSection === 'originals' && (
                <div className="max-w-[2560px] mx-auto py-8">
                    <OriginalArtistsPage />
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
