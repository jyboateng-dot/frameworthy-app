import { Paintbrush } from 'lucide-react';

export default function OriginalArtistsPage() {
    return (
        <section aria-labelledby="original-paintings-title" className="px-6 md:px-12 py-12 md:py-20 text-stone-900">
            <div className="max-w-2xl mx-auto text-center">
                <div className="mx-auto mb-6 w-14 h-14 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-500" aria-hidden="true">
                    <Paintbrush size={23} strokeWidth={1.3} />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-stone-500 mb-4">Coming soon</p>
                <h2 id="original-paintings-title" className="font-serif font-light text-3xl md:text-5xl tracking-tight mb-6">Original Paintings</h2>
                <p className="text-base md:text-lg font-light text-stone-600 leading-relaxed">
                    Original works. The artists behind them.
                </p>
                <p className="mt-4 text-sm text-stone-500 leading-relaxed max-w-lg mx-auto">
                    We’re welcoming artists to FrameWorthy and preparing their collections.
                    Soon, you’ll be able to discover and purchase their original paintings here,
                    with each artist’s work gathered in a collection under their name.
                </p>
                <div className="mt-10 pt-6 border-t border-stone-200">
                    <p className="text-xs text-stone-500">Artist collections will appear here as we welcome our first artists.</p>
                </div>
            </div>
        </section>
    );
}
