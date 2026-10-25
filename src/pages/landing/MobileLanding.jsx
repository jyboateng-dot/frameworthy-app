import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Upload, Landmark, Images, Eye, Smartphone, Truck, ShieldCheck, Hammer, Phone, Mail, ChevronRight } from 'lucide-react';
import { framesForCategory, displayCategoryName, displayFrameName, frameStartingPriceDisplay, frameCategoryDescription, PRODIGI_FRAME_CATEGORIES } from '../../data/frameBrowsing';
import { CAROUSEL_SLIDES } from '../../data/landingCarouselSlides';
import { openExternalLinkFromEvent as openExternalLink } from '../../utils/nativeLinks';

// Phone-only home page. LandingPage renders this below the md breakpoint so the
// tablet/desktop layout stays exactly as it was.

// These desktop carousel scenes are not repeated anywhere else on the mobile
// landing page. Reuse the shared slide records so image and narrative stay in
// sync when the catalogue copy changes.
const MOBILE_HERO_IMAGE_PATHS = [
    '/landing_carousel/slide-welcome-jersey.webp',
    '/landing_carousel/slide-upload.webp',
    '/landing_carousel/slide-craftsmanship.webp',
    '/landing_carousel/slide-room-visualizer.webp',
    '/landing_carousel/slide-3d-ar.webp',
    '/landing_carousel/slide-frame-materials.webp',
    '/landing_carousel/slide-living-space.webp',
    '/landing_carousel/slide-perfect-sizing.webp',
    '/landing_carousel/frameworthy-checkout.webp',
];
const MOBILE_HERO_TITLES = {
    '/landing_carousel/slide-welcome-jersey.webp': 'Frame moments that matter',
    '/landing_carousel/slide-upload.webp': 'Upload from Anywhere',
    '/landing_carousel/slide-craftsmanship.webp': 'Make Every Detail Yours',
    '/landing_carousel/slide-room-visualizer.webp': 'See It Live as You Build',
    '/landing_carousel/slide-3d-ar.webp': 'Preview in Your Space',
    '/landing_carousel/slide-frame-materials.webp': 'Curated Styles & Finishes',
    '/landing_carousel/slide-living-space.webp': 'Elevate Your Living Space',
    '/landing_carousel/slide-perfect-sizing.webp': 'Perfect Scale & Sizing',
    '/landing_carousel/frameworthy-checkout.webp': 'Easy, Secure Checkout',
};
const MOBILE_HERO_NARRATIVES = {
    '/landing_carousel/slide-welcome-jersey.webp': 'Turn cherished memories into frames made for your home.',
    '/landing_carousel/slide-upload.webp': 'Upload photos from your phone, Google Drive or Dropbox.',
    '/landing_carousel/slide-craftsmanship.webp': 'Customise frames, mounts and sizes in real time.',
    '/landing_carousel/slide-room-visualizer.webp': 'Test mounts and wall colours in the visualizer.',
    '/landing_carousel/slide-3d-ar.webp': 'See it on your wall in Augmented Reality (AR).',
    '/landing_carousel/slide-frame-materials.webp': 'Solid wood, aluminium and canvas floaters.',
    '/landing_carousel/slide-living-space.webp': 'Create a considered focal point for any room.',
    '/landing_carousel/slide-perfect-sizing.webp': 'From tabletop prints to statement gallery walls.',
    '/landing_carousel/frameworthy-checkout.webp': 'Check out as a guest or sign in for more features',
};
const MOBILE_HERO_SLIDES = CAROUSEL_SLIDES
    .filter(slide => MOBILE_HERO_IMAGE_PATHS.includes(slide.img))
    .map(slide => ({
        ...slide,
        mobileTitle: MOBILE_HERO_TITLES[slide.img] || slide.title,
        mobileText: MOBILE_HERO_NARRATIVES[slide.img] || slide.text,
    }));

const BENEFITS = [
    { icon: Eye, label: 'Live preview as you design' },
    { icon: Smartphone, label: 'See it on your wall in AR' },
    { icon: Hammer, label: 'Handcrafted, ready to hang' },
    { icon: ShieldCheck, label: 'Secure checkout' },
];

const SOCIAL_LINKS = [
    { title: 'Instagram', href: 'https://instagram.com/frameworthyco', icon: <><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></> },
    { title: 'Facebook', href: 'https://facebook.com/frameworthyco', icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/> },
    { title: 'Twitter / X', href: 'https://x.com/frameworthyco', icon: <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/> },
    { title: 'LinkedIn', href: 'https://linkedin.com/company/frameworthyco', icon: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></> },
    { title: 'WhatsApp', href: 'https://wa.me/233261549517', icon: <><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></> },
];

const LEGAL_LINKS = [
    { label: 'Help Centre', path: '/help' },
    { label: 'Order status', path: '/order-status' },
    { label: 'Delivery', path: '/delivery-policy' },
    { label: 'Refunds & returns', path: '/refund-policy' },
    { label: 'Terms', path: '/terms' },
    { label: 'Privacy', path: '/privacy' },
];

function SectionHeading({ eyebrow, title, children }) {
    return (
        <div className="mb-4">
            {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8892f] mb-1.5">{eyebrow}</p>}
            <h2 className="text-2xl font-bold tracking-tight text-stone-900 leading-tight">{title}</h2>
            {children && <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{children}</p>}
        </div>
    );
}

export default function MobileLanding({ navigate, onStartFraming, onSelectFrame }) {
    const [heroIndex, setHeroIndex] = useState(0);
    const [activeCategory, setActiveCategory] = useState(PRODIGI_FRAME_CATEGORIES[0]);
    const touchStartX = useRef(null);
    const frameRailRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => setHeroIndex(i => (i + 1) % MOBILE_HERO_SLIDES.length), 5000);
        return () => clearInterval(timer);
    }, [heroIndex]);

    const startFraming = (state = {}) => {
        if (onStartFraming) onStartFraming(state);
        else if (navigate) navigate('/frame/customize', { state });
    };

    const go = (path) => navigate && navigate(path);

    const scrollToFrames = () => {
        document.getElementById('curated-frames')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleCategoryChange = (cat) => {
        setActiveCategory(cat);
        if (frameRailRef.current) frameRailRef.current.scrollLeft = 0;
    };

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(deltaX) < 40) return;
        const count = MOBILE_HERO_SLIDES.length;
        setHeroIndex(i => (deltaX < 0 ? (i + 1) % count : (i - 1 + count) % count));
    };

    const frames = framesForCategory(activeCategory);
    const currentHeroSlide = MOBILE_HERO_SLIDES[heroIndex];

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans antialiased overflow-x-hidden">

            {/* Hero: full-bleed rotating photos with one steady headline on top */}
            <section
                className="relative h-[clamp(420px,46svh,450px)] w-full overflow-hidden bg-stone-900"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {MOBILE_HERO_SLIDES.map((slide, index) => (
                    <img
                        key={slide.img}
                        src={slide.img}
                        alt={slide.title}
                        aria-hidden={heroIndex !== index}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : 'low'}
                        decoding={index === 0 ? 'sync' : 'async'}
                        className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-1000 ease-out ${heroIndex === index ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                    />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 via-50% to-black/0" />

                <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#e3c66d] truncate">Custom framing, made to order</p>
                    <h1 key={`${currentHeroSlide.img}-title`} className="text-[1.65rem] sm:text-[1.85rem] font-bold leading-tight tracking-tight text-white animate-fade-in-up truncate">
                        {currentHeroSlide.mobileTitle}
                    </h1>
                    <p key={`${currentHeroSlide.img}-text`} className="mt-1 text-[12.5px] leading-snug text-white/85 animate-fade-in-up truncate">
                        {currentHeroSlide.mobileText}
                    </p>
                    <div className="mt-3.5 flex flex-col gap-2">
                        <button
                            onClick={() => startFraming()}
                            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#c9a84c] px-5 py-2.5 text-sm font-bold text-[#0a0a0a] shadow-md active:scale-[0.98] transition-transform"
                        >
                            Start Framing <ArrowRight className="h-4 w-4" />
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={scrollToFrames}
                                className="rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm active:bg-white/20 whitespace-nowrap text-center"
                            >
                                Browse frames
                            </button>
                            <button
                                onClick={() => go('/curated-art')}
                                className="rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm active:bg-white/20 whitespace-nowrap text-center"
                            >
                                Browse Public Domain Art
                            </button>
                        </div>
                    </div>
                    <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
                        {MOBILE_HERO_SLIDES.map((slide, index) => (
                            <span key={slide.img} className={`h-1.5 rounded-full transition-all duration-500 ${heroIndex === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} />
                        ))}
                    </div>
                </div>
            </section>

            {/* Why FrameWorthy, at a glance */}
            <section className="px-4 py-4 bg-white border-b border-stone-100">
                <ul className="grid grid-cols-2 gap-2.5">
                    {BENEFITS.map((benefit) => (
                        <li key={benefit.label} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                            <benefit.icon size={17} strokeWidth={1.75} className="shrink-0 text-[#a8892f]" />
                            <span className="text-[12.5px] font-semibold leading-snug text-stone-700">{benefit.label}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Choose a starting point */}
            <section className="px-4 pt-6 pb-6">
                <SectionHeading eyebrow="Step one" title="What would you like to frame?">
                    Upload from your device or pick a free museum masterpiece.
                </SectionHeading>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => startFraming()}
                        className="group relative flex h-40 w-full items-end overflow-hidden rounded-2xl text-left shadow-sm active:scale-[0.99] transition-transform"
                    >
                        <img src="/landing_carousel/slide-upload.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
                        <div className="relative flex w-full items-end justify-between gap-3 p-4">
                            <div>
                                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#e3c66d]"><Upload size={14} /> From your phone or cloud</span>
                                <span className="block text-lg font-bold text-white">Your own photo or artwork</span>
                            </div>
                            <ChevronRight className="h-6 w-6 shrink-0 text-white" />
                        </div>
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => {
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
                            }}
                            className="relative flex h-44 items-end overflow-hidden rounded-2xl text-left shadow-sm active:scale-[0.99] transition-transform"
                        >
                            <img src="/landing_carousel/slide-museum-masterpieces.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                            <div className="relative p-3">
                                <Landmark size={16} className="mb-1 text-[#e3c66d]" />
                                <span className="block text-[15px] font-bold leading-tight text-white">Museum Masterpieces</span>
                            </div>
                        </button>
                        <button
                            onClick={() => go('/curated-art')}
                            className="relative flex h-44 items-end overflow-hidden rounded-2xl text-left shadow-sm active:scale-[0.99] transition-transform"
                        >
                            <img src="/landing_carousel/slide-curated-collections.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                            <div className="relative p-3">
                                <Images size={16} className="mb-1 text-[#e3c66d]" />
                                <span className="block text-[15px] font-bold leading-tight text-white">Public Domain Art</span>
                            </div>
                        </button>
                    </div>
                </div>
            </section>

            {/* Frames: swipeable rail per category instead of a paginated grid */}
            <section id="curated-frames" className="pt-6 pb-6 bg-white scroll-mt-14">
                <div className="px-4">
                    <SectionHeading eyebrow="Step two" title="Pick your frame">
                        Solid wood, deep box, slim aluminium and canvas styles. Swipe to see every finish.
                    </SectionHeading>
                </div>
                <div className="flex gap-2 overflow-x-auto px-4 pb-3 hide-scrollbar snap-x">
                    {PRODIGI_FRAME_CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => handleCategoryChange(cat)}
                            aria-pressed={activeCategory === cat}
                            className={`snap-start shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600 border border-stone-200'}`}
                        >
                            {displayCategoryName(cat)}
                        </button>
                    ))}
                </div>
                <p aria-live="polite" className="px-4 mb-4 text-[13px] leading-relaxed text-stone-500">
                    {frameCategoryDescription(activeCategory)}
                </p>
                <div ref={frameRailRef} className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x snap-mandatory scroll-px-4">
                    {frames.map(frame => (
                        <button
                            key={frame.id}
                            onClick={() => onSelectFrame(frame)}
                            className="snap-start shrink-0 w-[44%] text-left active:scale-[0.98] transition-transform"
                        >
                            <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-100 mb-2">
                                <img
                                    src={frame.thumbnailImage || frame.cornerImage || frame.previewImg || `/frames/${frame.filename}`}
                                    alt={frame.name}
                                    loading="lazy"
                                    decoding="async"
                                    style={frame.thumbnailCrop ? {
                                        transform: `scale(${frame.thumbnailCrop.scale})`,
                                        transformOrigin: frame.thumbnailCrop.origin,
                                    } : undefined}
                                    className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 shadow-[inset_0_0_36px_10px_rgba(28,26,23,0.16)] pointer-events-none" />
                            </div>
                            <h3 className="text-[15px] font-bold text-stone-900">{displayFrameName(frame)}</h3>
                            <p className="text-[13px] text-stone-500">{frameStartingPriceDisplay(frame)}</p>
                        </button>
                    ))}
                </div>
            </section>

            {/* Preview feature */}
            <section className="px-4 pt-6 pb-6">
                <div className="overflow-hidden rounded-2xl bg-stone-900 text-white">
                    <img src="/landing_carousel/frameworthy-3d-ar.webp" alt="Previewing a framed print on a living room wall through a phone" loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover" />
                    <div className="p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e3c66d] mb-2">Step three</p>
                        <h2 className="text-2xl font-bold tracking-tight leading-tight">See it on your wall before you buy</h2>
                        <ul className="mt-4 space-y-2.5 text-sm text-white/80">
                            <li className="flex gap-2.5"><Eye size={18} className="shrink-0 text-[#e3c66d]" /> Watch your frame update live as you choose the size, mount and glazing. Your price updates too.</li>
                            <li className="flex gap-2.5"><Images size={18} className="shrink-0 text-[#e3c66d]" /> Try it in realistic room scenes at true scale.</li>
                            <li className="flex gap-2.5"><Smartphone size={18} className="shrink-0 text-[#e3c66d]" /> Use AR to place it on your own wall in 3D.</li>
                        </ul>
                        <button
                            onClick={() => startFraming()}
                            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-stone-900 active:scale-[0.98] transition-transform"
                        >
                            Try the preview <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Delivery reassurance + final call to action */}
            <section className="px-4 pb-8">
                <div className="overflow-hidden rounded-2xl bg-white border border-stone-200 shadow-sm">
                    <img src="/landing_carousel/slide-delivered-door.webp" alt="A FrameWorthy delivery arriving at a front door" loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover" />
                    <div className="p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8892f] mb-2">Then we take it from here</p>
                        <h2 className="text-2xl font-bold leading-tight tracking-tight text-stone-900">Delivered to your door, ready to hang</h2>
                        <ul className="mt-4 space-y-2.5 text-sm text-stone-600">
                            <li className="flex gap-2.5"><Hammer size={18} className="shrink-0 text-[#a8892f]" /> Handcrafted to your exact choices.</li>
                            <li className="flex gap-2.5"><Truck size={18} className="shrink-0 text-[#a8892f]" /> Delivered across the UK and Jersey in 5–7 business days.</li>
                            <li className="flex gap-2.5"><ShieldCheck size={18} className="shrink-0 text-[#a8892f]" /> Check out as a guest. No account needed.</li>
                        </ul>
                        <button
                            onClick={() => startFraming()}
                            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a84c] px-6 py-4 text-base font-bold text-[#0a0a0a] active:scale-[0.98] transition-transform"
                        >
                            Start Framing <ArrowRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Compact footer */}
            <footer className="bg-stone-900 px-4 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] text-sm text-stone-300">
                <p className="text-xs font-bold uppercase tracking-widest text-white">Frameworthy&amp;co</p>
                <p className="mt-2 text-stone-400">Esplanade, St Helier, Jersey, JE2 3AS</p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                    <a href="tel:+447797789598" className="flex items-center justify-center gap-2 rounded-xl border border-stone-700 px-3 py-3 font-semibold text-white active:bg-stone-800">
                        <Phone size={16} /> Call us
                    </a>
                    <a href="mailto:admin@frameworthyco.com" className="flex items-center justify-center gap-2 rounded-xl border border-stone-700 px-3 py-3 font-semibold text-white active:bg-stone-800">
                        <Mail size={16} /> Email us
                    </a>
                </div>

                <nav className="mt-8 grid grid-cols-2 gap-x-4 gap-y-1" aria-label="Support and legal">
                    {LEGAL_LINKS.map(({ label, path }) => (
                        <button key={path} onClick={() => go(path)} className={`py-2 text-left ${path === '/help' ? 'font-bold text-[#c9a84c]' : 'text-stone-300'}`}>
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="mt-8 flex flex-wrap gap-3">
                    {SOCIAL_LINKS.map(({ title, href, icon }) => (
                        <a key={title} href={href} onClick={(e) => openExternalLink(e, href)} target="_blank" rel="noopener noreferrer" title={title} aria-label={title} className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-700 active:bg-stone-800">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                        </a>
                    ))}
                </div>

                <p className="mt-8 border-t border-stone-800 pt-6 text-xs text-stone-500">
                    © {new Date().getFullYear()} Frameworthy&amp;co
                </p>
            </footer>
        </div>
    );
}
