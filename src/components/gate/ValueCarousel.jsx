import React, { useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { CAROUSEL_SLIDES } from '../../data/landingCarouselSlides';

const ValueCarousel = ({ onDone }) => {
    const [index, setIndex] = useState(0);
    const slide = CAROUSEL_SLIDES[index];
    const isLast = index === CAROUSEL_SLIDES.length - 1;

    const goNext = () => {
        if (isLast) onDone();
        else setIndex((i) => i + 1);
    };
    const goBack = () => setIndex((i) => Math.max(0, i - 1));

    return (
        <div className="fixed inset-0 z-[200] bg-[#faf9f8] text-stone-900 overflow-hidden">
            <div className="h-full w-full max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">

                {/* Left: Typography */}
                <div className="lg:col-span-5 order-2 lg:order-1 py-6 lg:py-0">
                    <div className="text-stone-400 font-bold tracking-widest text-xs uppercase mb-6 flex items-center gap-4">
                        <span className="w-8 h-[1px] bg-stone-300" />
                        0{index + 1} &mdash; 0{CAROUSEL_SLIDES.length}
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tighter leading-[1.05] mb-6 text-stone-900">
                        {slide.title}
                    </h1>
                    <p className="text-base lg:text-xl text-stone-600 max-w-lg leading-relaxed">
                        {slide.text}
                    </p>

                    <div className="flex items-center gap-3 mt-8">
                        {index > 0 && (
                            <button
                                onClick={goBack}
                                className="w-12 h-12 shrink-0 rounded-full border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100 transition"
                                aria-label="Previous"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <button
                            onClick={goNext}
                            className="group flex items-center gap-3 bg-stone-900 text-white font-bold tracking-wide uppercase text-sm px-6 py-3.5 rounded-full hover:bg-stone-800 transition"
                        >
                            {isLast ? 'Enter FrameWorthy' : 'Next'}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Right: Image */}
                <div className="lg:col-span-7 order-1 lg:order-2 relative h-[34vh] lg:h-[70vh] w-full">
                    <div className="absolute top-6 -right-6 w-full h-full bg-stone-200/50 hidden lg:block" />
                    <div className="relative w-full h-full overflow-hidden shadow-2xl bg-stone-100">
                        <img src={slide.img} alt={slide.title} className="w-full h-full object-cover" />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ValueCarousel;
