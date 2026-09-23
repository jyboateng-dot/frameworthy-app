import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { MUSEUM_SOURCES } from '../data/museumSources';

const MuseumSourcesPage = ({ isSubPage = false, sourceId = null }) => {
    const [activeSourceId, setActiveSourceId] = useState(sourceId || MUSEUM_SOURCES[0].id);
    React.useEffect(() => {
        if (sourceId) setActiveSourceId(sourceId);
    }, [sourceId]);
    const activeSource = MUSEUM_SOURCES.find(source => source.id === activeSourceId) || MUSEUM_SOURCES[0];

    return (
        <div className={isSubPage ? 'text-stone-900' : 'min-h-screen bg-[#faf9f8] text-stone-900'}>
            <header className="border-b border-stone-200">
                <div className="max-w-[2560px] mx-auto px-6 md:px-12 pb-4 pt-1">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1">Museum Sources</p>
                            <h1 className="font-serif font-light text-2xl md:text-3xl text-stone-900 tracking-tight leading-none mb-2">
                                Open Collection Sources
                            </h1>
                            <p className="text-sm text-stone-500 font-light max-w-lg leading-relaxed">
                                Explore the institutions that supply public-domain and openly licensed artwork for FrameWorthy.
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-[9px] uppercase tracking-[0.28em] text-stone-400 mb-1">SOURCES</p>
                            <p className="font-serif text-3xl text-stone-900 font-light leading-none">
                                {MUSEUM_SOURCES.length} <span className="text-xs text-stone-500 font-light ml-1">collections</span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {!sourceId && <div className="bg-[#faf9f8]/95 backdrop-blur-sm border-b border-stone-200 sticky top-12 z-20 py-3">
                <div className="max-w-[2560px] mx-auto px-6 md:px-12 flex items-center gap-2 overflow-x-auto no-scrollbar after:content-[''] after:pr-6 md:after:pr-12">
                    {MUSEUM_SOURCES.map(source => (
                        <button
                            key={source.id}
                            type="button"
                            onClick={() => setActiveSourceId(source.id)}
                            className={`flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                                activeSourceId === source.id
                                    ? 'bg-stone-900 text-white shadow-md'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                            }`}
                        >
                            {source.name}
                        </button>
                    ))}
                </div>
            </div>}

            <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-8 pb-12">
                <section className="max-w-3xl border border-stone-200 bg-white p-6 md:p-8 shadow-sm">
                    <p className="text-[9px] uppercase tracking-[0.28em] text-stone-400 mb-2">Selected source</p>
                    <h2 className="font-serif font-light text-2xl text-stone-900 mb-3">{activeSource.name}</h2>
                    <p className="text-sm text-stone-600 leading-relaxed mb-6">{activeSource.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
                        <div className="border-t border-stone-200 pt-3">
                            <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 mb-1">Rights</p>
                            <p className="text-sm text-stone-800">{activeSource.rights}</p>
                        </div>
                        <div className="border-t border-stone-200 pt-3">
                            <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 mb-1">Access</p>
                            <p className="text-sm text-stone-800">{activeSource.access}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <a
                            href={activeSource.apiUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-xs font-semibold hover:bg-stone-700 transition-colors"
                        >
                            API documentation <ExternalLink size={13} />
                        </a>
                        <a
                            href={activeSource.collectionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors"
                        >
                            View collection <ExternalLink size={13} />
                        </a>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default MuseumSourcesPage;
