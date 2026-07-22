import React, { useState, useEffect } from 'react';
import { ArrowRight, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES, findSizeByDimension, formatDimensions, parseCustomSize } from '../data/constants';
import { useUnit } from '../context/UnitContext';
import SOURCE_DIMS from '../data/source_dims.json';

import { PRODUCTS } from '../data/glossy_art';
import { getThumbnailUrl } from '../services/storage';
const uniqueDims = Array.from(new Set(PRODUCTS.map(p => p.dims)));
const SERIES_TABS = [
    { label: 'All', value: 'all' },
    ...uniqueDims.map(d => ({ label: d, value: d }))
];

/* ── Card ── */
const ProductCard = ({ product, onGetThis, onCustomize }) => {
    const { unit } = useUnit();
    const [liked, setLiked] = useState(false);
    const [hovered, setHovered] = useState(false);

    return (
        <article
            className="group flex flex-col"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div
                className="relative overflow-hidden bg-white flex items-center justify-center border border-stone-200/50"
                style={{ aspectRatio: '1 / 1' }}
            >
                <img
                    src={getThumbnailUrl(product.image)}
                    alt={product.title}
                    loading="lazy"
                    className="w-full h-full object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />

                {/* Hover overlay */}
                <div className={`absolute inset-0 bg-stone-50/20 flex items-center justify-center gap-3 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={() => onGetThis(product)}
                        className="px-6 py-2.5 bg-white/70 backdrop-blur-md text-stone-900 border border-white/60 hover:bg-white/90 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 shadow-sm rounded-sm"
                    >
                        Get This
                    </button>
                </div>

                {/* Like */}
                <button
                    onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
                    className={`absolute top-2.5 right-2.5 p-1.5 transition-colors duration-200 z-10 ${liked ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
                    aria-label="Save"
                >
                    <Heart size={13} fill={liked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                </button>

                {/* Series badge */}
                <span className="absolute top-2.5 left-2.5 px-1.5 py-0.5 bg-stone-100 text-stone-600 text-[8px] font-black uppercase tracking-wider border border-stone-200/50 z-10">
                    {product.series}
                </span>
            </div>

            <div className="pt-3 pb-2 border-b border-stone-200">
                <h3 className="font-serif font-light text-sm text-stone-900 leading-snug mb-1">{product.title}</h3>
                <p className="text-[10px] text-stone-500 font-light leading-snug mb-2">{formatDimensions(product.dims, unit)}</p>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                    <button onClick={() => onGetThis(product)} className="text-stone-900 hover:text-stone-700 font-bold transition-colors duration-150">
                        Get This
                    </button>
                </div>
            </div>
        </article>
    );
};

/* ── Page ── */
const GlossyArtPage = ({ setProductMode, setSelectedFrame, setSelectedSize, navigate, isSubPage = false, disableWindowScroll = false }) => {
    const { unit } = useUnit();
    // Persisted so navigating away (e.g. to customize a selection) and back
    // to Inspiration restores the same filter/page instead of resetting.
    const [activeSeries, setActiveSeries] = useState(() => sessionStorage.getItem('fw_glossy_series') || 'all');
    const [page, setPage] = useState(() => parseInt(sessionStorage.getItem('fw_glossy_page') || '1', 10));
    const PAGE_SIZE = 24;

    useEffect(() => { sessionStorage.setItem('fw_glossy_series', activeSeries); }, [activeSeries]);
    useEffect(() => { sessionStorage.setItem('fw_glossy_page', page.toString()); }, [page]);

    // disableWindowScroll is true only inside the in-studio Inspiration
    // modal, where window isn't the real scroll container — isSubPage
    // alone isn't enough (it's also true on the real /inspiration route,
    // where window IS the real scroll container).
    const scrollToTop = () => { if (!disableWindowScroll) window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const handleGetThis = (product) => {
        setProductMode('frame');
        const filename = product.image.split('/').pop();
        const bestFitDims = SOURCE_DIMS[filename] || product.dims;
        const resolvedSize = parseCustomSize(bestFitDims) || findSizeByDimension(bestFitDims) || FRAME_SIZES.find(s => s.id === product.sizeId) || null;
        navigate('/frame/customize', {
            state: {
                presetImage: product.fullRes,
                presetTitle: product.title,
                initialFrame: FRAME_STYLES.find(f => f.id === 'frame-10512') || null,
                initialSize: resolvedSize,
                orientation: resolvedSize?.orientation,
                initialThickness: 'thick',
                initialLayout: 'single',
            },
        });
    };

    const filtered = activeSeries === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.dims === activeSeries);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleTabChange = (val) => { setActiveSeries(val); setPage(1); };

    return (
        <div className={isSubPage ? "text-stone-900" : "min-h-screen bg-[#faf9f8] text-stone-900"} style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* HEADER */}
            <header className="border-b border-stone-200">
                <div className={`max-w-screen-xl mx-auto px-6 md:px-12 pb-4 ${isSubPage ? 'pt-1' : 'pt-8'}`}>

                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1">Glossy Collection</p>
                            <h1 className="font-serif font-light text-xl md:text-2xl text-stone-900 tracking-tight leading-none mb-2">
                                Glossy Art & Images
                            </h1>
                            <p className="text-sm text-stone-500 font-light max-w-lg leading-relaxed">
                                High-gloss photographic art prints in premium formats — vivid, luminous, and frame-ready for any interior.
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-[9px] uppercase tracking-[0.28em] text-stone-400 mb-1">COLLECTION</p>
                            <p className="font-serif text-3xl text-stone-900 font-light leading-none">
                                {filtered.length}<span className="text-xs text-stone-500 font-light ml-1">pieces</span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* FILTER BAR */}
            <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-[60px] z-20">
                <div className="overflow-x-auto no-scrollbar max-w-screen-xl mx-auto px-6 md:px-12 after:content-[''] after:pr-6 md:after:pr-12">
                    <div className="flex gap-8 min-w-max">
                    {SERIES_TABS.map(t => (
                        <button
                            key={t.value}
                            onClick={() => handleTabChange(t.value)}
                            className={`py-3 text-[11px] tracking-normal font-bold transition-all duration-300 border-b-2 whitespace-nowrap ${
                                activeSeries === t.value
                                    ? 'border-stone-900 text-stone-900'
                                    : 'border-transparent text-stone-400 hover:text-stone-600'
                            }`}
                        >
                            {t.label.includes('cm') ? formatDimensions(t.label, unit) : t.label}
                        </button>
                    ))}
                    </div>
                </div>
            </div>

            {/* GRID */}
            <main className="max-w-screen-xl mx-auto px-6 md:px-12 pt-6 pb-12">
                {filtered.length === 0 ? (
                    <div className="py-40 text-center text-stone-400 text-sm font-light">No items in this series.</div>
                ) : (
                    <>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-8">
                            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} pieces
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
                            {paginated.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onGetThis={handleGetThis}
                                    onCustomize={handleGetThis}
                                />
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="mt-16 flex items-center justify-center gap-1">
                                <button
                                    onClick={() => { setPage(p => Math.max(1, p - 1)); scrollToTop(); }}
                                    disabled={page === 1}
                                    className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors mr-3"
                                >
                                    <ChevronLeft size={13} strokeWidth={2.5} /> Prev
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                    <button
                                        key={n}
                                        onClick={() => { setPage(n); scrollToTop(); }}
                                        className={`w-9 h-9 text-[11px] font-black transition-all duration-150 ${page === n ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'}`}
                                    >
                                        {n}
                                    </button>
                                ))}
                                <button
                                    onClick={() => { setPage(p => Math.min(totalPages, p + 1)); scrollToTop(); }}
                                    disabled={page === totalPages}
                                    className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors ml-3"
                                >
                                    Next <ChevronRight size={13} strokeWidth={2.5} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* FOOTER CTA */}
            <footer className="border-t border-stone-200 bg-[#faf9f8]">
                <div className="max-w-screen-xl mx-auto px-6 md:px-12 py-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                    <div>
                        <p className="text-[9px] uppercase tracking-[0.3em] text-stone-400 font-black mb-2">Handcrafted in our studio</p>
                        <p className="font-serif font-light text-2xl text-stone-900">
                            Frame this glossy piece. <span className="text-stone-900 italic font-medium">Make it yours.</span>
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
        </div>
    );
};

export default GlossyArtPage;
