import React, { useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const SLIDES = [
    {
        image: '/hero_slide_1.png',
        eyebrow: "You're invited",
        title: 'Welcome to FrameWorthy',
        body: "You're one of a small group testing FrameWorthy before it opens to the public. Thanks for being here.",
    },
    {
        image: '/hero_slide_3.png',
        eyebrow: 'The problem',
        title: "Framing shouldn't be this hard",
        body: "Getting something properly framed usually means guessing sizes, visiting a shop in person, and hoping it looks right once it's on your wall.",
    },
    {
        image: '/hero_slide_5.png',
        eyebrow: 'The idea',
        title: 'See it before you buy it',
        body: 'Upload any photo, or pick from our curated collections, and preview it framed, matted, and hanging on a wall of your choice — before you order anything.',
    },
    {
        image: '/hero_slide_7.jpg',
        eyebrow: 'What you get',
        title: 'Everything in one place',
        features: [
            'Museum-quality art & iconic prints',
            'Premium frame styles & custom sizing',
            'Realistic room visualizer',
            'Secure checkout — card & Mobile Money',
        ],
    },
    {
        image: '/hero_slide_8.jpg',
        eyebrow: "You're one of the first",
        title: 'Explore freely, break things, tell us',
        body: 'Try placing a test order, poke around every corner, and let us know what confuses you or what you love. Your feedback shapes what ships next.',
    },
];

const ValueCarousel = ({ onDone }) => {
    const [index, setIndex] = useState(0);
    const slide = SLIDES[index];
    const isLast = index === SLIDES.length - 1;

    const goNext = () => {
        if (isLast) onDone();
        else setIndex((i) => i + 1);
    };
    const goBack = () => setIndex((i) => Math.max(0, i - 1));

    return (
        <div className="fixed inset-0 z-[200] bg-fw-dark overflow-hidden">
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${slide.image})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/30" />

            <div className="relative h-full flex flex-col">
                <div className="flex items-center justify-center gap-1.5 pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
                    {SLIDES.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all ${i === index ? 'w-6 bg-fw-gold' : 'w-1.5 bg-white/25'}`}
                        />
                    ))}
                </div>

                <div className="flex-1" />

                <div className="px-6 sm:px-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] max-w-2xl">
                    <p className="text-xs font-semibold tracking-[0.2em] uppercase text-fw-gold mb-3">{slide.eyebrow}</p>
                    <h2 className="text-3xl sm:text-4xl font-serif font-bold text-fw-text mb-4 leading-tight">{slide.title}</h2>

                    {slide.body && (
                        <p className="text-base text-fw-text/85 leading-relaxed">{slide.body}</p>
                    )}

                    {slide.features && (
                        <ul className="space-y-2">
                            {slide.features.map((f) => (
                                <li key={f} className="flex items-start gap-2 text-base text-fw-text/85">
                                    <span className="text-fw-gold mt-1.5 text-[10px]">&#9670;</span>
                                    <span>{f}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex items-center gap-3 mt-8">
                        {index > 0 && (
                            <button
                                onClick={goBack}
                                className="w-11 h-11 flex items-center justify-center rounded-full border border-white/20 text-fw-text hover:bg-white/10 transition"
                                aria-label="Previous"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <button
                            onClick={goNext}
                            className="flex items-center gap-2 bg-fw-gold text-fw-dark font-semibold rounded-full pl-6 pr-5 py-3 hover:brightness-110 active:brightness-95 transition"
                        >
                            {isLast ? 'Enter FrameWorthy' : 'Next'}
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValueCarousel;
