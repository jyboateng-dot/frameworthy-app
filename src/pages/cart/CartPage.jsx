import React, { useMemo } from 'react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MapPin, Heart, Trash2, ChevronRight, Minus, Plus, ShoppingBag } from 'lucide-react';
import { generateItemDescription, formatDimensionWithOrientation } from '../../utils/itemFormatters';

import AuthModal from '../../components/AuthModal';
import Price from '../../components/common/Price';

const CartPage = () => {
    const { cartItems, updateQuantity, toggleItemSelection, toggleAllSelection, removeFromCart } = useCart();
    const navigate = useNavigate();
    const { wishlistCount } = useWishlist();
    const { user } = useAuth();
    const [showAuthModal, setShowAuthModal] = React.useState(false);

    const selectedItems = cartItems.filter(item => item.isSelected);
    const selectedCount = selectedItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
    const totalSelectedPrice = selectedItems.reduce((acc, item) => acc + (item.totalPrice * (item.quantity || 1)), 0);


    const allSelected = cartItems.length > 0 && selectedItems.length === cartItems.length;

    const handleCheckout = () => {
        if (selectedCount > 0) {
            if (!user) {
                setShowAuthModal(true);
            } else {
                navigate('/checkout');
            }
        }
    };

    const handleDeleteSelected = () => {
        selectedItems.forEach(item => removeFromCart(item.id));
    };

    if (cartItems.length === 0) {
        return (
            <div className="min-h-screen bg-[#faf9f8] pt-24 pb-12 flex flex-col items-center justify-center">
                <ShoppingBag size={64} className="text-stone-300 mb-4" />
                <h2 className="text-xl font-bold text-stone-800 mb-2">Your cart is empty</h2>
                <button 
                    onClick={() => navigate('/frame/customize')}
                    className="mt-4 px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-bold rounded-full text-sm hover:bg-[#d4b55c] transition"
                >
                    Start Framing
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf9f8] pb-24 font-sans">
            {/* Top Navigation / Header */}
            <div className="bg-white sticky top-[60px] z-40 px-4 py-3 flex items-center justify-between border-b border-stone-100">
                <div className="text-xl font-bold text-stone-900 tracking-tight">
                    Cart ({cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0)})
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/wishlist')} className="relative" aria-label="Wishlist">
                        <Heart size={22} className="text-stone-800 hover:text-[#c9a84c] transition-colors" />
                        {wishlistCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-[#c9a84c] text-[#0a0a0a] text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                {wishlistCount}
                            </span>
                        )}
                    </button>
                    <button onClick={handleDeleteSelected} disabled={selectedCount === 0} className="disabled:opacity-30" aria-label="Delete selected items">
                        <Trash2 size={22} className="text-stone-800 hover:text-[#c9a84c]" />
                    </button>
                </div>
            </div>


            {/* Global Delivery Notice */}
            <div className="px-4 py-3 bg-white flex items-center gap-3 border-b border-stone-100">
                <span className="text-stone-900 text-xs">Shipping fee paid upon delivery</span>
            </div>

            {/* Store Group */}
            <div className="bg-white mb-4 shadow-sm pb-2 pt-2">
                {/* Items */}
                <div className="flex flex-col gap-4">
                    {cartItems.map((item) => {
                        const fullDescription = generateItemDescription(item);
                        
                        const variantText = item.isPreset && item.presetDims
                            ? item.presetDims
                            : item.selectedSize?.label || 'Custom Size';

                        return (
                            <div key={item.id} className="px-4 flex gap-3 group relative">
                                <button
                                    onClick={() => toggleItemSelection(item.id)}
                                    className={`w-5 h-5 mt-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${item.isSelected ? 'bg-[#c9a84c] border-[#c9a84c]' : 'border-stone-300'}`}
                                    aria-label={item.isSelected ? `Deselect ${fullDescription}` : `Select ${fullDescription}`}
                                    aria-pressed={item.isSelected}
                                >
                                    {item.isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </button>
                                
                                {/* Thumbnail Container */}
                                <div className="w-24 h-24 bg-stone-100 rounded-lg relative overflow-hidden flex-shrink-0 border border-stone-200">
                                    <img
                                        src={item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.image}
                                        alt={fullDescription}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Details */}
                                <div className="flex-1 flex flex-col justify-between min-w-0">
                                    <div>
                                        <h3 className="text-sm text-stone-800 leading-normal" title={fullDescription}>
                                            {fullDescription}
                                            <span className="inline-flex items-center text-xs text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 ml-2 align-middle">
                                                <span className="truncate max-w-[160px]">{formatDimensionWithOrientation(variantText, item.orientation)}</span>
                                            </span>
                                        </h3>
                                    </div>

                                    <div className="mt-1 flex items-end justify-between">
                                        <div>
                                            <div className="flex items-baseline gap-1.5">
                                                <Price amount={item.totalPrice || 0} className="font-bold text-stone-900 text-sm" />
                                            </div>

                                        </div>
                                        
                                        {/* Stepper */}
                                        <div className="flex items-center border border-stone-200 rounded-full bg-white h-7">
                                            <button 
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                className="w-7 h-full flex items-center justify-center text-stone-500 hover:text-stone-800"
                                            >
                                                <Minus size={12} strokeWidth={3} />
                                            </button>
                                            <span className="text-xs font-bold w-6 text-center text-stone-800">{item.quantity}</span>
                                            <button 
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="w-7 h-full flex items-center justify-center text-stone-500 hover:text-stone-800"
                                            >
                                                <Plus size={12} strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sticky Footer Checkout Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <button
                    type="button"
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => toggleAllSelection(!allSelected)}
                    aria-pressed={allSelected}
                    aria-label={allSelected ? 'Deselect all items' : 'Select all items'}
                >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${allSelected ? 'bg-[#c9a84c] border-[#c9a84c]' : 'border-stone-300'}`}>
                        {allSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className="text-sm font-bold text-stone-800">All</span>
                </button>

                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <Price amount={totalSelectedPrice} className="text-lg font-bold text-stone-900" />

                    </div>
                    
                    <button 
                        onClick={handleCheckout}
                        disabled={selectedCount === 0}
                        className="bg-[#c9a84c] text-[#0a0a0a] px-5 py-2.5 rounded-full font-bold text-sm flex flex-col items-center disabled:opacity-50 disabled:bg-stone-300 disabled:text-stone-500 transition-colors hover:bg-[#d4b55c]"
                    >
                        <span>Checkout ({selectedCount})</span>

                    </button>
                </div>
            </div>

            {/* Auth/Guest Checkout Modal */}
            <AuthModal 
                isOpen={showAuthModal} 
                onClose={() => setShowAuthModal(false)} 
                returnTo="/checkout"
            />
        </div>
    );
};

export default CartPage;
