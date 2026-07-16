import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, ChevronLeft } from 'lucide-react';

const SIZE_GUIDE_SLIDES = [
    {
        img: '/size-guide/Gemini_Generated_Image_ramjbzramjbzramj.png',
        title: "The Perfect Fit",
        text: "Discover the ideal dimensions for your artwork. A well-sized frame transforms any room into a curated space."
    },
    {
        img: '/size-guide/Gemini_Generated_Image_rqzr8urqzr8urqzr (1).png',
        title: "Small & Intimate",
        text: "Perfect for desks, nightstands, and small cozy corners. Best enjoyed up close."
    },
    {
        img: '/size-guide/il_1588xN.4643730962_lh8n.jpg',
        title: "Tabletop Displays",
        text: "Bring personality to your shelves and mantles with our versatile compact sizes."
    },
    {
        img: '/size-guide/il_1588xN.4846462637_mxzo.webp',
        title: "The Standard Classic",
        text: "Our mid-sized frames fit beautifully on bookshelves or paired together in tight spaces."
    },
    {
        img: '/size-guide/il_1588xN.5071461154_s7y1 (1).webp',
        title: "Building a Gallery",
        text: "Mix and match medium sizes to build stunning, eclectic gallery walls."
    },
    {
        img: '/size-guide/il_1588xN.6863728214_qfxz.webp',
        title: "Hallways & Entryways",
        text: "Welcome guests with perfectly proportioned art that anchors transitional spaces."
    },
    {
        img: '/size-guide/il_1588xN.6928579129_kn6g.webp',
        title: "Large Statement",
        text: "Commands attention. Stunning above small cabinets, reading chairs, or fireplaces."
    },
    {
        img: '/size-guide/il_1588xN.7654243148_jrhy.webp',
        title: "Focal Points",
        text: "A large frame draws the eye and sets the tone for the entire room's decor."
    },
    {
        img: '/size-guide/il_1588xN.7655050130_lhfm.webp',
        title: "Grand Exhibition",
        text: "Massive impact. Designed to anchor a room, hanging perfectly over sofas or beds."
    }
];

export default function SizeGuidePage({ navigate }) {
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = () => {
        setCurrentSlide(s => (s + 1) % SIZE_GUIDE_SLIDES.length);
    };

    const prevSlide = () => {
        setCurrentSlide(s => (s - 1 + SIZE_GUIDE_SLIDES.length) % SIZE_GUIDE_SLIDES.length);
    };

    // Auto-advance carousel
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide(s => (s + 1) % SIZE_GUIDE_SLIDES.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [currentSlide]);

    return (
        <div className="h-screen bg-[#faf9f8] text-stone-900 font-sans antialiased overflow-hidden selection:bg-stone-200">
            
            {/* Global Back Navigation */}
            <div className="absolute top-8 left-6 lg:left-12 z-50">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors duration-200 text-xs font-bold uppercase tracking-wider"
                >
                    <ArrowLeft size={14} /> Back to browsing
                </button>
            </div>

            {/* Asymmetric Carousel Section */}
            <section className="relative pt-20 lg:pt-24 w-full h-full flex items-center bg-[#faf9f8]">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-[calc(100vh-8rem)]">
                    
                    {/* Left: Anchored Typography */}
                    <div className="lg:col-span-5 relative z-10 flex flex-col justify-center h-full max-h-[500px]">
                        {SIZE_GUIDE_SLIDES.map((slide, index) => (
                            <div 
                                key={index}
                                className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                                    currentSlide === index ? 'opacity-100 translate-y-0 pointer-events-auto z-10' : 'opacity-0 translate-y-8 pointer-events-none z-0'
                                }`}
                            >
                                <div className="text-stone-400 font-bold tracking-widest text-xs uppercase mb-6 flex items-center gap-4">
                                    <span className="w-8 h-[1px] bg-stone-300"></span>
                                    0{index + 1} &mdash; 0{SIZE_GUIDE_SLIDES.length}
                                </div>
                                <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter leading-[1.05] mb-6 text-stone-900 font-serif">
                                    {slide.title}
                                </h1>
                                <p className="text-lg lg:text-xl text-stone-600 max-w-lg leading-relaxed mb-8">
                                    {slide.text}
                                </p>
                                <div className="z-20">
                                    <button 
                                        onClick={() => navigate('/frame/customize')}
                                        className="group flex items-center gap-4 text-sm font-bold tracking-wide uppercase text-stone-900 hover:text-stone-600 transition-colors pointer-events-auto"
                                    >
                                        <span className="border-b-2 border-stone-900 pb-1 group-hover:border-stone-600 transition-colors">Start Framing</span>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right: Asymmetric Image Composition */}
                    <div className="lg:col-span-7 relative h-full w-full mt-8 lg:mt-0">
                        {/* Decorative background box offset */}
                        <div className="absolute top-8 -right-8 w-full h-full bg-stone-200/50 hidden lg:block" />
                        
                        <div className="relative w-full h-full overflow-hidden shadow-2xl bg-white p-4">
                            {SIZE_GUIDE_SLIDES.map((slide, index) => (
                                <div 
                                    key={index}
                                    className={`absolute inset-0 w-full h-full p-4 transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-center ${
                                        currentSlide === index ? 'opacity-100 scale-100 z-10 pointer-events-auto' : 'opacity-0 scale-[0.98] z-0 pointer-events-none'
                                    }`}
                                >
                                    <img 
                                        src={slide.img} 
                                        alt={slide.title} 
                                        className="w-full h-full object-contain drop-shadow-md" 
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Minimalist Controls Overlayed on Image */}
                        <div className="absolute bottom-6 left-6 lg:-left-6 z-30 flex gap-0 shadow-xl overflow-hidden rounded-sm">
                            <button 
                                onClick={prevSlide}
                                className="w-14 h-14 bg-white/90 backdrop-blur-md text-stone-900 flex items-center justify-center hover:bg-stone-100 transition-all border-r border-stone-200"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={nextSlide}
                                className="w-14 h-14 bg-white/90 backdrop-blur-md text-stone-900 flex items-center justify-center hover:bg-stone-100 transition-all"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                </div>
            </section>
        </div>
    );
}
