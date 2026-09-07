import React from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from '../components/common/LogoMark';
import PageMeta from '../components/common/PageMeta';

// Shown for any URL that doesn't match a real route — previously the
// catch-all route silently redirected to the homepage instead, which left
// a mistyped or broken link with no explanation at all.
const NotFoundPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans flex items-center justify-center">
            <PageMeta title="Page Not Found" description="The page you're looking for doesn't exist or has moved." />
            <div className="max-w-md mx-auto px-6 pt-16 md:pt-24 pb-24 text-center">
                <LogoMark size={48} className="mx-auto mb-8" />
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">404</p>
                <h1 className="font-serif text-2xl md:text-3xl font-light tracking-tight leading-tight mb-3">
                    This page doesn&rsquo;t exist
                </h1>
                <p className="text-sm text-stone-500 mb-8">
                    The link you followed may be broken, or the page may have moved. Let&rsquo;s get you
                    back on track.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full sm:w-auto px-6 py-3 text-sm font-bold bg-[#c9a84c] text-[#0a0a0a] rounded-full hover:bg-[#d4b55c] transition-colors"
                    >
                        Back to Home
                    </button>
                    <button
                        onClick={() => navigate('/frame/customize')}
                        className="w-full sm:w-auto px-6 py-3 text-sm font-bold border border-stone-300 rounded-full hover:border-stone-900 transition-colors"
                    >
                        Start Framing
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;
