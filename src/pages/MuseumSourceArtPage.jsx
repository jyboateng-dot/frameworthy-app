import React, { useEffect, useState } from 'react';
import { ExternalLink, Heart } from 'lucide-react';
import { FRAME_SIZES, formatDimensions } from '../data/constants';
import { useUnit } from '../context/UnitContext';
import { useWishlist } from '../context/WishlistContext';
import { getThumbnailUrl } from '../services/storage';
import { fetchMuseumArtworks } from '../services/museumApi';
import { MUSEUM_SOURCES } from '../data/museumSources';
import { ARCHIVAL_SOURCES } from '../data/archivalSources';
import CollectionPagination from '../components/common/CollectionPagination';
import { maxFramePrintSize } from '../utils/maxFramePrintSize';

// In-memory session cache for 0ms tab switching
const sourceArtCache = new Map();

const ArtworkCardSkeleton = () => (
    <div className="flex flex-col gap-3 animate-pulse">
        <div className="bg-stone-200/70 border border-stone-200/50 aspect-square rounded-sm" />
        <div className="flex flex-col gap-2 px-1">
            <div className="h-4 bg-stone-200/80 rounded w-3/4" />
            <div className="h-3 bg-stone-200/60 rounded w-1/2" />
            <div className="h-3 bg-stone-200/50 rounded w-1/3" />
        </div>
    </div>
);

const MuseumSourceArtPage = ({ sourceId, setProductMode, setSelectedSize, navigate, isSubPage = false, disableWindowScroll = false }) => {
    const { unit } = useUnit();
    const source = [...MUSEUM_SOURCES, ...ARCHIVAL_SOURCES].find(item => item.id === sourceId);
    const [page, setPage] = useState(1);

    const cacheKey = `${sourceId}_${page}`;
    const [state, setState] = useState(() => {
        const cached = sourceArtCache.get(cacheKey);
        return cached
            ? { key: cacheKey, status: 'ready', ...cached, error: '' }
            : { key: cacheKey, status: 'loading', artworks: [], total: 0, error: '' };
    });
    const cachedPage = sourceArtCache.get(cacheKey);
    const viewState = cachedPage
        ? { key: cacheKey, status: 'ready', ...cachedPage, error: '' }
        : state.key === cacheKey
            ? state
            : { key: cacheKey, status: 'loading', artworks: [], total: 0, error: '' };

    useEffect(() => {
        let cancelled = false;
        const key = `${sourceId}_${page}`;
        const cached = sourceArtCache.get(key);

        if (!cached) {
            fetchMuseumArtworks(sourceId, page)
                .then(result => {
                    sourceArtCache.set(key, result);
                    if (!cancelled) setState({ key, status: 'ready', ...result, error: '' });
                })
                .catch(error => {
                    if (!cancelled) setState({ key, status: 'error', artworks: [], total: 0, error: error.message });
                });
        }

        if (!disableWindowScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
        return () => { cancelled = true; };
    }, [sourceId, page, disableWindowScroll]);

    const handleGetThis = (artwork) => {
        setProductMode('frame');
        const pixelSize = (artwork.imageWidth && artwork.imageHeight)
            ? { w: artwork.imageWidth, h: artwork.imageHeight }
            : null;
        const maxSize = maxFramePrintSize(pixelSize);
        const sizeObj = maxSize || artwork.recommendedSize || null;
        if (sizeObj && setSelectedSize) setSelectedSize(sizeObj);
        const orientation = maxSize?.orientation || artwork.orientation || sizeObj?.orientation || 'portrait';
        navigate('/frame/customize', {
            state: {
                presetImage: artwork.fullRes || artwork.image,
                presetTitle: artwork.artist ? `${artwork.title} — ${artwork.artist}` : artwork.title,
                initialSize: sizeObj,
                imageWidth: artwork.imageWidth || null,
                imageHeight: artwork.imageHeight || null,
                orientation,
            },
        });
    };

    if (!source) return null;
    const totalPages = Math.max(1, Math.ceil(viewState.total / 24));

    return (
        <div className={isSubPage ? 'text-stone-900' : 'min-h-screen bg-[#faf9f8] text-stone-900'} style={{ fontFamily: "'Inter', sans-serif" }}>
            <header className="border-b border-stone-200">
                <div className="max-w-[2560px] mx-auto px-6 md:px-12 pb-4 pt-1">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-stone-500 font-bold mb-1">{source.name}</p>
                    <h1 className="font-serif font-light text-2xl md:text-3xl tracking-tight leading-none mb-2">{source.name} Collection</h1>
                    <p className="text-sm text-stone-500 font-light max-w-2xl leading-relaxed">{source.description}</p>
                </div>
            </header>

            <main className="max-w-[2560px] mx-auto px-6 md:px-12 pt-8 pb-12">
                {viewState.status === 'loading' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
                        {Array.from({ length: 12 }, (_, i) => (
                            <ArtworkCardSkeleton key={i} />
                        ))}
                    </div>
                )}
                {viewState.status === 'error' && (
                    <div className="max-w-2xl border border-stone-200 bg-white p-6">
                        <p className="text-sm font-medium text-stone-900 mb-2">Artwork feed is not available yet.</p>
                        <p className="text-xs text-stone-500 leading-relaxed mb-4">{viewState.error}</p>
                        <a href={source.apiUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-stone-900 hover:text-stone-600">API documentation <ExternalLink size={13} /></a>
                    </div>
                )}
                {viewState.status === 'ready' && (
                    <>
                        {viewState.artworks.length === 0 ? (
                            <p className="py-20 text-center text-sm text-stone-500">No artwork with a usable public image was returned.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
                                {viewState.artworks.map((artwork, index) => (
                                    <MuseumArtworkCard key={artwork.id} artwork={artwork} unit={unit} onGetThis={handleGetThis} prioritizeImage={index < 4} fetchPriority={index === 0 ? 'high' : 'auto'} />
                                ))}
                            </div>
                        )}
                        <CollectionPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                    </>
                )}
            </main>
        </div>
    );
};

const MuseumArtworkCard = ({ artwork, unit, onGetThis, prioritizeImage, fetchPriority }) => {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const [hovered, setHovered] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const liked = isInWishlist(artwork.id);
    const maxSize = maxFramePrintSize({ w: artwork.imageWidth, h: artwork.imageHeight });

    return (
        <article className="group relative flex flex-col gap-3" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <div className="relative overflow-hidden bg-white flex items-center justify-center border border-stone-200/50 aspect-square">
                {!imageError ? (
                    <img
                        src={getThumbnailUrl(artwork.image)}
                        alt={artwork.title}
                        loading={prioritizeImage ? 'eager' : 'lazy'}
                        fetchPriority={fetchPriority}
                        decoding="async"
                        onLoad={() => setImageLoaded(true)}
                        onError={() => {
                            setImageLoaded(true);
                            setImageError(true);
                        }}
                        className={`w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-[1.03] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-stone-100 text-stone-400 p-4 text-center">
                        <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[11px] font-medium text-stone-600 line-clamp-2">{artwork.title}</span>
                    </div>
                )}
                {!imageLoaded && !imageError && (
                    <div className="absolute inset-0 bg-stone-100 animate-pulse" />
                )}
                <div className={`absolute inset-0 bg-stone-50/20 flex items-center justify-center transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                    <button type="button" onClick={() => onGetThis(artwork)} className="px-6 py-2.5 bg-white/80 backdrop-blur-md text-stone-900 border border-white/60 hover:bg-white text-[10px] font-semibold uppercase tracking-[0.2em] shadow-sm rounded-sm">Get This</button>
                </div>
                <button type="button" onClick={() => toggleWishlist(artwork)} className={`absolute top-2.5 right-2.5 p-1.5 z-10 ${liked ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`} aria-label="Save"><Heart size={13} fill={liked ? 'currentColor' : 'none'} strokeWidth={1.5} /></button>
            </div>
            <div className="flex flex-col gap-1 px-1">
                <h3 className="text-sm text-stone-900 font-medium leading-tight truncate" title={artwork.title}>{artwork.title}</h3>
                <p className="text-xs text-stone-500 truncate" title={artwork.artist}>{artwork.artist}</p>
                {maxSize && (
                    <p className="text-[10px] text-stone-500 font-light leading-snug">Max frame size {formatDimensions(maxSize.label, unit, maxSize.orientation)}</p>
                )}
                <button type="button" onClick={() => onGetThis(artwork)} className="text-left text-[10px] uppercase tracking-wider mt-1 text-stone-900 hover:text-stone-700 font-bold">Get This</button>
            </div>
        </article>
    );
};

export default MuseumSourceArtPage;
