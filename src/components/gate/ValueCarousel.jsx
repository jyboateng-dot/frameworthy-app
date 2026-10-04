import React, { useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';

// Slides 1-5: mandatory intro covering the need, value proposition, and
// what to expect as a tester. Slides 6-9: real slides reused from the
// landing page's own hero carousel (landingCarouselSlides.js).
const SLIDES = [
    {
        image: '/hero_slide_1.jpg',
        eyebrow: "You're invited",
        title: 'Welcome to FrameWorthy',
        body: "You're one of a small group testing FrameWorthy before it opens to the public. Thanks for being here.",
    },
    {
        image: '/hero_slide_3.jpg',
        eyebrow: 'The problem',
        title: "Framing shouldn't be this hard",
        body: "Getting something properly framed usually means guessing sizes, visiting a shop in person, and hoping it looks right once it's on your wall.",
    },
    {
        image: '/hero_slide_5.jpg',
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
    {
        image: '/hero_hanging_frame.jpg',
        eyebrow: 'Feature spotlight',
        title: 'Welcome to FrameWorthy',
        body: 'Transform your cherished memories and favorite artworks into stunning, gallery-quality centerpieces that elevate any space.',
    },
    {
        image: '/hallway_banner.jpg',
        eyebrow: 'Feature spotlight',
        title: 'Curate Your Hallways',
        body: "Turn your empty corridors into a beautiful walking gallery of your life's greatest moments and art.",
    },
    {
        image: '/living_room_banner.jpg',
        eyebrow: 'Feature spotlight',
        title: 'Elevate Your Living Space',
        body: 'Create a stunning focal point in your living room with our premium, handcrafted frames.',
    },
    {
        image: '/landing_carousel/slide-7.webp',
        eyebrow: 'Feature spotlight',
        title: 'Delivered to Your Door',
        body: 'We handcraft your custom frame and deliver it securely to your doorstep.',
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
        <div className="fixed inset-0 z-[200] bg-[#faf9f8] overflow-hidden">
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${slide.image})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#faf9f8] via-[#faf9f8]/80 to-[#faf9f8]/10" />

            <div className="relative h-full flex flex-col">
                <div className="flex items-center justify-center gap-1.5 pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
                    {SLIDES.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all ${i === index ? 'w-6 bg-stone-900' : 'w-1.5 bg-stone-900/20'}`}
                        />
                    ))}
                </div>

                <div className="flex-1" />

                <div className="px-6 sm:px-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] max-w-2xl">
                    <p className="text-xs font-semibold tracking-[0.2em] uppercase text-amber-700 mb-3">{slide.eyebrow}</p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 mb-4 leading-tight">{slide.title}</h2>

                    {slide.body && (
                        <p className="text-base text-stone-600 leading-relaxed">{slide.body}</p>
                    )}

                    {slide.features && (
                        <ul className="space-y-2">
                            {slide.features.map((f) => (
                                <li key={f} className="flex items-start gap-2 text-base text-stone-600">
                                    <span className="text-amber-700 mt-1.5 text-[10px]">&#9670;</span>
                                    <span>{f}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex items-center gap-3 mt-8">
                        {index > 0 && (
                            <button
                                onClick={goBack}
                                className="w-11 h-11 flex items-center justify-center rounded-full border border-stone-300 text-stone-700 hover:bg-stone-900/5 transition"
                                aria-label="Previous"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <button
                            onClick={goNext}
                            className="flex items-center gap-2 bg-stone-900 text-white font-semibold rounded-full pl-6 pr-5 py-3 hover:bg-stone-800 active:bg-stone-950 transition"
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
