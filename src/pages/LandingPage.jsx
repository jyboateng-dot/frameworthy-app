import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ChevronRight, ChevronLeft, Sparkles, Upload, Eye, Truck, Landmark, Images, Smartphone, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { framesForCategory, displayCategoryName, displayFrameName, frameStartingPriceDisplay, frameCategoryDescription, PRODIGI_FRAME_CATEGORIES } from '../data/frameBrowsing';
import { CAROUSEL_SLIDES } from '../data/landingCarouselSlides';
import { openExternalLinkFromEvent as openExternalLink } from '../utils/nativeLinks';
import PageMeta from '../components/common/PageMeta';
import MobileLanding from './landing/MobileLanding';

// Phones get their own home page layout (see MobileLanding); tablets and
// desktops use the modern 4-step fit-to-pc layout below.
const PHONE_QUERY = '(max-width: 767px)';

function isForcedPhonePreview() {
    return import.meta.env.DEV
        && typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).get('mobile') === '1';
}

function useIsPhone() {
    const [isPhone, setIsPhone] = useState(() => isForcedPhonePreview()
        || (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches));
    useEffect(() => {
        if (isForcedPhonePreview()) {
            setIsPhone(true);
            return undefined;
        }
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const query = window.matchMedia(PHONE_QUERY);
        const update = () => setIsPhone(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return isPhone;
}

const BENEFITS = [
    { icon: Eye, title: 'Live preview as you design', desc: 'Watch frames, mounts, and glazing update live.' },
    { icon: Smartphone, title: 'See it on your wall in AR', desc: 'Project your piece onto your wall at true physical scale.' },
    { icon: CheckCircle2, title: 'Handcrafted, ready to hang', desc: 'Locally built with premium wood, glass, and hardware.' },
    { icon: ShieldCheck, title: 'Secure checkout', desc: 'Guest checkout available with protected payments.' },
];

export default function LandingPage({ onStartFraming, navigate, setSelectedFrame }) {
    const [activeCategory, setActiveCategory] = useState(PRODIGI_FRAME_CATEGORIES[0]);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loadedSlides, setLoadedSlides] = useState(() => new Set([0, 1]));
    const isPhone = useIsPhone();

    useEffect(() => {
        try {
            const savedScroll = sessionStorage.getItem('met_art_homepage_scroll');
            if (savedScroll !== null) {
                sessionStorage.removeItem('met_art_homepage_scroll');
                const scrollY = Number(savedScroll);
                if (!isNaN(scrollY) && scrollY > 0) {
                    const restore = () => window.scrollTo({ top: scrollY, behavior: 'instant' });
                    restore();
                    requestAnimationFrame(restore);
                    setTimeout(restore, 50);
                    setTimeout(restore, 150);
                }
            }
        } catch (_) {}
    }, []);

    const nextSlide = () => {
        setCurrentSlide(s => (s + 1) % CAROUSEL_SLIDES.length);
    };

    const prevSlide = () => {
        setCurrentSlide(s => (s - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length);
    };

    useEffect(() => {
        setLoadedSlides(prev => {
            const next = new Set(prev);
            const count = CAROUSEL_SLIDES.length;
            next.add(currentSlide);
            next.add((currentSlide + 1) % count);
            next.add((currentSlide - 1 + count) % count);
            return next;
        });
    }, [currentSlide]);

    const allFrames = framesForCategory(activeCategory);
    const framesPerPage = 8;
    const totalPages = Math.ceil(allFrames.length / framesPerPage);
    const currentFrames = allFrames.slice((currentPage - 1) * framesPerPage, currentPage * framesPerPage);

    const handleCategoryChange = (cat) => {
        setActiveCategory(cat);
        setCurrentPage(1);
    };

    const handleFrameSelect = (frameStyle) => {
        if (setSelectedFrame) setSelectedFrame(frameStyle);
        if (navigate) navigate('/frame/customize');
        else if (onStartFraming) onStartFraming();
    };

    const startFraming = (state = {}) => {
        if (onStartFraming) onStartFraming(state);
        else if (navigate) navigate('/frame/customize', { state });
    };

    const handleStartAction = (e, slide) => {
        if (e) e.stopPropagation();
        const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
        if (slide?.triggersMetArt) {
            try {
                sessionStorage.setItem('met_art_homepage_scroll', String(scrollY));
            } catch (_) {}
        }
        const state = slide?.triggersMetArt ? {
            openMetArt: true,
            returnOnClose: true,
            returnScrollY: scrollY,
            returnTo: '/'
        } : {};
        if (onStartFraming) onStartFraming(state);
        else if (navigate) navigate('/frame/customize', { state });
    };

    const handleMuseumMasterpiecesClick = (e) => {
        if (e) e.stopPropagation();
        const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
        try {
            sessionStorage.setItem('met_art_homepage_scroll', String(scrollY));
        } catch (_) {}
        startFraming({
            openMetArt: true,
            returnOnClose: true,
            returnScrollY: scrollY,
            returnTo: '/'
        });
    };

    const handleCuratedArtClick = (e) => {
        if (e) e.stopPropagation();
        if (navigate) navigate('/curated-art');
    };

    const pageMeta = (
        <PageMeta
            title="Made-to-Order Frames & Canvas"
            description="Design made-to-order framed prints and canvas online, with live previews and delivery to the United Kingdom and Jersey."
        />
    );

    if (isPhone) {
        return (
            <>
                {pageMeta}
                <MobileLanding navigate={navigate} onStartFraming={onStartFraming} onSelectFrame={handleFrameSelect} />
            </>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans antialiased overflow-x-hidden selection:bg-stone-200">
            {pageMeta}

            {/* Cinematic Hero Carousel Section */}
            <section className="relative w-full max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12 pt-4 sm:pt-6 pb-4 sm:pb-6">
                <div className="relative w-full h-[520px] sm:h-[580px] lg:h-[620px] xl:h-[660px] rounded-3xl overflow-hidden shadow-2xl bg-stone-900">
                    {/* Background Slide Images with Crossfade */}
                    {CAROUSEL_SLIDES.map((slide, index) => {
                        const isLoaded = loadedSlides.has(index);
                        const isActive = currentSlide === index;
                        return (
                            <div
                                key={slide.img}
                                aria-hidden={!isActive}
                                className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                                    isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                                }`}
                            >
                                {isLoaded && (
                                    <img
                                        src={slide.img}
                                        alt={slide.title}
                                        loading={index === 0 ? 'eager' : 'lazy'}
                                        fetchPriority={index === 0 ? 'high' : 'low'}
                                        decoding={index === 0 ? 'sync' : 'async'}
                                        className="w-full h-full object-cover object-center"
                                    />
                                )}
                            </div>
                        );
                    })}

                    {/* Gradient Scrims: Dark left scrim for text legibility, subtle bottom vignette */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-transparent z-20 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-20 pointer-events-none" />

                    {/* Left: Anchored Typography & Action */}
                    <div className="relative z-30 h-full flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 max-w-2xl lg:max-w-3xl">
                        {/* Slide Indicator */}
                        <div className="flex items-center gap-3 text-white/70 text-xs font-bold uppercase tracking-widest">
                            <span className="w-8 h-[1px] bg-white/40" />
                            <span>{String(currentSlide + 1).padStart(2, '0')} &mdash; {String(CAROUSEL_SLIDES.length).padStart(2, '0')}</span>
                        </div>

                        {/* Slide Content */}
                        <div className="my-auto py-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold tracking-[0.2em] uppercase text-[#e3c66d] border border-white/15 mb-4">
                                <Sparkles size={12} className="text-[#e3c66d]" /> Custom Framing, Made to Order
                            </span>
                            <div className="grid grid-cols-1 grid-rows-1 relative">
                                {CAROUSEL_SLIDES.map((slide, index) => {
                                    const isActive = currentSlide === index;
                                    return (
                                        <div
                                            key={index}
                                            aria-hidden={!isActive}
                                            inert={!isActive}
                                            className={`col-start-1 row-start-1 flex flex-col transition-all duration-500 ease-out ${
                                                isActive
                                                    ? 'opacity-100 translate-y-0 pointer-events-auto z-10'
                                                    : 'opacity-0 translate-y-4 pointer-events-none z-0'
                                            }`}
                                        >
                                            <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-white leading-[1.08] mb-4 drop-shadow-sm">
                                                {slide.title}
                                            </h1>
                                            <p className="text-sm sm:text-base lg:text-lg text-white/85 leading-relaxed max-w-xl">
                                                {slide.text}
                                            </p>
                                            <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
                                                <button
                                                    onClick={(e) => handleStartAction(e, slide)}
                                                    className="flex items-center gap-2.5 rounded-full bg-[#c9a84c] hover:bg-[#d4b458] text-[#0a0a0a] px-7 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    Start Framing <ArrowRight className="w-5 h-5" />
                                                </button>
                                                <a
                                                    href="#curated-frames"
                                                    className="px-5 py-3.5 sm:px-6 sm:py-4 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-semibold border border-white/20 transition-all"
                                                >
                                                    Browse frames
                                                </a>
                                                <button
                                                    onClick={handleCuratedArtClick}
                                                    className="px-5 py-3.5 sm:px-6 sm:py-4 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-semibold border border-white/20 transition-all"
                                                >
                                                    Browse Public Domain Art
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bottom Bar: Indicators & Controls */}
                        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/15">
                            {/* Slide Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[60%] hide-scrollbar py-1">
                                {CAROUSEL_SLIDES.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentSlide(idx)}
                                        aria-label={`Go to slide ${idx + 1}`}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${
                                            currentSlide === idx ? 'w-8 bg-[#c9a84c]' : 'w-2 bg-white/40 hover:bg-white/70'
                                        }`}
                                    />
                                ))}
                            </div>

                            {/* Minimal Carousel Arrows */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={prevSlide}
                                    aria-label="Previous slide"
                                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center border border-white/20 transition-all"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={nextSlide}
                                    aria-label="Next slide"
                                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center border border-white/20 transition-all"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Value Proposition & Trust Bar */}
            <section className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12 py-3 lg:py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                    {BENEFITS.map((item) => (
                        <div
                            key={item.title}
                            className="flex items-center gap-3.5 rounded-2xl bg-white border border-stone-200/80 p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="w-11 h-11 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-center shrink-0">
                                <item.icon size={20} strokeWidth={1.75} className="text-stone-900" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-stone-900 leading-snug">{item.title}</h3>
                                <p className="text-xs text-stone-500 leading-normal mt-0.5">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Step One: What would you like to frame? */}
            <section className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-12">
                <div className="mb-6 lg:mb-8">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8892f] mb-1.5">Step one</p>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900">
                        What would you like to frame?
                    </h2>
                    <p className="mt-1 text-sm sm:text-base text-stone-500">
                        Upload from your device or pick a free museum masterpiece.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
                    {/* Primary Large Card: User Upload */}
                    <button
                        onClick={() => startFraming()}
                        className="group relative lg:col-span-7 xl:col-span-8 flex flex-col justify-end h-[360px] sm:h-[420px] lg:h-[460px] overflow-hidden rounded-3xl text-left shadow-sm hover:shadow-xl transition-all"
                    >
                        <img
                            src="/landing_carousel/slide-upload.webp"
                            alt="Upload your own photo or artwork"
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col justify-end">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#e3c66d] bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 w-fit mb-3">
                                <Upload size={14} /> From your device or cloud
                            </span>
                            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 leading-tight">
                                Your own photo or artwork
                            </h3>
                            <p className="text-white/80 text-sm sm:text-base max-w-lg mb-4 leading-relaxed">
                                Upload treasured memories, photography or digital prints. We'll optimize and calibrate them to the sharpest possible print.
                            </p>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white group-hover:bg-[#c9a84c] text-stone-900 group-hover:text-[#0a0a0a] px-5 py-2.5 text-sm font-bold w-fit shadow-md transition-colors">
                                Start with your photo <ArrowRight size={16} />
                            </span>
                        </div>
                    </button>

                    {/* Secondary 2-Stack Cards: Museum Masterpieces & Public Domain Art */}
                    <div className="lg:col-span-5 xl:col-span-4 flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-col gap-4 lg:gap-6">
                        {/* Museum Masterpieces */}
                        <button
                            onClick={handleMuseumMasterpiecesClick}
                            className="group relative flex-1 flex flex-col justify-end h-[200px] sm:h-[220px] overflow-hidden rounded-3xl text-left shadow-sm hover:shadow-xl transition-all"
                        >
                            <img
                                src="/landing_carousel/slide-museum-masterpieces.webp"
                                alt="Museum Masterpieces"
                                loading="lazy"
                                decoding="async"
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                            <div className="relative p-5 sm:p-6">
                                <div className="flex items-center gap-2 text-xs font-bold text-[#e3c66d] uppercase tracking-wider mb-1">
                                    <Landmark size={15} /> The Met Archive
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                                    Museum Masterpieces
                                </h3>
                                <p className="text-white/80 text-xs sm:text-sm line-clamp-2">
                                    Browse Van Gogh, Monet, Rembrandt and thousands of public-domain fine art treasures.
                                </p>
                            </div>
                        </button>

                        {/* Public Domain Art */}
                        <button
                            onClick={handleCuratedArtClick}
                            className="group relative flex-1 flex flex-col justify-end h-[200px] sm:h-[220px] overflow-hidden rounded-3xl text-left shadow-sm hover:shadow-xl transition-all"
                        >
                            <img
                                src="/landing_carousel/slide-curated-collections.webp"
                                alt="Public Domain Art"
                                loading="lazy"
                                decoding="async"
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                            <div className="relative p-5 sm:p-6">
                                <div className="flex items-center gap-2 text-xs font-bold text-[#e3c66d] uppercase tracking-wider mb-1">
                                    <Images size={15} /> Curated Art
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                                    Public Domain Art
                                </h3>
                                <p className="text-white/80 text-xs sm:text-sm line-clamp-2">
                                    Explore vintage posters, botanicals, Japanese woodblocks, and gallery prints.
                                </p>
                            </div>
                        </button>
                    </div>
                </div>
            </section>

            {/* Step Two: Pick your frame */}
            <section id="curated-frames" className="py-10 lg:py-16 bg-white relative overflow-hidden scroll-mt-14">
                <div className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="mb-6 lg:mb-8">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8892f] mb-1.5">Step two</p>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 mb-2 sm:mb-4">
                            Pick your frame
                        </h2>
                        <p className="text-sm sm:text-base text-stone-500 max-w-2xl leading-relaxed">
                            Explore made-to-order frames and canvases across classic wood, deep box, slim aluminium, and canvas styles.
                        </p>
                    </div>
                    
                    {/* Category Tabs */}
                    <div className="flex overflow-x-auto gap-2 pb-3 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
                        {PRODIGI_FRAME_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => handleCategoryChange(cat)}
                                aria-pressed={activeCategory === cat}
                                className={`snap-start px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                                    activeCategory === cat
                                        ? 'bg-stone-900 text-white shadow-md'
                                        : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                                }`}
                            >
                                {displayCategoryName(cat)}
                            </button>
                        ))}
                    </div>
                    <p aria-live="polite" className="mb-6 lg:mb-8 text-sm leading-6 text-stone-600">
                        {frameCategoryDescription(activeCategory)}
                    </p>

                    {/* Frame Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 sm:gap-6 mb-8 lg:mb-12">
                        {currentFrames.map((frame) => (
                            <div key={frame.id} className="group cursor-pointer" onClick={() => handleFrameSelect(frame)}>
                                <div className="aspect-square rounded-2xl bg-stone-100 overflow-hidden mb-3 relative transition-transform duration-500 group-hover:scale-[1.02]">
                                    <img
                                        src={frame.thumbnailImage || frame.cornerImage || frame.previewImg || `/frames/${frame.filename}`}
                                        alt={frame.name}
                                        loading="lazy"
                                        decoding="async"
                                        style={frame.thumbnailCrop ? {
                                            transform: `scale(${frame.thumbnailCrop.scale})`,
                                            transformOrigin: frame.thumbnailCrop.origin,
                                        } : undefined}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                                    />
                                    <div className="absolute inset-0 shadow-[inset_0_0_46px_12px_rgba(28,26,23,0.18)] pointer-events-none" />
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/10 transition-opacity duration-300 z-10" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                            <ArrowRight className="w-5 h-5 text-stone-900" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-stone-900 mb-0.5 sm:mb-1">{displayFrameName(frame)}</h3>
                                    <p className="text-sm text-stone-500">{frameStartingPriceDisplay(frame)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                aria-label="Previous page"
                                disabled={currentPage === 1}
                                className="p-3 sm:p-2 rounded-full bg-stone-50 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm font-semibold text-stone-500">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                aria-label="Next page"
                                disabled={currentPage === totalPages}
                                className="p-3 sm:p-2 rounded-full bg-stone-50 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* Step Three: See it on your wall before you buy */}
            <section className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-12">
                <div className="overflow-hidden rounded-3xl bg-stone-900 text-white shadow-2xl">
                    <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                        <div className="lg:col-span-7 relative h-[360px] sm:h-[440px] lg:h-[540px]">
                            <img
                                src="/landing_carousel/frameworthy-3d-ar.webp"
                                alt="Previewing a framed print on a living room wall through a phone"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover object-center"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-stone-900/60 via-transparent to-transparent pointer-events-none" />
                        </div>
                        <div className="lg:col-span-5 p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-center">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e3c66d] mb-2">Step three</p>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight mb-4">
                                See it on your wall before you buy
                            </h2>
                            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6">
                                Experience your custom creation in real time before placing your order. No guesswork on scale, mounting, or lighting.
                            </p>
                            <ul className="space-y-4 text-sm sm:text-base text-white/85 mb-8">
                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <Eye size={18} className="text-[#e3c66d]" />
                                    </div>
                                    <span><strong>Live visualizer:</strong> Watch your frame, matting and glazing update in real time. Your price updates live.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <Images size={18} className="text-[#e3c66d]" />
                                    </div>
                                    <span><strong>Calibrated room scenes:</strong> Compare size options against realistic sofas, headboards, and dining spaces.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <Smartphone size={18} className="text-[#e3c66d]" />
                                    </div>
                                    <span><strong>True-scale 3D AR:</strong> Place the framed artwork directly onto your own wall using your phone.</span>
                                </li>
                            </ul>
                            <div>
                                <button
                                    onClick={() => startFraming()}
                                    className="flex items-center gap-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-900 px-7 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-bold shadow-md hover:shadow-lg transition-all"
                                >
                                    Try the preview <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Step Four: Delivered to your door, ready to hang */}
            <section className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-12">
                <div className="overflow-hidden rounded-3xl bg-white border border-stone-200/90 shadow-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                        <div className="lg:col-span-5 order-2 lg:order-1 p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-center">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8892f] mb-2">Step four</p>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 leading-tight mb-4">
                                Delivered to your door, ready to hang
                            </h2>
                            <p className="text-stone-500 text-sm sm:text-base leading-relaxed mb-6">
                                Handcrafted by specialist picture framers and shipped in custom-engineered packaging.
                            </p>
                            <ul className="space-y-4 text-sm sm:text-base text-stone-600 mb-8">
                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-200/60 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle2 size={18} className="text-stone-900" />
                                    </div>
                                    <span><strong>Handcrafted to your exact choices:</strong> Precision-milled timber, acid-free mats, and pre-installed hanging wire.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-200/60 flex items-center justify-center shrink-0 mt-0.5">
                                        <Truck size={18} className="text-stone-900" />
                                    </div>
                                    <span><strong>Fast UK &amp; Jersey delivery:</strong> Direct delivery in 5–7 business days with end-to-end tracking.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-200/60 flex items-center justify-center shrink-0 mt-0.5">
                                        <ShieldCheck size={18} className="text-stone-900" />
                                    </div>
                                    <span><strong>Secure guest checkout:</strong> Order with confidence in under two minutes. No account required.</span>
                                </li>
                            </ul>
                            <div>
                                <button
                                    onClick={() => startFraming()}
                                    className="flex items-center gap-2.5 rounded-full bg-[#c9a84c] hover:bg-[#d4b458] text-[#0a0a0a] px-8 py-4 text-base font-bold shadow-md hover:shadow-lg transition-all"
                                >
                                    Start Framing Now <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="lg:col-span-7 order-1 lg:order-2 relative h-[360px] sm:h-[440px] lg:h-[540px]">
                            <img
                                src="/landing_carousel/slide-delivered-door.webp"
                                alt="A FrameWorthy delivery arriving at a front door"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover object-center"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* 4-Column Footer */}
            <section className="bg-stone-900 text-stone-300 py-12 sm:py-24 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] sm:pb-24">
                <div className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-10 sm:mb-16 text-sm">
                        {/* Col 1 */}
                        <div>
                            <h6 className="text-white font-bold uppercase tracking-widest text-xs mb-3 sm:mb-6">Frameworthy&amp;co</h6>
                            <p className="leading-loose">
                                Esplanade, St Helier<br />
                                Jersey, JE2 3AS
                            </p>
                        </div>

                        {/* Col 2 */}
                        <div>
                            <h6 className="text-white font-bold uppercase tracking-widest text-xs mb-3 sm:mb-6">Contact</h6>
                            <p className="leading-loose">
                                Tel: <a href="tel:+447797789598" className="hover:text-white transition-colors">+44 7797 789598</a><br />
                                Email: <a href="mailto:admin@frameworthyco.com" className="hover:text-white transition-colors">admin@frameworthyco.com</a>
                            </p>
                        </div>

                        {/* Col 3 */}
                        <div>
                            <h6 className="text-white font-bold uppercase tracking-widest text-xs mb-3 sm:mb-6">Support &amp; Legal</h6>
                            <div className="leading-loose flex flex-col gap-1 items-start">
                                <button onClick={() => navigate && navigate('/help')} className="hover:text-white transition-colors text-left py-1 sm:py-0 font-bold text-[#c9a84c]">Help Centre</button>
                                <button onClick={() => navigate && navigate('/terms')} className="hover:text-white transition-colors text-left py-1 sm:py-0">Terms of Service</button>
                                <button onClick={() => navigate && navigate('/privacy')} className="hover:text-white transition-colors text-left py-1 sm:py-0">Privacy Policy</button>
                                <button onClick={() => navigate && navigate('/refund-policy')} className="hover:text-white transition-colors text-left py-1 sm:py-0">Refund &amp; Return Policy</button>
                                <button onClick={() => navigate && navigate('/delivery-policy')} className="hover:text-white transition-colors text-left py-1 sm:py-0">Delivery Policy</button>
                            </div>
                        </div>

                        {/* Col 4 */}
                        <div>
                            <h6 className="text-white font-bold uppercase tracking-widest text-xs mb-3 sm:mb-6">Follow us</h6>
                            <div className="flex flex-wrap gap-3 sm:gap-4">
                                <a href="https://instagram.com/frameworthyco" onClick={(e) => openExternalLink(e, 'https://instagram.com/frameworthyco')} target="_blank" rel="noopener noreferrer" title="Instagram" className="w-11 h-11 sm:w-10 sm:h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                                </a>
                                <a href="https://facebook.com/frameworthyco" onClick={(e) => openExternalLink(e, 'https://facebook.com/frameworthyco')} target="_blank" rel="noopener noreferrer" title="Facebook" className="w-11 h-11 sm:w-10 sm:h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                                </a>
                                <a href="https://x.com/frameworthyco" onClick={(e) => openExternalLink(e, 'https://x.com/frameworthyco')} target="_blank" rel="noopener noreferrer" title="Twitter / X" className="w-11 h-11 sm:w-10 sm:h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
                                </a>
                                <a href="https://linkedin.com/company/frameworthyco" onClick={(e) => openExternalLink(e, 'https://linkedin.com/company/frameworthyco')} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="w-11 h-11 sm:w-10 sm:h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                                </a>
                                <a href="https://wa.me/233261549517" onClick={(e) => openExternalLink(e, 'https://wa.me/233261549517')} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-11 h-11 sm:w-10 sm:h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Copyright Row */}
                    <div className="pt-8 border-t border-stone-800 text-center text-xs text-stone-500 tracking-wider">
                        copyright © {new Date().getFullYear()} Frameworthy&amp;co | <button onClick={() => navigate && navigate('/privacy')} className="hover:text-stone-300">privacy &amp; cookies</button> | powered by FrameWorthy
                    </div>
                </div>
            </section>
        </div>
    );
}
