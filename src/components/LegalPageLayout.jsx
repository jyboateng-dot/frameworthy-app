import React from 'react';
import { ArrowLeft } from 'lucide-react';

// Shared shell for the standalone legal pages (Terms, Privacy, Refund
// Policy) so each one only needs to supply its own sections, not repeat
// the header/back-link/typography chrome three times.
const LegalPageLayout = ({ navigate, title, effectiveDate, children }) => (
    <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans">
        <div className="max-w-3xl mx-auto px-6 lg:px-0 pt-28 pb-24">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors duration-200 text-xs font-bold uppercase tracking-wider mb-10"
            >
                <ArrowLeft size={14} /> Back
            </button>

            <h1 className="font-serif text-3xl md:text-4xl font-light text-stone-900 mb-2">{title}</h1>
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-12">Effective {effectiveDate}</p>

            <div className="space-y-10">
                {children}
            </div>
        </div>
    </div>
);

export const LegalSection = ({ title, children }) => (
    <section>
        <h2 className="font-serif text-lg font-bold text-stone-900 mb-3">{title}</h2>
        <div className="text-sm leading-relaxed text-stone-600 space-y-3">
            {children}
        </div>
    </section>
);

export default LegalPageLayout;
