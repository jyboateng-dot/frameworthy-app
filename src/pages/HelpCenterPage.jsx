import React, { useState } from 'react';
import { ArrowLeft, Search, MessageCircle, Phone, Mail, FileText, ChevronDown, ArrowRight, Clock, Package, HelpCircle, CheckCircle2 } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { useAuth } from '../context/AuthContext';
import PageMeta from '../components/common/PageMeta';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const CONTACT_EMAIL = 'admin@frameworthyco.com';

const FAQ_DATA = [
    {
        category: 'Ordering & Customization',
        questions: [
            {
                q: 'How do I upload and preview my photo?',
                a: 'Click "Start Framing" in the navigation menu to upload any photo from your phone or computer. Our real-time visualizer instantly displays your photo inside custom frames, letting you adjust frame styles, mounts, dimensions, and wall colours before placing your order.'
            },
            {
                q: 'What photo resolution and quality should I upload?',
                a: 'Simply upload the highest quality version of your image available to you. Our backend image processing engine automatically optimizes, sharpens, and enhances your upload as required for printing. If an image is impossible to enhance to print standards for your requested frame size, our studio team will reach out to you directly before printing.'
            },
            {
                q: 'What frame styles and aesthetic categories are available?',
                a: 'Our frame collection includes Modern & Minimalist, Wood Finishes, Classic & Traditional, Ornate & Antique, Rustic & Distressed, Glossy Finishes, Textured & Decorative, and Canvas. Explore narrow, wide, and deep profiles to suit your artwork.'
            },
            {
                q: 'What frame sizes do you offer and can I enter custom dimensions?',
                a: 'We offer standard and metric preset sizes ranging from small desktop frames (13 x 18 cm / 5x7 in) up to statement gallery sizes (60 x 90 cm / 24x36 in) and 120 x 120 cm pieces. You can also enter your own custom width and height dimensions directly into the customizer for tailor-made framing, and toggle between centimeters (cm) and inches (in) anytime.'
            },
            {
                q: 'How do mount colours and mount widths work?',
                a: 'A mount creates a considered border between the artwork and frame. Classic and Box frames can be ordered without a mount or with Snow White, Off-white, or Black mounting where the selected size supports it. The mount width is set automatically for the chosen frame size.'
            },
            {
                q: 'How do the glazing options differ?',
                a: 'Shatterproof Perspex is clear and lightweight, Float glazing has a crisp reflective finish, and Moth-eye glazing provides near reflection-free clarity. The available choice depends on the selected frame and size.'
            },
            {
                q: 'How do Gallery Wrapped Canvas, Traditional Canvas, and Floater Canvas framing and glazing work?',
                a: '1) Gallery Wrapped Canvas (Frame Style): Your artwork is stretched taut over deep wooden stretcher bars with the image wrapping smoothly around the edges for a frameless, modern studio presentation. 2) Traditional Canvas (Glazing): Canvas artwork set inside a classic outer moulding; finished with a protective UV matte sealant directly on the canvas surface, so separate glazing is not required and the natural tactile texture remains visible. 3) Floater Canvas (Glazing): Canvas mounted inside a recessed channel frame that leaves a subtle shadow gap around all edges, making the artwork appear to float inside the frame. Like traditional canvas, it is protected by a UV coating without separate glazing to showcase its depth.'
            },
            {
                q: 'Can I change the orientation of my frame (Portrait vs. Landscape)?',
                a: 'Yes. In the customizer studio, you can toggle between Portrait (vertical) and Landscape (horizontal) orientation with a single tap to best fit your artwork and wall layout.'
            },
            {
                q: 'Can I create a multi-photo collage frame?',
                a: 'We currently focus on handcrafted single-photo custom framing to ensure museum-grade precision for every print. Multi-photo collage grid layouts are currently in development and will be introduced in an upcoming release!'
            },
            {
                q: 'What hanging hardware comes pre-installed with my frame?',
                a: 'Every FrameWorthy order arrives complete and ready to hang straight out of the box. Depending on your frame size and weight, we pre-install heavy-duty hanging wire, sawtooth hangers, or stainless steel D-rings.'
            },
            {
                q: 'How does the Room & Wall Visualizer work?',
                a: 'The Room Visualizer lets you preview your custom frame against different wall textures and paint colors (such as Linen, Slate, Brick, Dark Wood, and Light Plaster) so you can see how your frame will look in a real room environment before buying.'
            },
            {
                q: 'Can I order museum art prints instead of uploading my own photos?',
                a: 'Yes! Visit our "Museum Art" page to browse artwork from open-access museum collections, ready for custom framing.'
            },
            {
                q: "How is my frame's price calculated?",
                a: 'Pricing is fully customization-based — you only pay for what you choose. Your final price reflects your selected size, frame style, mount, glazing, and hardware, and updates instantly in the customizer as you adjust each option.'
            }
        ]
    },
    {
        category: 'Shipping & Delivery',
        questions: [
            {
                q: 'How long does production and delivery take?',
                a: 'Each product is made to order. The live quote and checkout show the current delivery estimate for the selected product and destination.'
            },
            {
                q: 'How are delivery fees calculated and paid?',
                a: 'Standard delivery and applicable tax are included in the live GBP quote shown in the customizer.'
            },
            {
                q: 'Where do you deliver?',
                a: 'The current collection is available for delivery in the United Kingdom and Jersey.'
            }
        ]
    },
    {
        category: 'Payments',
        questions: [
            {
                q: 'What payment methods do you accept?',
                a: 'Prices are currently quoted in Pounds Sterling (GBP). Online payment is being connected, so checkout clearly shows when payment is not yet available.'
            },
            {
                q: 'Is my payment information secure?',
                a: 'FrameWorthy will use a secure payment provider and will never store your full card details or security code.'
            }
        ]
    },
    {
        category: 'Returns & Cancellations',
        questions: [
            {
                q: 'Do you guarantee satisfaction with my order?',
                a: "Yes. Every frame is backed by our satisfaction guarantee: if it arrives damaged, defective, or different from what you ordered, we'll arrange a free replacement or a full refund, whichever you prefer. See our Refund & Return Policy for full details."
            },
            {
                q: 'Can I cancel or modify my order after placing it?',
                a: 'Orders can be cancelled for a full refund before production begins. Once your order enters the "Processing" stage, production starts immediately and cancellations are no longer accepted.'
            },
            {
                q: 'What if my frame arrives damaged or defective?',
                a: 'If your item arrives damaged or incorrect, please notify us within 72 hours with photos of the issue. We will arrange a free replacement or a full refund back to your original payment method.'
            }
        ]
    }
];

const HelpCenterPage = ({ navigate, onOpenChat }) => {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [openFaqIndex, setOpenFaqIndex] = useState(null);
    
    // Email Form State
    const [formName, setFormName] = useState(user?.displayName || '');
    const [formEmail, setFormEmail] = useState(user?.email || '');
    const [formOrderNum, setFormOrderNum] = useState('');
    const [formSubject, setFormSubject] = useState('');
    const [formMessage, setFormMessage] = useState('');
    const [formStatus, setFormStatus] = useState({ submitting: false, success: false, error: null });

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!formEmail.trim() || !formMessage.trim() || formStatus.submitting) return;

        setFormStatus({ submitting: true, success: false, error: null });

        try {
            if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
                await emailjs.send(
                    EMAILJS_SERVICE_ID,
                    EMAILJS_TEMPLATE_ID,
                    {
                        user_name: formName || 'Customer',
                        user_email: formEmail,
                        order_id: formOrderNum || 'N/A',
                        subject: formSubject || 'Help Centre Inquiry',
                        message: formMessage,
                    },
                    EMAILJS_PUBLIC_KEY
                );
            } else {
                // Fallback: Open mailto link
                const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(formSubject || 'Customer Support Request')}&body=${encodeURIComponent(
                    `Name: ${formName}\nEmail: ${formEmail}\nOrder #: ${formOrderNum}\n\nMessage:\n${formMessage}`
                )}`;
                window.location.href = mailtoUrl;
            }

            setFormStatus({ submitting: false, success: true, error: null });
            setFormSubject('');
            setFormMessage('');
        } catch (err) {
            console.error('Email submission error:', err);
            setFormStatus({
                submitting: false,
                success: false,
                error: 'Failed to send message automatically. Please click email us directly or try calling.'
            });
        }
    };

    const toggleFaq = (idx) => {
        setOpenFaqIndex(openFaqIndex === idx ? null : idx);
    };

    // Filter FAQs by search query
    const filteredFaqs = FAQ_DATA.map(section => ({
        ...section,
        questions: section.questions.filter(item => 
            item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(section => section.questions.length > 0);

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans">
            <PageMeta
                title="Help Centre"
                description="Answers to common questions about ordering, delivery, and framing — or get in touch with FrameWorthy support."
            />
            <div className="max-w-4xl mx-auto px-6 lg:px-0 pt-16 md:pt-24 pb-24">
                {/* BACK BUTTON */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors duration-200 text-xs font-bold uppercase tracking-wider mb-8"
                >
                    <ArrowLeft size={14} /> Back
                </button>

                {/* TITLE HEADER */}
                <h1 className="font-serif text-2xl md:text-3xl font-light text-stone-900 tracking-tight leading-none mb-2">Help Centre</h1>
                <p className="text-xs text-stone-400 uppercase tracking-wider mb-8">Customer Support &amp; FAQ Hub</p>

                {/* SEARCH BAR */}
                <div className="relative mb-10">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search topics (e.g. shipping, frame sizes, payment, returns)..."
                        className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 text-sm transition shadow-sm"
                    />
                </div>

                {/* 3 CORE SUPPORT CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {/* Live Chat Card */}
                    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm hover:border-stone-400 transition flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-[#c9a84c]/10 text-[#c9a84c] flex items-center justify-center mb-4">
                                <MessageCircle size={20} />
                            </div>
                            <h3 className="font-serif text-lg font-bold text-stone-900 mb-1">Instant Chat</h3>
                            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
                                Chat in real-time with our support team regarding your order or frame customization.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                if (user) {
                                    onOpenChat?.();
                                } else {
                                    navigate('/auth?returnTo=/help');
                                }
                            }}
                            className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition"
                        >
                            {user ? 'Start Chat' : 'Sign in to Chat'} <ArrowRight size={12} />
                        </button>
                    </div>

                    {/* Call Support Card */}
                    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm hover:border-stone-400 transition flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                                <Phone size={20} />
                            </div>
                            <h3 className="font-serif text-lg font-bold text-stone-900 mb-1">Call Us</h3>
                            <p className="text-xs text-stone-500 mb-3 leading-relaxed">
                                Speak directly with our support team during business hours.
                            </p>
                            <div className="space-y-1 mb-4">
                                <a href="tel:+447797789598" className="block text-xs font-bold text-stone-900 hover:text-[#c9a84c] transition">
                                    📞 +44 7797 789598
                                </a>
                                <p className="text-[11px] text-stone-500 pt-1">
                                    Esplanade, St Helier, Jersey, JE2 3AS
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400 uppercase tracking-wider pt-2 border-t border-stone-100">
                            <Clock size={12} /> Mon-Sat: 8am-6pm GMT
                        </div>
                    </div>

                    {/* Email Support Card */}
                    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm hover:border-stone-400 transition flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
                                <Mail size={20} />
                            </div>
                            <h3 className="font-serif text-lg font-bold text-stone-900 mb-1">Email Us</h3>
                            <p className="text-xs text-stone-500 mb-3 leading-relaxed">
                                Send us an email and we will get back to you within 24 hours.
                            </p>
                            <a
                                href={`mailto:${CONTACT_EMAIL}`}
                                className="text-xs font-bold text-[#c9a84c] underline hover:text-stone-900 transition"
                            >
                                {CONTACT_EMAIL}
                            </a>
                        </div>
                        <a
                            href="#email-form"
                            className="w-full py-2.5 border border-stone-200 hover:border-stone-900 text-stone-900 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition mt-4"
                        >
                            Send Ticket <ArrowRight size={12} />
                        </a>
                    </div>
                </div>

                {/* MY ORDERS SHORTCUT */}
                {user && (
                    <div className="bg-white border border-stone-200 rounded-xl p-6 mb-12 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                                <Package className="text-stone-700" size={20} />
                            </div>
                            <div>
                                <h4 className="font-serif font-bold text-base text-stone-900">Have an active order?</h4>
                                <p className="text-xs text-stone-500">Check your order status and review receipts in your account.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/orders')}
                            className="px-5 py-2.5 bg-[#c9a84c] text-stone-950 font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[#d4b55c] transition shrink-0"
                        >
                            View Orders
                        </button>
                    </div>
                )}

                {/* FAQ ACCORDION SECTION */}
                <div className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 shadow-sm mb-12">
                    <h2 className="font-serif text-xl md:text-2xl font-bold text-stone-900 mb-1">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-xs text-stone-400 uppercase tracking-wider mb-8">Quick answers to common questions</p>

                    {filteredFaqs.length === 0 ? (
                        <div className="text-center py-8 text-stone-400">
                            <HelpCircle size={28} className="mx-auto mb-2 opacity-60" />
                            <p className="text-xs font-bold uppercase tracking-wider">No results for "{searchQuery}"</p>
                            <button
                                onClick={() => setSearchQuery('')}
                                className="text-xs text-[#c9a84c] underline font-bold mt-2"
                            >
                                Clear search
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {filteredFaqs.map((sec, secIdx) => (
                                <div key={secIdx}>
                                    <h3 className="font-serif text-sm font-bold text-stone-900 mb-3 border-b border-stone-100 pb-2">
                                        {sec.category}
                                    </h3>
                                    <div className="space-y-3">
                                        {sec.questions.map((item, qIdx) => {
                                            const globalIdx = `${secIdx}-${qIdx}`;
                                            const isOpen = openFaqIndex === globalIdx;
                                            return (
                                                <div
                                                    key={qIdx}
                                                    className="border border-stone-200 rounded-lg overflow-hidden transition"
                                                >
                                                    <button
                                                        onClick={() => toggleFaq(globalIdx)}
                                                        className="w-full px-5 py-3.5 text-left text-xs md:text-sm font-bold text-stone-900 flex items-center justify-between gap-4 bg-stone-50/50 hover:bg-stone-50 transition"
                                                    >
                                                        <span>{item.q}</span>
                                                        <ChevronDown
                                                            size={16}
                                                            className={`text-stone-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-stone-900' : ''}`}
                                                        />
                                                    </button>
                                                    {isOpen && (
                                                        <div className="px-5 py-4 text-xs md:text-sm text-stone-600 leading-relaxed border-t border-stone-100 bg-white">
                                                            {item.a}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* EMAIL FORM */}
                <div id="email-form" className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 shadow-sm mb-12">
                    <h2 className="font-serif text-xl md:text-2xl font-bold text-stone-900 mb-1">
                        Send Us a Message
                    </h2>
                    <p className="text-xs text-stone-400 uppercase tracking-wider mb-8">We usually reply within 24 hours</p>

                    {formStatus.success ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                            <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
                            <h4 className="font-serif font-bold text-emerald-900 text-lg mb-1">Message Received</h4>
                            <p className="text-xs text-emerald-800 max-w-md mx-auto mb-4">
                                Thank you for contacting FrameWorthy. Our team has received your message and will respond to your email.
                            </p>
                            <button
                                onClick={() => setFormStatus({ submitting: false, success: false, error: null })}
                                className="px-4 py-2 bg-emerald-800 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-emerald-900 transition"
                            >
                                Send Another
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Your Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        placeholder="name@example.com"
                                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Order Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={formOrderNum}
                                        onChange={(e) => setFormOrderNum(e.target.value)}
                                        placeholder="e.g. FW-10842"
                                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Subject</label>
                                    <input
                                        type="text"
                                        required
                                        value={formSubject}
                                        onChange={(e) => setFormSubject(e.target.value)}
                                        placeholder="e.g. Delivery Status Inquiry"
                                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Message</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formMessage}
                                    onChange={(e) => setFormMessage(e.target.value)}
                                    placeholder="How can we help you?"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition"
                                />
                            </div>

                            {formStatus.error && (
                                <p className="text-xs text-red-600 font-bold">{formStatus.error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={formStatus.submitting}
                                className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition disabled:opacity-50"
                            >
                                {formStatus.submitting ? 'Sending...' : 'Submit Inquiry'}
                            </button>
                        </form>
                    )}
                </div>

                {/* POLICY LINKS HUB */}
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-4 text-center">
                        Legal &amp; Policy Guidelines
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button
                            onClick={() => navigate('/terms')}
                            className="bg-white border border-stone-200 rounded-lg p-4 text-left hover:border-stone-900 transition flex items-center justify-between"
                        >
                            <span className="text-xs font-bold text-stone-800">Terms of Service</span>
                            <FileText size={14} className="text-stone-400" />
                        </button>
                        <button
                            onClick={() => navigate('/privacy')}
                            className="bg-white border border-stone-200 rounded-lg p-4 text-left hover:border-stone-900 transition flex items-center justify-between"
                        >
                            <span className="text-xs font-bold text-stone-800">Privacy Policy</span>
                            <FileText size={14} className="text-stone-400" />
                        </button>
                        <button
                            onClick={() => navigate('/refund-policy')}
                            className="bg-white border border-stone-200 rounded-lg p-4 text-left hover:border-stone-900 transition flex items-center justify-between"
                        >
                            <span className="text-xs font-bold text-stone-800">Refund Policy</span>
                            <FileText size={14} className="text-stone-400" />
                        </button>
                        <button
                            onClick={() => navigate('/delivery-policy')}
                            className="bg-white border border-stone-200 rounded-lg p-4 text-left hover:border-stone-900 transition flex items-center justify-between"
                        >
                            <span className="text-xs font-bold text-stone-800">Delivery Policy</span>
                            <FileText size={14} className="text-stone-400" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpCenterPage;
