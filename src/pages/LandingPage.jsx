import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronRight, ChevronLeft, Sparkles, Upload, Frame as FrameIcon, SlidersHorizontal, Eye, Truck } from 'lucide-react';
import { framesForCategory, displayCategoryName, displayFrameName, PRODIGI_FRAME_CATEGORIES } from '../data/frameBrowsing';
import { CAROUSEL_SLIDES } from '../data/landingCarouselSlides';
import { openExternalLinkFromEvent as openExternalLink } from '../utils/nativeLinks';
import PageMeta from '../components/common/PageMeta';

export default function LandingPage({ onStartFraming, navigate, setSelectedFrame }) {
    const [activeCategory, setActiveCategory] = useState(PRODIGI_FRAME_CATEGORIES[0]);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = () => {
        setCurrentSlide(s => (s + 1) % CAROUSEL_SLIDES.length);
    };

    const prevSlide = () => {
        setCurrentSlide(s => (s - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length);
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentSlide(s => (s + 1) % CAROUSEL_SLIDES.length), 5000);
        return () => clearInterval(timer);
    }, [currentSlide]);

    
    // Pagination logic
    const filteredFrames = framesForCategory(activeCategory);
    const prodigiFrameCount = PRODIGI_FRAME_CATEGORIES.reduce((count, category) => count + framesForCategory(category).length, 0);
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
                title="Custom Picture Framing in Ghana"
                description="Design and order custom-framed prints, photos, and art online. Premium moulding, mats, and glazing, delivered nationwide across Ghana."
            />
            {/* Header is handled globally by App.jsx */}

            
            {/* Hero Carousel Section */}
            <section className="relative pt-16 pb-4 lg:pt-20 lg:pb-8 w-full flex items-center bg-[#faf9f8] overflow-hidden">
                <div className="max-w-[2560px] mx-auto px-6 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
                    
                    {/* Left: Anchored Typography */}
                    <div className="lg:col-span-5 relative z-10 flex flex-col lg:self-stretch">
                        <div className="text-stone-400 font-bold tracking-widest text-xs uppercase mb-6 flex items-center gap-4 shrink-0">
                            <span className="w-8 h-[1px] bg-stone-300"></span>
                            {String(currentSlide + 1).padStart(2, '0')} &mdash; {String(CAROUSEL_SLIDES.length).padStart(2, '0')}
                        </div>
                        <div className="relative">
                            {CAROUSEL_SLIDES.map((slide, index) => (
                                <div
                                    key={index}
                                    aria-hidden={currentSlide !== index}
                                    inert={currentSlide !== index}
                                    className={`transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                                        currentSlide === index
                                            ? 'relative opacity-100 translate-y-0 pointer-events-auto z-10'
                                            : 'absolute inset-x-0 top-0 opacity-0 translate-y-8 pointer-events-none z-0'
                                    }`}
                                >
                                    <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter leading-[1.05] mb-6 text-stone-900">
                                        {slide.title}
                                    </h1>
                                    <p className="text-lg lg:text-xl text-stone-600 max-w-lg leading-relaxed">
                                        {slide.text}
                                    </p>
                                    <div className="mt-4">
                                        <button
                                            onClick={(e) => handleStartAction(e, slide)}
                                            className="group flex items-center gap-4 text-sm font-bold tracking-wide uppercase text-stone-900 hover:text-stone-600 transition-colors"
                                        >
                                            <span className="border-b-2 border-stone-900 pb-1 group-hover:border-stone-600 transition-colors">Start Framing</span>
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                    {/* Right: Asymmetric Image Composition */}
                    <div className="lg:col-span-7 relative h-[50vh] lg:h-[75vh] w-full">
                        {/* Decorative background box offset */}
                        <div className="absolute top-8 -right-8 w-full h-full bg-stone-200/50 hidden lg:block" />
                        
                        <div className="relative w-full h-full overflow-hidden shadow-2xl bg-stone-100">
                            {CAROUSEL_SLIDES.map((slide, index) => (
                                <div 
                                    key={index}
                                    className={`absolute inset-0 w-full h-full transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                                        currentSlide === index ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'
                                    }`}
                                >
                                    <div className="absolute inset-0 bg-stone-900 transition-opacity duration-1000" style={{opacity: currentSlide === index ? 0 : 0.3}} />
                                    <img src={slide.img} alt={slide.title} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>

                        {/* Minimalist Controls Overlayed on Image — flush against the
                            slide's own left edge (lg:-left-6 used to push this outside
                            the image onto the page background instead). */}
                        <div className="absolute bottom-6 left-0 z-30 flex gap-0 shadow-xl overflow-hidden rounded-sm">
                            <button 
                                onClick={prevSlide}
                                aria-label="Previous slide"
                                className="w-14 h-14 bg-white/60 backdrop-blur-md text-stone-900 flex items-center justify-center hover:bg-white/90 transition-all border-r border-white/20"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={nextSlide}
                                aria-label="Next slide"
                                className="w-14 h-14 bg-white/60 backdrop-blur-md text-stone-900 flex items-center justify-center hover:bg-white/90 transition-all"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                </div>
            </section>

{/* Categorized Gallery Section */}
            <section id="curated-frames" className="py-12 lg:py-16 bg-white relative overflow-hidden">
                <div className="max-w-[2560px] mx-auto px-6 lg:px-12">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12">
                        <div>
                            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 mb-4">Curated Frame Collection</h2>
                            <p className="text-stone-500 max-w-md">Browse {prodigiFrameCount} Prodigi frame and canvas options, organized by product style.</p>
                        </div>
                    </div>
                    
                    {/* Category Tabs */}
                    <div className="flex overflow-x-auto gap-2 pb-6 mb-4 hide-scrollbar">
                        {PRODIGI_FRAME_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => handleCategoryChange(cat)}
                                aria-pressed={activeCategory === cat}
                                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-stone-900 text-white shadow-md' : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                            >
                                {displayCategoryName(cat)}
                            </button>
                        ))}
                    </div>

                    {/* Frame Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-6 mb-12">
                        {currentFrames.map((frame) => (
                            <div key={frame.id} className="group cursor-pointer" onClick={() => handleFrameSelect(frame)}>
                                <div className="aspect-square rounded-2xl bg-stone-100 overflow-hidden mb-3 relative transition-transform duration-300 group-hover:scale-[1.02]">
                                    <img
                                        src={frame.cornerImage || frame.previewImg || `/frames/${frame.filename}`}
                                        alt={frame.name}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                    />
                                </div>
                                
                                <div>
                                    <h3 className="text-sm font-bold text-stone-900 leading-tight">{displayFrameName(frame)}</h3>
                                    <p className="mt-1.5 text-xs text-stone-500">{displayCategoryName(frame.category)}</p>
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
                                className="p-2 rounded-full bg-stone-50 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors"
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
                                className="p-2 rounded-full bg-stone-50 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </section>

            


            {/* Info Section */}
            <section className="py-12 bg-stone-50 border-t border-stone-200">
                <div className="max-w-[2560px] mx-auto px-6 lg:px-12">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 mb-2">How It Works</h2>
                        <p className="text-stone-500 max-w-2xl mx-auto">Five simple steps to museum-quality framing.</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-10 gap-x-6 text-center">
                        {[
                            { icon: Upload, title: 'Upload Your Image', desc: "Bring your photo, print, or artwork — we'll optimize it for the sharpest possible print." },
                            { icon: FrameIcon, title: 'Choose Your Frame', desc: 'Browse hundreds of styles, from natural woods to hand-finished ornate mouldings.' },
                            { icon: SlidersHorizontal, title: 'Choose Your Customizations', desc: 'Dial in size, mat, glass, and hardware — your price updates instantly to match exactly what you choose.' },
                            { icon: Eye, title: 'Preview the End Product', desc: 'See your exact piece rendered true-to-scale in our visualizer, then step into AR to see it on your own wall in 3D.' },
                            { icon: Truck, title: 'Place Your Order', desc: 'Handcrafted locally and delivered ready to hang within 5-7 business days.' },
                        ].map((step, i) => (
                            <div key={step.title} className="flex flex-col items-center">
                                <div className="relative w-16 h-16 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center mb-6">
                                    <step.icon size={24} strokeWidth={1.75} className="text-[#c9a84c]" />
                                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                </div>
                                <h3 className="text-base lg:text-lg font-bold text-stone-900 mb-2">{step.title}</h3>
                                <p className="text-stone-500 text-sm leading-relaxed max-w-[220px]">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>


            {/* Bubola-style Info & Footer Section */}
            <section className="bg-stone-900 text-stone-300 py-24">
                <div className="max-w-[2560px] mx-auto px-6 lg:px-12">


                    {/* 4-Column Footer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 mb-16 text-sm">
                        
                        {/* Col 1 */}
                        <div>
                            <h6 className="text-white font-bold uppercase tracking-widest text-xs mb-6">Frameworthy&amp;co</h6>
                            <p className="leading-loose">
                                No. 17A, Cashew Street<br />
                                Adjiringanor, Accra, Ghana
                            </p>
                        </div>

                        {/* Col 2 */}
                        <div>
                            <h6 className="text-white font-bold uppercase tracking-widest text-xs mb-6">Contact</h6>
                            <p className="leading-loose">
                                Tel: 0261 549 517<br />
                                Tel: 0501 648 227<br />
                                Email: <a href="mailto:admin@frameworthyco.com" className="hover:text-white transition-colors">admin@frameworthyco.com</a>
                            </p>
                        </div>

                        {/* Col 3 */}
                        <div>
                            <h6 className="text-white font-bold uppercase tracking-widest text-xs mb-6">Support &amp; Legal</h6>
                            <div className="leading-loose flex flex-col gap-1 items-start">
                                <button onClick={() => navigate && navigate('/help')} className="hover:text-white transition-colors text-left font-bold text-[#c9a84c]">Help Centre</button>
                                <button onClick={() => navigate && navigate('/terms')} className="hover:text-white transition-colors text-left">Terms of Service</button>
                                <button onClick={() => navigate && navigate('/privacy')} className="hover:text-white transition-colors text-left">Privacy Policy</button>
                                <button onClick={() => navigate && navigate('/refund-policy')} className="hover:text-white transition-colors text-left">Refund &amp; Return Policy</button>
                                <button onClick={() => navigate && navigate('/delivery-policy')} className="hover:text-white transition-colors text-left">Delivery Policy</button>
                            </div>
                        </div>

                        {/* Col 4 */}
                        <div>
                            <h6 className="text-white font-bold uppercase tracking-widest text-xs mb-6">Follow us</h6>
                            <div className="flex gap-4">
                                <a href="https://instagram.com/frameworthyco" onClick={(e) => openExternalLink(e, 'https://instagram.com/frameworthyco')} target="_blank" rel="noopener noreferrer" title="Instagram" className="w-10 h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                                </a>
                                <a href="https://facebook.com/frameworthyco" onClick={(e) => openExternalLink(e, 'https://facebook.com/frameworthyco')} target="_blank" rel="noopener noreferrer" title="Facebook" className="w-10 h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                                </a>
                                <a href="https://x.com/frameworthyco" onClick={(e) => openExternalLink(e, 'https://x.com/frameworthyco')} target="_blank" rel="noopener noreferrer" title="Twitter / X" className="w-10 h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
                                </a>
                                <a href="https://linkedin.com/company/frameworthyco" onClick={(e) => openExternalLink(e, 'https://linkedin.com/company/frameworthyco')} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="w-10 h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                                </a>
                                <a href="https://wa.me/233261549517" onClick={(e) => openExternalLink(e, 'https://wa.me/233261549517')} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-10 h-10 rounded-full border border-stone-700 flex items-center justify-center hover:bg-stone-800 hover:text-white transition-all">
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
