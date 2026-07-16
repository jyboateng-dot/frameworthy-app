import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Shield, Sun, Layers, Truck, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { FRAME_STYLES } from '../data/constants';

// Map frame style IDs to their corner images + accent colors for the card treatment
const FRAME_CORNER_DATA = {
    'flat-black-contemporary': {
        image: '/frames/flat-black-contemporary.png',
        accent: '#1a1a1a',
        tagline: 'Sleek & Versatile',
    },
    'flat-white-deep': {
        image: '/frames/flat-white-deep.png',
        accent: '#f9f9f9',
        tagline: 'Clean & Minimalist',
    },
    'flat-silver': {
        image: '/frames/flat-silver.png',
        accent: '#e5e7eb',
        tagline: 'Sleek & Metallic',
    },
    'flat-gold': {
        image: '/frames/flat-gold.png',
        accent: '#D4AF37',
        tagline: 'Warm & Luxurious',
    },
    'flat-bronze': {
        image: '/frames/flat-bronze.png',
        accent: '#cd7f32',
        tagline: 'Timeless Patina',
    },
    'flat-brown-deep': {
        image: '/frames/flat-brown-deep.png',
        accent: '#4a2c11',
        tagline: 'Deep Rich Brown Wood',
    },
    'metallic-pink': {
        image: '/frames/metallic-pink.png',
        accent: '#e0a6c2',
        tagline: 'Vibrant & Modern',
    },
    'metallic-pearl-white': {
        image: '/frames/metallic-pearl-white.png',
        accent: '#f9f9fb',
        tagline: 'Sleek & Bright Pearl',
    },
    'metallic-pewter': {
        image: '/frames/metallic-pewter.png',
        accent: '#708090',
        tagline: 'Sophisticated & Metallic',
    },
    'rose-gold-metallic': {
        image: '/frames/rose-gold-metallic.png',
        accent: '#b76e79',
        tagline: 'Elegant Rose Gold Glow',
    },
    'black-walnut-shadow': {
        image: '/frames/black-walnut-shadow.png',
        accent: '#2b2625',
        tagline: 'Elegant Black & Walnut Accent',
    },
    'walnut-square-shadow': {
        image: '/frames/walnut-square-shadow.png',
        accent: '#4d372c',
        tagline: 'Classic Warm Walnut',
    },
    'brown-square-shadow': {
        image: '/frames/brown-square-shadow.png',
        accent: '#5a3e2e',
        tagline: 'Rich Wood Tone Shadow Box',
    },
    'slate-grey-square-shadow': {
        image: '/frames/slate-grey-shadow.png',
        accent: '#708090',
        tagline: 'Modern Slate Grey Square',
    },

    'antique-gold-deep-shadow': {
        image: '/frames/antique-gold-deep-shadow.png',
        accent: '#bf953f',
        tagline: 'Warm Tall Gold Shadow Box',
    },
    'mahogany-shadow': {
        image: '/frames/mahogany-shadow.png',
        accent: '#4A1816',
        tagline: 'Reddish Mahogany Tone',
    },
    'brown-barnwood-shadow': {
        image: '/frames/brown-barnwood-shadow.png',
        accent: '#8B5E3C',
        tagline: 'Rustic Brown Wood Frame',
    },
    'grey-barnwood-shadow': {
        image: '/frames/grey-barnwood-shadow.png',
        accent: '#708090',
        tagline: 'Weathered Grey Wood Frame',
    },
};

const CAROUSEL_SLIDES = [
    {
        image: '/hero_hanging_frame.png',
        title: 'Put Your FrameWorthy Memories on Display',
        description: 'Showcase your favorite moments with custom frames designed to highlight what matters most.',
        buttonText: 'Browse frames'
    },
    {
        image: '/gallery_banner.png',
        title: 'Transform Your Space Into a Personal Gallery',
        description: 'Bespoke custom wood mouldings and high-end float canvas frames tailored to fit your artwork.',
        buttonText: 'Explore gallery styles'
    },
    {
        image: '/hallway_banner.png',
        title: 'Breathe Life Into Your Hallways',
        description: 'Create gorgeous grid and layered collage wall layouts that capture a lifetime of family stories.',
        buttonText: 'Design a gallery wall'
    },
    {
        image: '/graduation_banner.png',
        title: 'Preserve Your Proudest Milestones',
        description: 'Keep achievements vivid for decades to come with solid wood frames and acid-free archival mats.',
        buttonText: 'Frame graduation photo'
    },
    {
        image: '/living_room_banner.png',
        title: 'Artisanal Framing, Handcrafted Locally',
        description: 'Designed online, built by local experts in Accra, and delivered straight to your home or office.',
        buttonText: 'Start framing now'
    }
];

// ─── FRAME CARD COMPONENT ─────────────────────────────────────
const FrameCard = ({ style, index, onSelect }) => {
    const [isHovered, setIsHovered] = useState(false);
    const cornerData = FRAME_CORNER_DATA[style.id] || {};

    // Staggered entrance animation delay
    const animDelay = `${index * 100}ms`;

    // Get the starting price from the cheapest size
    const startingPrice = 99; // Tabletop is the cheapest

    return (
        <div
            className="frame-card group relative overflow-hidden rounded-2xl cursor-pointer bg-white shadow-sm hover:shadow-2xl transition-all duration-500 ease-out"
            style={{
                animationDelay: animDelay,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onSelect(style)}
        >
            {/* Corner Image — zoomed in & cropped */}
            <div className="relative aspect-[4/5] overflow-hidden bg-[#faf8f5]">
                <img
                    src={cornerData.image}
                    alt={`${style.name} frame corner detail`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out"
                    style={{
                        transform: isHovered ? 'scale(1.08)' : 'scale(1.0)',
                    }}
                    loading={index < 3 ? 'eager' : 'lazy'}
                />

                {/* Hover overlay with CTA */}
                <div
                    className="absolute inset-0 flex flex-col items-center justify-end pb-8 transition-all duration-500"
                    style={{
                        background: isHovered
                            ? 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)'
                            : 'linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 40%)',
                    }}
                >
                    <div
                        className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-bold text-sm rounded-full shadow-xl transition-all duration-500 ease-out uppercase tracking-wider"
                        style={{
                            transform: isHovered ? 'translateY(0)' : 'translateY(16px)',
                            opacity: isHovered ? 1 : 0,
                        }}
                    >
                        Start Framing
                        <ArrowRight size={16} strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            {/* Card Info Footer */}
            <div className="p-4 bg-white flex justify-between items-start gap-4">
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-stone-900 tracking-tight leading-snug uppercase">
                        {style.name}
                    </h3>
                </div>
                <div className="text-right flex-shrink-0 font-sans">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 block md:inline mr-1">Starting at</span>
                    <span className="text-sm font-extrabold text-stone-800">
                        GH₵{Math.round(99 * style.priceMod)}
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─── TRUST BAR COMPONENT ───────────────────────────────────────
const TrustBar = () => {
    const trustItems = [
        { icon: <Layers size={22} strokeWidth={1.5} />, label: 'Solid Wood Mouldings' },
        { icon: <Sun size={22} strokeWidth={1.5} />, label: 'UV-Resistant Acrylic' },
        { icon: <Shield size={22} strokeWidth={1.5} />, label: 'Acid-Free Mats' },
        { icon: <Truck size={22} strokeWidth={1.5} />, label: 'Free Delivery in Accra' },
    ];

    return (
        <div className="w-full border-y border-gray-100 bg-white/60 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
                    {trustItems.map((item, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 justify-center text-gray-500"
                        >
                            <div className="text-gray-400 flex-shrink-0">{item.icon}</div>
                            <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── TRANSITION BRIDGE COMPONENT ───────────────────────────────
const TransitionBridge = () => (
    <div className="bg-[#fdfbf7] pt-10 pb-4">
        {/* Decorative line with Fr logo center */}
        <div className="flex items-center gap-4 max-w-xs mx-auto px-6 mb-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#c5b89d]/50" />
            <div className="w-6 h-6 bg-white border-[3px] border-double border-[#9a8e7d] rounded-[1px] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-serif font-bold text-[#9a8e7d] leading-none pb-[1px]">Fr</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#c5b89d]/50" />
        </div>
        {/* Section label */}
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#9a8e7d]">
            Featured Frames
        </p>
    </div>
);

// ─── MAIN LANDING PAGE ─────────────────────────────────────────
const LandingPage = ({ navigate, setSelectedFrame }) => {
    const [loaded, setLoaded] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const containerRef = useRef(null);

    useEffect(() => {
        // Trigger entrance animations after mount
        const timer = setTimeout(() => setLoaded(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // Handle manual scroll snapping to update dots
    const handleScroll = () => {
        if (containerRef.current) {
            const scrollLeft = containerRef.current.scrollLeft;
            const width = containerRef.current.clientWidth;
            if (width > 0) {
                const newIndex = Math.round(scrollLeft / width);
                if (newIndex !== currentSlide && newIndex >= 0 && newIndex < CAROUSEL_SLIDES.length) {
                    setCurrentSlide(newIndex);
                }
            }
        }
    };

    // Scroll to a specific slide programmatically
    const scrollToSlide = (idx) => {
        if (containerRef.current) {
            const width = containerRef.current.clientWidth;
            containerRef.current.scrollTo({
                left: width * idx,
                behavior: 'smooth'
            });
            setCurrentSlide(idx);
        }
    };

    // Arrow navigation
    const handlePrev = (e) => {
        e.stopPropagation();
        const prevSlide = (currentSlide - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length;
        scrollToSlide(prevSlide);
    };

    const handleNext = (e) => {
        e.stopPropagation();
        const nextSlide = (currentSlide + 1) % CAROUSEL_SLIDES.length;
        scrollToSlide(nextSlide);
    };

    // Auto-scroll loop (resets every time currentSlide changes, avoiding collisions)
    useEffect(() => {
        const interval = setInterval(() => {
            const nextSlide = (currentSlide + 1) % CAROUSEL_SLIDES.length;
            if (containerRef.current) {
                const width = containerRef.current.clientWidth;
                containerRef.current.scrollTo({
                    left: width * nextSlide,
                    behavior: 'smooth'
                });
            }
            setCurrentSlide(nextSlide);
        }, 6000);
        return () => clearInterval(interval);
    }, [currentSlide]);

    const handleFrameSelect = (frameStyle) => {
        if (setSelectedFrame) {
            setSelectedFrame(frameStyle);
        }
        navigate('/frame/customize');
    };

    return (
        <div className="min-h-[calc(100vh-56px)] bg-[#fdfbf7]">

            {/* ── HERO BANNER SECTION (USER SCROLLABLE CAROUSEL) ── */}
            <section className="relative w-full h-[65vh] min-h-[480px] md:h-[75vh] bg-stone-900 group">
                
                {/* Horizontal Snap Scroll Container */}
                <div 
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="w-full h-full flex flex-row overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth animate-fade-in"
                >
                    {CAROUSEL_SLIDES.map((slide, idx) => (
                        <div
                            key={idx}
                            className="w-full h-full flex-shrink-0 snap-start bg-cover bg-center flex flex-col justify-center relative"
                            style={{
                                backgroundImage: `url(${slide.image})`,
                            }}
                        >
                            {/* Background Subtle Overlay */}
                            <div className="absolute inset-0 bg-black/10 z-0" />

                            {/* Content Container (Sits on top of background) */}
                            <div className="relative max-w-7xl mx-auto px-6 md:px-12 w-full flex flex-col justify-center items-start z-10">
                                {/* Glassmorphic Card */}
                                <div className="bg-white/55 border border-white/40 p-8 md:p-12 rounded-[24px] max-w-3xl shadow-xl w-full">
                                    <h1 className="text-2xl md:text-4xl font-serif font-bold text-gray-900 tracking-tight leading-[1.2]">
                                        {slide.title}
                                    </h1>
                                    <p className="text-sm md:text-base text-gray-900 font-normal mt-4 leading-relaxed">
                                        {slide.description}
                                    </p>
                                </div>

                                {/* Action button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        document.getElementById('frames-grid')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="mt-6 px-8 py-3.5 bg-[#6e7c96]/60 border border-white/10 hover:bg-[#6e7c96]/85 text-white text-sm md:text-base font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 active:scale-[0.98] uppercase tracking-wider"
                                >
                                    {slide.buttonText}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Left Side Arrow Navigation Button */}
                <button
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 md:w-12 md:h-12 bg-white/20 hover:bg-white/40 border border-white/20 text-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                >
                    <ChevronLeft size={24} />
                </button>

                {/* Right Side Arrow Navigation Button */}
                <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 md:w-12 md:h-12 bg-white/20 hover:bg-white/40 border border-white/20 text-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                >
                    <ChevronRight size={24} />
                </button>

                {/* Dot Slider Indicators */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-30">
                    {CAROUSEL_SLIDES.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => scrollToSlide(idx)}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                idx === currentSlide 
                                    ? 'bg-[#6e7c96] scale-110' 
                                    : 'bg-white/70 hover:bg-white border border-stone-300/30'
                            }`}
                        />
                    ))}
                </div>

                {/* Chat floating widget button */}
                <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-30">
                    <button className="w-12 h-12 md:w-14 md:h-14 bg-[#144746] hover:bg-[#0e3534] text-white rounded-lg flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95">
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
                        </svg>
                    </button>
                </div>
            </section>

            {/* ── ELEGANT TRANSITION SECTION ──────────────────── */}
            <TransitionBridge />

            {/* ── FRAME STYLES GRID ──────────────────────────── */}
            <section id="frames-grid" className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8">
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7 ${loaded ? 'frame-grid-visible' : 'frame-grid-hidden'}`}>
                    {FRAME_STYLES.map((style, index) => (
                        <FrameCard
                            key={style.id}
                            style={style}
                            index={index}
                            onSelect={handleFrameSelect}
                        />
                    ))}
                </div>
            </section>

            {/* ── TRUST BAR ──────────────────────────────────── */}
            <TrustBar />

            {/* ── BOTTOM CTA ─────────────────────────────────── */}
            <section className="py-20 md:py-28 px-6">
                <div className={`max-w-2xl mx-auto text-center transition-all duration-1000 ease-out delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4 tracking-tight">
                        Ready to frame your memories?
                    </h2>
                    <p className="text-gray-500 mb-8 text-lg font-light">
                        Upload your photo, choose a frame, and see it on your wall — all in under 2 minutes.
                    </p>
                    <button
                        onClick={() => navigate('/frame/customize')}
                        className="group inline-flex items-center gap-3 px-10 py-4 bg-gray-900 text-white text-base font-bold rounded-full hover:bg-black transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wider"
                    >
                        Start Framing
                        <ArrowRight
                            size={18}
                            strokeWidth={2.5}
                            className="group-hover:translate-x-1 transition-transform duration-300"
                        />
                    </button>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
