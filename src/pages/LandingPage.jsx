import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ChevronRight, ChevronLeft, Sparkles, Upload, Frame as FrameIcon, SlidersHorizontal, Eye, Truck } from 'lucide-react';
import { framesForCategory, displayCategoryName, displayFrameName, frameStartingPriceDisplay, frameCategoryDescription, PRODIGI_FRAME_CATEGORIES } from '../data/frameBrowsing';
import { CAROUSEL_SLIDES } from '../data/landingCarouselSlides';
import { openExternalLinkFromEvent as openExternalLink } from '../utils/nativeLinks';
import PageMeta from '../components/common/PageMeta';

export default function LandingPage({ onStartFraming, navigate, setSelectedFrame }) {
    const [activeCategory, setActiveCategory] = useState(PRODIGI_FRAME_CATEGORIES[0]);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loadedSlides, setLoadedSlides] = useState(() => new Set([0, 1]));
    const touchStartX = useRef(null);

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

    // Swipe left/right on the hero image to change slides on touch screens.
    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(deltaX) < 40) return;
        if (deltaX < 0) nextSlide();
        else prevSlide();
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentSlide(s => (s + 1) % CAROUSEL_SLIDES.length), 5000);
        return () => clearInterval(timer);
    }, [currentSlide]);

    
    // Pagination logic
    const filteredFrames = framesForCategory(activeCategory);
    const itemsPerPage = 12;
    const totalPages = Math.ceil(filteredFrames.length / itemsPerPage);
    const currentFrames = filteredFrames.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleCategoryChange = (cat) => {
        setActiveCategory(cat);
        setCurrentPage(1); // Reset to page 1 on category change
    };

    const handleFrameSelect = (frameStyle) => {
        if (setSelectedFrame) setSelectedFrame(frameStyle);
        if (navigate) navigate('/frame/customize');
        else if (onStartFraming) onStartFraming();
    };

    const handleStartAction = (e, slide) => {
        if (e) e.stopPropagation();
        const state = slide.triggersMetArt ? { openMetArt: true } : {};
        if (onStartFraming) onStartFraming(state);
        else if (navigate) navigate('/frame/customize', { state });
    };

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans antialiased overflow-x-hidden selection:bg-stone-200">
            <PageMeta
                title="Made-to-Order Frames & Canvas"
                description="Design made-to-order framed prints and canvas online, with live previews and delivery to the United Kingdom and Jersey."
            />
            {/* Header is handled globally by App.jsx */}

            
            {/* Hero Carousel Section */}
            <section className="relative pt-4 pb-8 sm:pt-10 lg:pt-20 lg:pb-8 w-full flex items-center bg-[#faf9f8] overflow-hidden">
                <div className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                    
                    {/* Left: Anchored Typography */}
                    <div className="order-2 lg:order-none lg:col-span-5 relative z-10 flex flex-col lg:self-stretch">
                        <div className="text-stone-400 font-bold tracking-widest text-xs uppercase mb-3 sm:mb-6 flex items-center gap-4 shrink-0">
                            <span className="w-8 h-[1px] bg-stone-300"></span>
                            {String(currentSlide + 1).padStart(2, '0')} &mdash; {String(CAROUSEL_SLIDES.length).padStart(2, '0')}
                        </div>
                        <div className="grid grid-cols-1 grid-rows-1 relative">
                            {CAROUSEL_SLIDES.map((slide, index) => (
                                <div
                                    key={index}
                                    aria-hidden={currentSlide !== index}
                                    inert={currentSlide !== index}
                                    className={`col-start-1 row-start-1 flex flex-col justify-start lg:justify-between transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                                        currentSlide === index
                                            ? 'opacity-100 translate-y-0 pointer-events-auto z-10'
                                            : 'opacity-0 translate-y-4 pointer-events-none z-0'
                                    }`}
                                >
                                    <div>
                                        <h1 className="text-[1.75rem] sm:text-4xl lg:text-7xl font-bold tracking-tighter leading-[1.08] mb-3 sm:mb-4 lg:mb-6 text-stone-900">
                                            {slide.title}
                                        </h1>
                                        <p className="text-sm sm:text-base lg:text-xl text-stone-600 max-w-lg leading-relaxed">
                                            {slide.text}
                                        </p>
                                    </div>
                                    <div className="mt-5 sm:mt-6">
                                        <button
                                            onClick={(e) => handleStartAction(e, slide)}
                                            className="group flex w-full sm:w-auto items-center justify-center sm:justify-start gap-3 sm:gap-4 rounded-full sm:rounded-none bg-stone-900 sm:bg-transparent px-6 py-3.5 sm:p-0 text-sm font-bold tracking-wide uppercase text-white sm:text-stone-900 sm:hover:text-stone-600 transition-colors"
                                        >
                                            <span className="sm:border-b-2 sm:border-stone-900 sm:pb-1 sm:group-hover:border-stone-600 transition-colors">Start Framing</span>
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                    {/* Right: Asymmetric Image Composition */}
                    <div
                        className="order-1 lg:order-none lg:col-span-7 relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:h-[75vh]"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* Decorative background box offset */}
                        <div className="absolute top-8 -right-8 w-full h-full bg-stone-200/50 hidden lg:block" />
                        
                        <div className="relative w-full h-full overflow-hidden rounded-xl lg:rounded-none shadow-xl lg:shadow-2xl bg-stone-100">
                            {CAROUSEL_SLIDES.map((slide, index) => {
                                const isLoaded = loadedSlides.has(index);
                                return (
                                    <div 
                                        key={index}
                                        className={`absolute inset-0 w-full h-full transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                                            currentSlide === index ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'
                                        }`}
                                    >
                                        <div className="absolute inset-0 bg-stone-900 transition-opacity duration-1000" style={{opacity: currentSlide === index ? 0 : 0.3}} />
                                        {isLoaded && (
                                            <img 
                                                src={slide.img} 
                                                alt={slide.title} 
                                                loading={index === 0 ? "eager" : "lazy"}
                                                fetchPriority={index === 0 ? "high" : "low"}
                                                decoding={index === 0 ? "sync" : "async"}
                                                className="w-full h-full object-cover" 
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Minimalist Controls Overlayed on Image — flush against the
                            slide's own left edge (lg:-left-6 used to push this outside
                            the image onto the page background instead). */}
                        <div className="absolute bottom-3 left-3 lg:bottom-6 lg:left-0 z-30 flex gap-0 shadow-xl overflow-hidden rounded-full lg:rounded-sm">
                            <button 
                                onClick={prevSlide}
                                aria-label="Previous slide"
                                className="w-11 h-11 lg:w-14 lg:h-14 bg-white/70 lg:bg-white/60 backdrop-blur-md text-stone-900 flex items-center justify-center hover:bg-white/90 transition-all border-r border-white/20"
                            >
                                <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
                            </button>
                            <button 
                                onClick={nextSlide}
                                aria-label="Next slide"
                                className="w-11 h-11 lg:w-14 lg:h-14 bg-white/70 lg:bg-white/60 backdrop-blur-md text-stone-900 flex items-center justify-center hover:bg-white/90 transition-all"
                            >
                                <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" />
                            </button>
                        </div>
                    </div>

                </div>
            </section>

{/* Categorized Gallery Section */}
            <section id="curated-frames" className="py-10 lg:py-16 bg-white relative overflow-hidden scroll-mt-14">
                <div className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-6 lg:mb-12">
                        <div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 mb-2 sm:mb-4">Frame Catalogue</h2>
                            <p className="text-sm sm:text-[1rem] text-stone-500 max-w-2xl leading-relaxed">
                                Explore made-to-order frames and canvases across classic wood, deep box, slim aluminium, traditional canvas, floating canvas, recycled canvas and stretched canvas styles.
                            </p>
                        </div>
                    </div>
                    
                    {/* Category Tabs */}
                    <div className="flex overflow-x-auto gap-2 pb-3 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
                        {PRODIGI_FRAME_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => handleCategoryChange(cat)}
                                aria-pressed={activeCategory === cat}
                                className={`snap-start px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-stone-900 text-white shadow-md' : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                            >
                                {displayCategoryName(cat)}
                            </button>
                        ))}
                    </div>
                    <p aria-live="polite" className="mb-6 lg:mb-8 text-sm leading-6 text-stone-600">
                        {frameCategoryDescription(activeCategory)}
                    </p>

                    {/* Frame Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 sm:gap-6 mb-8 lg:mb-12">
                        {currentFrames.map((frame) => (
                            <div key={frame.id} className="group cursor-pointer" onClick={() => handleFrameSelect(frame)}>
                                <div className="aspect-square rounded-xl sm:rounded-2xl bg-stone-100 overflow-hidden mb-2.5 sm:mb-4 relative transition-transform duration-500 group-hover:scale-[1.02]">
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

            


            {/* Info Section */}
            <section className="py-10 sm:py-12 bg-stone-50 border-t border-stone-200">
                <div className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="text-center mb-8 sm:mb-12">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 mb-2">How It Works</h2>
                        <p className="text-stone-500 max-w-2xl mx-auto">Five simple steps to museum-quality framing.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-y-6 sm:gap-y-10 gap-x-6 sm:text-center">
                        {[
                            { icon: Upload, title: 'Choose or Upload Your Image', desc: "Upload your own photo, print, or artwork, or choose a free public-domain masterpiece — we'll optimize it for the sharpest possible print." },
                            { icon: FrameIcon, title: 'Choose Your Frame', desc: 'Explore curated frame styles, from natural woods to hand-finished ornate mouldings.' },
                            { icon: SlidersHorizontal, title: 'Choose Your Customizations', desc: 'Dial in size, mount, glazing, and hardware — your price updates instantly to match exactly what you choose.' },
                            { icon: Eye, title: 'Preview the End Product', desc: 'See your exact piece rendered true-to-scale in our visualizer, then step into AR to see it on your own wall in 3D.' },
                            { icon: Truck, title: 'Place Your Order', desc: 'Handcrafted locally and delivered ready to hang within 5-7 business days.' },
                        ].map((step, i) => (
                            <div key={step.title} className="flex flex-row sm:flex-col items-start sm:items-center gap-4 sm:gap-0">
                                <div className="relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center sm:mb-6">
                                    <step.icon size={24} strokeWidth={1.75} className="text-[#c9a84c]" />
                                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base lg:text-lg font-bold text-stone-900 mb-1 sm:mb-2">{step.title}</h3>
                                    <p className="text-stone-500 text-sm leading-relaxed sm:max-w-[220px] sm:mx-auto">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>


            {/* Bubola-style Info & Footer Section */}
            <section className="bg-stone-900 text-stone-300 py-12 sm:py-24 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] sm:pb-24">
                <div className="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-12">


                    {/* 4-Column Footer */}
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
