import React, { useState, useEffect } from 'react';
import { ArrowRight, Shield, Sun, Layers, Truck, Sparkles, MoveRight } from 'lucide-react';
import { FRAME_STYLES } from '../data/constants';

// Curated collections grouping for Bubola-style storytelling
const COLLECTIONS = [
    {
        title: "The Italian Gilded Collection",
        tagline: "Classically crafted, luxury gold and bronze profiles.",
        frameIds: ['flat-gold', 'flat-bronze', 'antique-gold-deep-shadow']
    },
    {
        title: "The Contemporary Gallery",
        tagline: "Sleek, minimalist profiles for clean modern lines.",
        frameIds: ['flat-black-contemporary', 'flat-white-deep', 'flat-silver']
    },
    {
        title: "The Warm & Weathered",
        tagline: "Rich walnut, mahogany, and rustic grey wood finishes.",
        frameIds: ['walnut-square-shadow', 'mahogany-shadow', 'grey-barnwood-shadow']
    }
];

// Map frame style IDs to their details
const FRAME_CORNER_DATA = {
    'flat-black-contemporary': { image: '/frames/flat-black-contemporary.png', accent: '#1a1a1a', tagline: 'Sleek & Versatile' },
    'flat-white-deep': { image: '/frames/flat-white-deep.png', accent: '#f9f9f9', tagline: 'Clean & Minimalist' },
    'flat-silver': { image: '/frames/flat-silver.png', accent: '#e5e7eb', tagline: 'Sleek & Metallic' },
    'flat-gold': { image: '/frames/flat-gold.png', accent: '#D4AF37', tagline: 'Warm & Luxurious' },
    'flat-bronze': { image: '/frames/flat-bronze.png', accent: '#cd7f32', tagline: 'Timeless Patina' },
    'flat-brown-deep': { image: '/frames/flat-brown-deep.png', accent: '#4a2c11', tagline: 'Deep Rich Brown Wood' },
    'metallic-pink': { image: '/frames/metallic-pink.png', accent: '#e0a6c2', tagline: 'Vibrant & Modern' },
    'metallic-pearl-white': { image: '/frames/metallic-pearl-white.png', accent: '#f9f9fb', tagline: 'Sleek & Bright Pearl' },
    'metallic-pewter': { image: '/frames/metallic-pewter.png', accent: '#708090', tagline: 'Sophisticated & Metallic' },
    'rose-gold-metallic': { image: '/frames/rose-gold-metallic.png', accent: '#b76e79', tagline: 'Elegant Rose Gold Glow' },
    'black-walnut-shadow': { image: '/frames/black-walnut-shadow.png', accent: '#2b2625', tagline: 'Elegant Black & Walnut Accent' },
    'walnut-square-shadow': { image: '/frames/walnut-square-shadow.png', accent: '#4d372c', tagline: 'Classic Warm Walnut' },
    'brown-square-shadow': { image: '/frames/brown-square-shadow.png', accent: '#5a3e2e', tagline: 'Rich Wood Tone Shadow Box' },
    'slate-grey-square-shadow': { image: '/frames/slate-grey-shadow.png', accent: '#708090', tagline: 'Modern Slate Grey Square' },
    'antique-gold-deep-shadow': { image: '/frames/antique-gold-deep-shadow.png', accent: '#bf953f', tagline: 'Warm Tall Gold Shadow Box' },
    'mahogany-shadow': { image: '/frames/mahogany-shadow.png', accent: '#4A1816', tagline: 'Reddish Mahogany Tone' },
    'brown-barnwood-shadow': { image: '/frames/brown-barnwood-shadow.png', accent: '#8B5E3C', tagline: 'Rustic Brown Wood Frame' },
    'grey-barnwood-shadow': { image: '/frames/grey-barnwood-shadow.png', accent: '#708090', tagline: 'Weathered Grey Wood Frame' },
};

export const LandingPage = ({ navigate, setSelectedFrame }) => {
    const [loaded, setLoaded] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState(0);

    useEffect(() => {
        setLoaded(true);
    }, []);

    const handleFrameSelect = (frameStyle) => {
        if (setSelectedFrame) {
            setSelectedFrame(frameStyle);
        }
        navigate('/frame/customize');
    };

    return (
        <div className="min-h-[calc(100vh-56px)] bg-[#fbf9f6] text-[#2c2b29] font-sans selection:bg-[#c5b89d] selection:text-white overflow-hidden">
            
            {/* ── SECTION 1: ASYMMETRIC EDITORIAL HERO ── */}
            <section className="relative w-full py-16 lg:py-24 px-6 md:px-12 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                {/* Left Side: Serif Bold Typography & Overlap Card */}
                <div className="lg:col-span-6 flex flex-col justify-center items-start z-10 space-y-8">
                    <span className="text-xs font-semibold tracking-[0.25em] text-[#9a8e7d] uppercase">
                        Accra, Ghana — Italian Inspiration
                    </span>
                    <h1 className="text-4xl sm:text-6xl font-serif text-[#1e1e1e] font-light leading-[1.1] tracking-tight">
                        The art of <br />
                        <span className="font-serif italic font-normal text-[#9a8e7d]">vertical furnishing.</span>
                    </h1>
                    
                    <p className="text-stone-500 font-light text-base md:text-lg max-w-lg leading-relaxed">
                        Moving beyond simple frames. We craft bespoke modular wall compositions, turning your cherished memories and artworks into statement gallery pieces.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4 w-full sm:w-auto">
                        <button
                            onClick={() => navigate('/frame/customize')}
                            className="group flex items-center justify-between gap-6 px-8 py-4 bg-[#144746] hover:bg-[#0e3534] text-white text-sm font-bold uppercase tracking-wider rounded-none transition-all duration-300 shadow-md"
                        >
                            Design custom frame
                            <MoveRight size={18} className="group-hover:translate-x-2 transition-transform duration-300" />
                        </button>
                        <button
                            onClick={() => {
                                document.getElementById('editorial-collections')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-8 py-4 border border-[#e2ded7] hover:border-[#9a8e7d] text-[#1e1e1e] text-sm font-bold uppercase tracking-wider rounded-none transition-all duration-300"
                        >
                            Explore Collections
                        </button>
                    </div>
                </div>

                {/* Right Side: Artsy overlapping composition */}
                <div className="lg:col-span-6 relative w-full aspect-[4/3] sm:aspect-square flex items-center justify-center">
                    
                    {/* Big background room crop */}
                    <div className="absolute inset-0 bg-[#eae6df] rounded-none overflow-hidden shadow-sm">
                        <img 
                            src="/hero_hanging_frame.png" 
                            alt="Beautiful living room setting"
                            className="w-full h-full object-cover grayscale-[20%] opacity-85 hover:scale-105 transition-transform duration-700"
                        />
                    </div>

                    {/* Elegant floating framed detail card */}
                    <div className="absolute -bottom-8 -left-6 md:-left-12 bg-[#faf8f5] p-5 shadow-2xl border border-stone-200/50 hidden sm:block max-w-[280px]">
                        <span className="text-[10px] font-semibold tracking-widest text-[#9a8e7d] uppercase block mb-1">Featured Moulding</span>
                        <h4 className="font-serif italic text-stone-900 text-lg leading-snug">Flat Gold Gallery</h4>
                        <p className="text-stone-400 text-xs mt-1 mb-4 font-light">Warm, luxurious leafing with an editorial shadow line detail.</p>
                        <button 
                            onClick={() => handleFrameSelect(FRAME_STYLES.find(f => f.id === 'flat-gold'))}
                            className="text-xs font-bold uppercase tracking-wider text-[#144746] hover:text-[#0e3534] flex items-center gap-1.5"
                        >
                            Configure <ArrowRight size={12} />
                        </button>
                    </div>

                    {/* Abstract overlapping colored shape block to add design flair */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#144746]/10 -z-10" />
                </div>
            </section>

            {/* ── SECTION 2: BUBOLA CONCEPT EXPLANATION ── */}
            <section className="bg-[#faf8f5] py-20 border-y border-stone-200/40 px-6">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="space-y-3">
                        <span className="text-xs font-bold tracking-widest text-[#9a8e7d] uppercase">01 / Composition</span>
                        <h3 className="text-xl font-serif font-light text-stone-900">Modular Architecture</h3>
                        <p className="text-stone-500 font-light text-sm leading-relaxed">
                            Create grids, diptychs, or overlapping layers. Our system matches frame styles visually to achieve balance on any wall scale.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <span className="text-xs font-bold tracking-widest text-[#9a8e7d] uppercase">02 / Craftsmanship</span>
                        <h3 className="text-xl font-serif font-light text-stone-900">Timber & Gilding</h3>
                        <p className="text-stone-500 font-light text-sm leading-relaxed">
                            Every moulding is cut from solid premium wood, and hand-finished with either fine stains or classic metallic foil leafing.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <span className="text-xs font-bold tracking-widest text-[#9a8e7d] uppercase">03 / Archival</span>
                        <h3 className="text-xl font-serif font-light text-stone-900">Museum Protection</h3>
                        <p className="text-stone-500 font-light text-sm leading-relaxed">
                            Protected by premium UV-resistant acrylic and acid-free cotton mats to keep art vivid and preserved for centuries.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── SECTION 3: THE BUBOLA EDITORIAL COLLECTIONS (SWITCHER) ── */}
            <section id="editorial-collections" className="py-24 px-6 max-w-7xl mx-auto">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <span className="text-xs font-semibold tracking-[0.2em] text-[#9a8e7d] uppercase">The Collection Catalog</span>
                    <h2 className="text-3xl md:text-4xl font-serif text-[#1e1e1e] font-light mt-3">
                        Bespoke Frame Suites
                    </h2>
                    <p className="text-stone-500 font-light text-sm mt-3">
                        Select a style suite below to view the handpicked profiles curated for high-end interior spaces.
                    </p>

                    {/* Collection Tabs */}
                    <div className="flex justify-center gap-4 mt-8 border-b border-stone-200/60 pb-3">
                        {COLLECTIONS.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedCollection(i)}
                                className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-widest transition-all duration-300 relative ${
                                    selectedCollection === i ? 'text-[#144746]' : 'text-stone-400 hover:text-stone-600'
                                }`}
                            >
                                {c.title.split(' ')[1] || c.title}
                                {selectedCollection === i && (
                                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#144746]" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Asymmetrical Grid for the active collection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                    {FRAME_STYLES.filter(style => COLLECTIONS[selectedCollection].frameIds.includes(style.id)).map((style, idx) => {
                        const corner = FRAME_CORNER_DATA[style.id] || {};
                        return (
                            <div 
                                key={style.id}
                                onClick={() => handleFrameSelect(style)}
                                className={`group cursor-pointer bg-white border border-stone-100 hover:border-stone-200 hover:shadow-xl transition-all duration-500 p-6 flex flex-col justify-between ${
                                    idx === 1 ? 'md:-translate-y-6' : '' // Asymmetry offset
                                }`}
                            >
                                <div className="aspect-square bg-[#faf8f5] overflow-hidden relative mb-6">
                                    <img 
                                        src={corner.image || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80'} 
                                        alt={style.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-[#144746]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </div>
                                
                                <div>
                                    <div className="flex justify-between items-baseline mb-2">
                                        <h3 className="font-serif text-[#1e1e1e] text-lg font-light group-hover:text-[#144746] transition-colors duration-300">
                                            {style.name}
                                        </h3>
                                        <span className="text-xs font-semibold text-stone-500">
                                            GH₵{Math.round(99 * style.priceMod)}
                                        </span>
                                    </div>
                                    <p className="text-stone-400 font-light text-xs leading-relaxed mb-4">
                                        {style.desc}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#144746] border-t border-stone-100 pt-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                        Start Configuring
                                        <ArrowRight size={14} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── SECTION 4: THE CRAFTSMAN'S STUDIO EDITORIAL SPREAD ── */}
            <section className="bg-[#144746] text-[#eae6df] py-24 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                    
                    {/* Editorial text columns */}
                    <div className="lg:col-span-5 space-y-6">
                        <span className="text-xs font-bold tracking-[0.25em] text-[#c5b89d] uppercase">Accra Workshop Studio</span>
                        <h2 className="text-3xl md:text-5xl font-serif text-white font-light leading-tight">
                            Crafted locally. <br />
                            <span className="font-serif italic font-normal text-[#c5b89d]">Designed digitally.</span>
                        </h2>
                        <p className="text-stone-300 font-light text-sm leading-relaxed">
                            Our state-of-the-art framing studio combines automated, high-precision mitering with manual gold foil leaf gilding. This ensures tight corners, clean shadow-lines, and a beautiful weight.
                        </p>
                        <ul className="space-y-3 pt-4 text-sm font-light text-stone-200">
                            <li className="flex items-center gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#c5b89d]" /> Solid sustainably sourced hardwoods
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#c5b89d]" /> Multi-angle, high-strength joinery
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#c5b89d]" /> Local expert delivery & hanging consultation in Accra
                            </li>
                        </ul>
                    </div>

                    {/* High-quality layout overlapping pictures of the workspace */}
                    <div className="lg:col-span-7 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-8 overflow-hidden aspect-[4/5] shadow-2xl relative">
                            <img 
                                src="/gallery_banner.png" 
                                alt="Exquisite wall gallery framing composition"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="col-span-4 overflow-hidden aspect-square shadow-xl relative -translate-x-12 translate-y-12 hidden md:block border-[6px] border-[#144746]">
                            <img 
                                src="/living_room_banner.png" 
                                alt="Frame shop detailing"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION 5: TRUST AND BENCHMARKS ── */}
            <section className="bg-white py-16 border-b border-stone-200/50">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <Layers className="text-[#9a8e7d]" size={24} strokeWidth={1.5} />
                            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800">100% Solid Timber</h4>
                            <p className="text-stone-400 text-[11px] font-light max-w-[150px]">No composite core or artificial laminates.</p>
                        </div>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <Sun className="text-[#9a8e7d]" size={24} strokeWidth={1.5} />
                            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800">UV-Proof Acrylic</h4>
                            <p className="text-stone-400 text-[11px] font-light max-w-[150px]">Preserves print clarity, filtering harmful light.</p>
                        </div>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <Shield className="text-[#9a8e7d]" size={24} strokeWidth={1.5} />
                            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800">Archival Matboards</h4>
                            <p className="text-stone-400 text-[11px] font-light max-w-[150px]">Acid-free backings block yellowing over time.</p>
                        </div>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <Truck className="text-[#9a8e7d]" size={24} strokeWidth={1.5} />
                            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800">Accra Hand Delivery</h4>
                            <p className="text-stone-400 text-[11px] font-light max-w-[150px]">Delivered direct by framing professionals.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION 6: BOTTOM CALL-TO-ACTION ── */}
            <section className="py-24 px-6 bg-[#fbf9f6] text-center">
                <div className="max-w-2xl mx-auto space-y-6">
                    <span className="text-xs font-semibold tracking-widest text-[#9a8e7d] uppercase">Start Your Design</span>
                    <h2 className="text-3xl md:text-5xl font-serif text-[#1e1e1e] font-light tracking-tight">
                        Transform your bare walls.
                    </h2>
                    <p className="text-stone-500 font-light text-base max-w-lg mx-auto leading-relaxed">
                        Upload your high-res digital image, pick your moulding style, and preview in real-time. We miter, join, and ship directly.
                    </p>
                    <button
                        onClick={() => navigate('/frame/customize')}
                        className="group inline-flex items-center justify-between gap-6 px-10 py-5 bg-[#1e1e1e] hover:bg-black text-white text-sm font-bold uppercase tracking-widest transition-all duration-300"
                    >
                        Begin Framing Session
                        <MoveRight size={18} className="group-hover:translate-x-2 transition-transform duration-300" />
                    </button>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
