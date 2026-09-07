import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { Heart, Trash2, ChevronRight, ArrowLeft } from 'lucide-react';
import { FRAME_STYLES, FRAME_SIZES, parseCustomSize, findSizeByDimension, clampSizeToValidRange } from '../../data/constants';

const WishlistPage = () => {
    const { wishlistItems, removeFromWishlist } = useWishlist();
    const { addToCart } = useCart();
    const navigate = useNavigate();

    // Helper to generate a default cart item from an inspiration product
    const createCartItemFromProduct = (product) => {
        const frameObj = FRAME_STYLES.find(f => f.id === product.frameStyleId) || FRAME_STYLES.find(f => f.id === 'frame-8446');
        const rawSizeObj = parseCustomSize(product.dims) || findSizeByDimension(product.dims) || FRAME_SIZES.find(s => s.id === product.sizeId) || FRAME_SIZES[0];
        // This is a direct add-to-cart, skipping CustomizeFramePage (and its
        // sizeClampNotice banner) entirely — parseCustomSize does no bounds
        // checking, so without this a wishlisted item outside the
        // 13x18-180x180cm production range would reach checkout unclamped.
        // No UI surface here to show a notice, but the clamp itself is not
        // optional: a stale/out-of-range size is a fulfillment problem, not
        // just a missing notification.
        const { size: sizeObj } = clampSizeToValidRange(rawSizeObj);
        
        const isPreset = true;
        const presetTitle = product.title;
        const presetDims = product.dims;
        const isAlbumArt = false;
        const isAlbumPoster = false;
        const isMoviePoster = false;
        
        const matWidth = 'none';
        const matColor = null;

        // Mirrors CustomizeFramePage's pricing formula — matWidth/glassType/
        // hardwareType are fixed to their free defaults above, so the only
        // surcharge that still applies here is the frame's own priceMod.
        const calculatedPrice = Math.round(sizeObj.price * (frameObj.priceMod || 1));

        return {
            id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            isPreset,
            presetTitle,
            presetDims,
            isAlbumArt,
            isAlbumPoster,
            isMoviePoster,
            uploadedImage: product.fullRes || product.image,
            productionImage: product.fullRes || product.image,
            selectedFrame: frameObj,
            selectedSize: sizeObj,
            orientation: sizeObj.orientation || 'portrait',
            matColor,
            matWidth,
            glassType: 'standard',
            hardwareType: 'wire',
            totalPrice: calculatedPrice,
            quantity: 1,
            isSelected: true
        };
    };

    const handleAddToCart = (product) => {
        const cartItem = createCartItemFromProduct(product);
        addToCart(cartItem);
    };

    const handleBuyNow = (product) => {
        const cartItem = createCartItemFromProduct(product);
        addToCart(cartItem);
        navigate('/checkout');
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
                        onClick={() => navigate('/inspiration')}
                        className="px-8 py-3 bg-stone-900 text-white font-bold rounded-full text-sm hover:bg-stone-800 transition"
                    >
                        Browse Inspiration
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

                                    <div className="mt-3 flex items-center gap-2">
                                        <button 
                                            onClick={() => handleAddToCart(product)}
                                            className="flex-1 bg-white border border-stone-200 text-stone-900 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-stone-50 transition-colors"
                                        >
                                            Add to Cart
                                        </button>
                                        <button 
                                            onClick={() => handleBuyNow(product)}
                                            className="flex-1 bg-stone-900 text-white py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
                                        >
                                            Buy Now
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
