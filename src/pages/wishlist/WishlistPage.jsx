import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import { Heart, Trash2, ArrowLeft } from 'lucide-react';
import { FRAME_SIZES, parseCustomSize, findSizeByDimension, clampSizeToValidRange } from '../../data/constants';
import { DEFAULT_PRODIGI_FRAME } from '../../data/frameBrowsing';

const WishlistPage = () => {
    const { wishlistItems, removeFromWishlist } = useWishlist();
    const navigate = useNavigate();

    const customizeProduct = (product) => {
        const rawSizeObj = parseCustomSize(product.dims) || findSizeByDimension(product.dims) || FRAME_SIZES.find(s => s.id === product.sizeId) || FRAME_SIZES[0];
        const { size: sizeObj } = clampSizeToValidRange(rawSizeObj);
        navigate('/frame/customize', { state: {
            presetImage: product.fullRes || product.image,
            productionImage: product.fullRes || product.image,
            presetTitle: product.title,
            presetDims: product.dims,
            initialFrame: DEFAULT_PRODIGI_FRAME,
            initialSize: sizeObj,
            orientation: sizeObj.orientation || 'portrait',
        }});
    };

    if (wishlistItems.length === 0) {
        return (
            <div className="min-h-screen bg-[#faf9f8] flex flex-col pt-[60px]">
                {/* Global Header */}
                <div className="px-4 py-3 bg-white flex items-center gap-3 border-b border-stone-100">
                    <button onClick={() => navigate(-1)} className="p-1">
                        <ArrowLeft size={20} className="text-stone-900" />
                    </button>
                    <span className="font-bold text-stone-900 text-sm">Your Wishlist</span>
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6">
                        <Heart size={32} className="text-stone-300" />
                    </div>
                    <h2 className="text-xl font-serif text-stone-900 mb-2">Your wishlist is empty</h2>
                    <p className="text-stone-500 text-center mb-8 text-sm">
                        Find something you love? Tap the heart icon to save it for later.
                    </p>
                    <button 
                        onClick={() => navigate('/curated-art')}
                        className="px-8 py-3 bg-stone-900 text-white font-bold rounded-full text-sm hover:bg-stone-800 transition"
                    >
                        Browse Curated Art
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf9f8] flex flex-col pt-[60px] pb-32 relative">
            <div className="flex-1 overflow-y-auto">
                {/* Global Header */}
                <div className="px-4 py-3 bg-white flex items-center gap-3 border-b border-stone-100">
                    <button onClick={() => navigate(-1)} className="p-1">
                        <ArrowLeft size={20} className="text-stone-900" />
                    </button>
                    <span className="font-bold text-stone-900 text-sm flex-1">Your Wishlist ({wishlistItems.length})</span>
                </div>

                {/* Items */}
                <div className="flex flex-col gap-4 mt-4">
                    {wishlistItems.map((product) => {
                        return (
                            <div key={product.id} className="px-4 flex gap-3 group relative">
                                
                                {/* Thumbnail Container */}
                                <div className="w-24 h-24 bg-stone-100 rounded-lg relative overflow-hidden flex-shrink-0 border border-stone-200">
                                    <img 
                                        src={product.image} 
                                        alt={product.title} 
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        onClick={() => removeFromWishlist(product.id)}
                                        className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-stone-500 hover:text-red-500 transition-colors"
                                        aria-label={`Remove ${product.title} from wishlist`}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                {/* Details */}
                                <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                                    <div>
                                        <h3 className="text-sm font-bold text-stone-800 leading-tight line-clamp-2">
                                            {product.title}
                                        </h3>
                                        <p className="text-xs text-stone-500 mt-0.5">
                                            {product.artist && `by ${product.artist}`}
                                        </p>
                                        <div className="flex items-center text-[10px] text-stone-500 mt-1.5 bg-stone-100 w-max px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                                            <span className="truncate max-w-[120px]">{product.dims || 'Custom Size'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center">
                                        <button 
                                            onClick={() => customizeProduct(product)}
                                            className="flex-1 bg-stone-900 text-white py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
                                        >
                                            Customize
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WishlistPage;
