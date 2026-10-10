const fs = require('fs');
const path = 'src/pages/LandingPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add CAROUSEL_SLIDES and Info sections to LandingPage
const carouselHero = `
            {/* Hero Carousel Section */}
            <section className="relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden">
                {/* Background Carousel */}
                <div className="absolute inset-0 w-full h-full">
                    {CAROUSEL_SLIDES.map((slide, index) => (
                        <div 
                            key={index}
                            className={\`absolute inset-0 w-full h-full transition-opacity duration-1000 \${currentSlide === index ? 'opacity-100' : 'opacity-0'}\`}
                        >
                            <img src={slide.img} alt="Frame" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-stone-900/40" />
                        </div>
                    ))}
                </div>

                {/* Hero Content */}
                <div className="relative z-10 px-6 flex flex-col items-center text-center max-w-4xl mx-auto pt-20">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold uppercase tracking-widest mb-8 animate-fade-in-up">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Museum Quality Custom Framing</span>
                    </div>
                    
                    <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter leading-[1.05] mb-6 text-white drop-shadow-md">
                        Frame your memories <br className="hidden md:block"/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-stone-200 to-stone-400">beautifully.</span>
                    </h1>
                    
                    <p className="text-lg lg:text-xl text-stone-200 max-w-2xl leading-relaxed mb-10 drop-shadow">
                        Upload your digital art or photography and we'll hand-craft a stunning, museum-quality frame delivered straight to your door.
                    </p>

                    <button 
                        onClick={onStartFraming}
                        className="px-8 py-4 bg-white text-stone-900 rounded-full font-bold text-lg hover:bg-stone-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                        Start Customizing
                    </button>
                </div>

                {/* Carousel Indicators */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
                    {CAROUSEL_SLIDES.map((_, idx) => (
                        <button 
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className={\`w-2.5 h-2.5 rounded-full transition-all \${currentSlide === idx ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}\`}
                        />
                    ))}
                </div>
            </section>
`;

const infoSection = `
            {/* Info Section */}
            <section className="py-24 bg-stone-50 border-t border-stone-200">
                <div className="max-w-7xl mx-auto px-6 lg:px-12">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 mb-4">How It Works</h2>
                        <p className="text-stone-500 max-w-2xl mx-auto">Three simple steps to museum-quality framing.</p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-12 text-center">
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center mb-6">
                                <span className="text-2xl font-bold text-stone-900">1</span>
                            </div>
                            <h3 className="text-xl font-bold text-stone-900 mb-3">Upload & Customize</h3>
                            <p className="text-stone-500 leading-relaxed">Upload your photo or art, and preview it instantly in hundreds of frame styles using our 3D visualizer.</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center mb-6">
                                <span className="text-2xl font-bold text-stone-900">2</span>
                            </div>
                            <h3 className="text-xl font-bold text-stone-900 mb-3">Handcrafted With Care</h3>
                            <p className="text-stone-500 leading-relaxed">Our artisans custom-build your frame using premium materials and archival-quality mats and acrylic.</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center mb-6">
                                <span className="text-2xl font-bold text-stone-900">3</span>
                            </div>
                            <h3 className="text-xl font-bold text-stone-900 mb-3">Delivered Ready to Hang</h3>
                            <p className="text-stone-500 leading-relaxed">Your framed piece arrives securely packaged with hanging hardware already installed.</p>
                        </div>
                    </div>
                </div>
            </section>
`;

// Insert state
if (!content.includes('currentSlide')) {
    content = content.replace("const [currentPage, setCurrentPage] = useState(1);", "const [currentPage, setCurrentPage] = useState(1);\n    const [currentSlide, setCurrentSlide] = useState(0);\n    const CAROUSEL_SLIDES = [\n        { img: FRAME_STYLES[0]?.previewImg || '' },\n        { img: FRAME_STYLES[12]?.previewImg || '' },\n        { img: FRAME_STYLES[24]?.previewImg || '' },\n        { img: FRAME_STYLES[36]?.previewImg || '' }\n    ];\n\n    useEffect(() => {\n        const timer = setInterval(() => setCurrentSlide(s => (s + 1) % CAROUSEL_SLIDES.length), 5000);\n        return () => clearInterval(timer);\n    }, []);\n");
}

// Replace Hero
content = content.replace(/\{\/\* Hero Section \*\/\}[\s\S]*?(?=\{\/\* Categorized Gallery Section \*\/})/, carouselHero);

// Insert Info Section
content = content.replace(/\{\/\* Footer \*\/\}/, infoSection + '\n            {/* Footer */}');

fs.writeFileSync(path, content);
console.log('Restored Top Carousel and Bottom Info Section');
