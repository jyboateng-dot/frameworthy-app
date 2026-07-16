import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import { httpsCallable } from 'firebase/functions';
import emailjs from '@emailjs/browser';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { createOrder, getUserDeliveryAddresses } from '../../services/db';
import { functions } from '../../services/firebase';
import { MapPin, CreditCard, Ticket, ShieldCheck, Loader, X } from 'lucide-react';
import { generateItemDescription, formatDimensionWithOrientation } from '../../utils/itemFormatters';
import { PROMO_CODES } from '../../data/promoCodes';

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const verifyPaystackPayment = httpsCallable(functions, 'verifyPaystackPayment');

// Best-effort — a failed confirmation email shouldn't block checkout, since
// the order is already paid and verified by this point.
const sendOrderConfirmationEmail = ({ email, orderId, items, total, address, city, phone, promoCode, promoDiscount }) => {
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) return;

    const orderItemsText = items
        .map(item => `${item.quantity || 1}x ${generateItemDescription(item)} (${item.selectedSize?.label || 'Custom Size'}) — GHS ${item.totalPrice.toFixed(2)}`)
        .join('\n')
        + (promoCode ? `\n\nPromo applied: ${promoCode} (- GHS ${promoDiscount.toFixed(2)})` : '');

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        email,
        order_id: orderId,
        order_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        order_items: orderItemsText,
        order_total: `GHS ${total.toFixed(2)}`,
        shipping_address: `${address}\n${city}\n${phone}`,
        to_name: email.split('@')[0]
    }, { publicKey: EMAILJS_PUBLIC_KEY }).catch(err => {
        console.error('Order confirmation email failed to send:', err);
    });
};

const CheckoutPage = () => {
    const navigate = useNavigate();
    const { cartItems, clearCart } = useCart();
    const { user } = useAuth();
    
    // Only checkout items that were selected in the cart
    const checkoutItems = cartItems.filter(item => item.isSelected);
    
    // Redirect if nothing selected
    useEffect(() => {
        if (checkoutItems.length === 0) {
            navigate('/cart');
        }
    }, [checkoutItems, navigate]);

    const subtotal = checkoutItems.reduce((sum, item) => sum + (item.totalPrice * (item.quantity || 1)), 0);

    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [promoError, setPromoError] = useState('');

    const promoDiscount = appliedPromo
        ? appliedPromo.type === 'percent'
            ? subtotal * (appliedPromo.value / 100)
            : Math.min(appliedPromo.value, subtotal)
        : 0;
    const finalTotal = Math.max(0, subtotal - promoDiscount);

    const handleApplyPromo = () => {
        const code = promoInput.trim().toUpperCase();
        if (!code) return;
        const promo = PROMO_CODES[code];
        if (!promo) {
            setPromoError('Invalid promo code');
            return;
        }
        setAppliedPromo({ code, ...promo });
        setPromoInput('');
        setPromoError('');
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoError('');
    };

    // Paystack's own popup collects the actual card/mobile money details —
    // this only picks which channel it opens to, passed via `channels` below.
    const [paymentMethod, setPaymentMethod] = useState('momo');

    const [fullName, setFullName] = useState(user ? user.displayName || '' : '');
    const [email, setEmail] = useState(user ? user.email || '' : '');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [city, setCity] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');

    const [savedAddresses, setSavedAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState('new');
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(false);

    useEffect(() => {
        if (user) {
            setIsFetchingAddresses(true);
            getUserDeliveryAddresses(user.uid).then(addresses => {
                setSavedAddresses(addresses);
                if (addresses.length > 0) {
                    const latest = addresses[0];
                    setSelectedAddressId(latest.id);
                    setFullName(latest.fullName);
                    setPhoneNumber(latest.phoneNumber);
                    setCity(latest.city);
                    setDeliveryAddress(latest.deliveryAddress);
                }
                setIsFetchingAddresses(false);
            }).catch(e => {
                console.error("Failed to load addresses", e);
                setIsFetchingAddresses(false);
            });
        }
    }, [user]);

    const handleAddressSelect = (e) => {
        const val = e.target.value;
        setSelectedAddressId(val);
        if (val === 'new') {
            setFullName(user ? user.displayName || '' : '');
            setPhoneNumber('');
            setCity('');
            setDeliveryAddress('');
        } else {
            const addr = savedAddresses.find(a => a.id === val);
            if (addr) {
                setFullName(addr.fullName);
                setPhoneNumber(addr.phoneNumber);
                setCity(addr.city);
                setDeliveryAddress(addr.deliveryAddress);
            }
        }
    };

    const handleFieldChange = (setter) => (e) => {
        setter(e.target.value);
        if (selectedAddressId !== 'new' && selectedAddressId !== 'custom') {
            setSelectedAddressId('custom');
        }
    };

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    // Base config only needs the public key — the per-checkout reference,
    // email, and amount are supplied as an override at call time (see
    // initializePayment below), since a hook-level config would go stale
    // across multiple submit attempts within the same page render.
    const initializePayment = usePaystackPayment({ publicKey: PAYSTACK_PUBLIC_KEY });

    const handleCheckoutSubmit = (e) => {
        e.preventDefault();

        if (!fullName) {
            setError('Please enter your full name.');
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }
        if (!phoneNumber) {
            setError('Please enter your phone number.');
            return;
        }
        if (!city || !deliveryAddress) {
            setError('Please complete delivery address details.');
            return;
        }

        setIsProcessing(true);
        setError('');

        const orderPayload = {
            userId: user ? user.uid : 'guest',
            userEmail: email,
            customerName: fullName,
            shippingAddress: {
                address: deliveryAddress,
                phone: phoneNumber,
                city: city,
                zip: '00233'
            },
            items: checkoutItems.map(item => ({
                productMode: item.productMode,
                // Flat convenience fields for the compact order-list view
                frame: item.selectedFrame?.name,
                size: item.selectedSize?.label,
                orientation: item.orientation,
                quantity: item.quantity || 1,
                price: item.totalPrice,
                // The raw, full-resolution artwork — this is what actually
                // gets printed, so "Download Print-Ready JPEG" in the admin
                // fulfillment view points here, not at visualizerImage below.
                image: item.productionImage || item.uploadedImage,
                // A fair representation of artwork+mat+frame-color as seen in
                // the visualizer — used as the thumbnail everywhere an order
                // is previewed (cart, checkout, admin list, admin fulfillment
                // view), so what's shown always matches what the customer
                // configured rather than just the bare uploaded photo.
                visualizerImage: item.visualizerImage || null,
                // Full customization detail for production/fulfillment — mirrors
                // the cart item shape so utils like generateItemDescription work
                // unmodified against order items too. Everything here gets
                // physically produced, so nothing from the cart item is dropped.
                selectedFrame: item.selectedFrame || null,
                selectedSize: item.selectedSize || null,
                matColor: item.matColor || null,
                matWidth: item.matWidth || 'none',
                glassType: item.glassType || null,
                hardwareType: item.hardwareType || null,
                frameThickness: item.frameThickness || null,
                activeLayout: item.activeLayout || null,
                collageImages: (item.collageImages && item.collageImages.length > 0) ? item.collageImages : null,
                isPreset: !!item.isPreset,
                presetTitle: item.presetTitle || null,
                presetDims: item.presetDims || null,
                isAlbumArt: !!item.isAlbumArt,
                isAlbumPoster: !!item.isAlbumPoster,
                isMoviePoster: !!item.isMoviePoster,
                isMoviePosterPrint: !!item.isMoviePosterPrint,
                posterMeta: item.posterMeta || null
            })),
            totalPrice: finalTotal,
            currency: 'GHS',
            promoCode: appliedPromo?.code || null,
            promoDiscount: appliedPromo ? promoDiscount : 0,
            paymentMethodDetails: { type: paymentMethod },
            // Orders always start pending — only the verifyPaystackPayment
            // Cloud Function (after checking with Paystack server-side) is
            // allowed to flip this to 'paid'; enforced in firestore.rules too.
            paymentStatus: 'pending'
        };

        (async () => {
            let orderId;
            try {
                const created = await createOrder(orderPayload);
                orderId = created.id;
            } catch (err) {
                console.error('Order creation failed:', err);
                setError('We had trouble starting your order. Please try again.');
                setIsProcessing(false);
                return;
            }

            const reference = `FW_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            initializePayment({
                config: {
                    reference,
                    email,
                    amount: Math.round(finalTotal * 100), // GHS -> pesewas
                    currency: 'GHS',
                    // Paystack's own popup collects the actual payment
                    // details — this just biases which channel it opens to
                    // based on the toggle above, instead of separately
                    // (and redundantly) collecting card/MoMo details on-page.
                    channels: paymentMethod === 'momo' ? ['mobile_money'] : ['card']
                },
                onSuccess: async () => {
                    try {
                        const result = await verifyPaystackPayment({ reference, orderId });
                        if (result.data?.success) {
                            sendOrderConfirmationEmail({
                                email,
                                orderId,
                                items: checkoutItems,
                                total: finalTotal,
                                address: deliveryAddress,
                                city,
                                phone: phoneNumber,
                                promoCode: appliedPromo?.code || null,
                                promoDiscount: appliedPromo ? promoDiscount : 0
                            });
                            clearCart();
                            navigate('/success');
                        } else {
                            setError('Payment could not be verified. Please contact support with reference ' + reference);
                            setIsProcessing(false);
                        }
                    } catch (err) {
                        console.error('Payment verification failed:', err);
                        setError('Payment could not be verified. Please contact support with reference ' + reference);
                        setIsProcessing(false);
                    }
                },
                onClose: () => {
                    setError('Payment was cancelled.');
                    setIsProcessing(false);
                }
            });
        })();
    };

    if (checkoutItems.length === 0) return null;

    return (
        <div className="min-h-screen bg-[#f5f5f5] pb-24 font-sans text-stone-900">
            {/* Header */}
            <div className="bg-white sticky top-0 z-40 px-4 py-3 flex items-center gap-4 border-b border-stone-100 shadow-sm">
                <div className="text-xl font-bold text-stone-900">Order confirmation</div>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="max-w-2xl mx-auto pt-3 px-3 space-y-3">
                
                {/* Shipping Address */}
                <div className="bg-white rounded-xl overflow-hidden shadow-sm relative">
                    <div className="p-4">
                        <div className="flex items-start gap-3">
                            <MapPin size={20} className="text-stone-800 mt-1 flex-shrink-0" />
                            <div className="flex-1 space-y-2.5">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-sm text-stone-900">Delivery Details</h3>
                                        {isFetchingAddresses ? (
                                            <Loader size={14} className="animate-spin text-stone-400" />
                                        ) : savedAddresses.length > 0 ? (
                                            <select 
                                                value={selectedAddressId} 
                                                onChange={handleAddressSelect}
                                                className="text-xs border border-stone-200 rounded px-2 py-1 bg-stone-50 text-stone-700 outline-none focus:border-stone-400 max-w-[150px] truncate"
                                            >
                                                {savedAddresses.map((addr, idx) => (
                                                    <option key={addr.id} value={addr.id}>
                                                        {idx === 0 ? 'Latest Address' : `Previous Address ${idx}`} ({addr.city})
                                                    </option>
                                                ))}
                                                {selectedAddressId === 'custom' && <option value="custom">Custom Address (Unsaved)</option>}
                                                <option value="new">+ Enter new address</option>
                                            </select>
                                        ) : null}
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Full Name"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent mb-2"
                                        value={fullName}
                                        onChange={handleFieldChange(setFullName)}
                                    />
                                    <input
                                        type="tel"
                                        required
                                        placeholder="Phone Number (e.g. 024 000 0000)"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent mb-2"
                                        value={phoneNumber}
                                        onChange={handleFieldChange(setPhoneNumber)}
                                    />
                                    <input
                                        type="email"
                                        required
                                        placeholder="Email Address"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        required
                                        placeholder="City (e.g. Accra)"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent"
                                        value={city}
                                        onChange={handleFieldChange(setCity)}
                                    />
                                </div>
                                <div>
                                    <textarea
                                        required
                                        placeholder="Delivery Address / Landmark"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent resize-none"
                                        rows="2"
                                        value={deliveryAddress}
                                        onChange={handleFieldChange(setDeliveryAddress)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* AliExpress-style Envelope Border */}
                    <div className="h-1 w-full" style={{ background: 'repeating-linear-gradient(45deg, #e41e31, #e41e31 10px, transparent 10px, transparent 20px, #1877f2 20px, #1877f2 30px, transparent 30px, transparent 40px)' }}></div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-sm text-stone-900 mb-3">Payment Method</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setPaymentMethod('momo')} className={`py-2 rounded border text-sm font-bold flex items-center justify-center gap-2 ${paymentMethod === 'momo' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'}`}>
                            Mobile Money
                        </button>
                        <button type="button" onClick={() => setPaymentMethod('card')} className={`py-2 rounded border text-sm font-bold flex items-center justify-center gap-2 ${paymentMethod === 'card' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'}`}>
                            <CreditCard size={16} /> Card
                        </button>
                    </div>
                    <p className="text-xs text-stone-400 mt-3">
                        You'll enter your {paymentMethod === 'momo' ? 'Mobile Money' : 'card'} details securely on the next step.
                    </p>
                </div>

                {/* Items Container */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 space-y-4">
                        <h3 className="font-bold text-sm text-stone-900 -mb-1">
                            {checkoutItems.length === 1 ? 'Review Order' : 'Review Orders'}
                        </h3>
                        {checkoutItems.map((item, index) => {
                            const fullDescription = generateItemDescription(item);
                            
                            const variantText = item.isPreset && item.presetDims ? item.presetDims : item.selectedSize?.label || 'Custom Size';
                            
                            return (
                                <div key={`${item.id}-${index}`} className="flex gap-3">
                                    <div className="w-16 h-16 bg-stone-100 rounded border border-stone-200 overflow-hidden flex-shrink-0">
                                        <img src={item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage} alt={fullDescription} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm text-stone-800 leading-normal" title={fullDescription}>
                                            {fullDescription}
                                            <span className="inline-flex items-center text-xs text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 ml-2 align-middle">
                                                {formatDimensionWithOrientation(variantText, item.orientation)}
                                            </span>
                                        </h3>
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="font-bold text-sm text-stone-900">GHS {item.totalPrice.toFixed(2)}</span>
                                            <span className="text-sm text-stone-500">x{item.quantity || 1}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Promo Code */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Ticket size={18} className="text-[#c9a84c]" />
                        <span className="font-bold text-sm">Promo code</span>
                    </div>
                    {appliedPromo ? (
                        <div className="flex items-center justify-between bg-[#c9a84c]/10 rounded-lg px-3 py-2">
                            <div>
                                <span className="font-bold text-sm text-[#8a6d1f]">{appliedPromo.code}</span>
                                <span className="text-xs text-stone-500 ml-2">{appliedPromo.description}</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleRemovePromo}
                                className="text-stone-400 hover:text-red-500 transition"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={promoInput}
                                onChange={(e) => { setPromoInput(e.target.value); setPromoError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(); } }}
                                placeholder="Enter code here"
                                className="flex-1 border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent uppercase placeholder:normal-case"
                            />
                            <button
                                type="button"
                                onClick={handleApplyPromo}
                                className="text-xs font-bold text-[#c9a84c] hover:text-[#a3853c] uppercase tracking-wide transition shrink-0"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                    {promoError && <p className="text-xs text-red-500 mt-1.5">{promoError}</p>}
                </div>

                {/* Summary */}
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-stone-600">
                        <span>Subtotal</span>
                        <span>GHS {subtotal.toFixed(2)}</span>
                    </div>
                    {appliedPromo && (
                        <div className="flex justify-between text-stone-600">
                            <span>Promo ({appliedPromo.code})</span>
                            <span className="text-[#c9a84c]">- GHS {promoDiscount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-stone-900 pt-2 border-t border-stone-100 mt-2">
                        <span>Total</span>
                        <span>GHS {finalTotal.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-stone-400 pt-1">Delivery fee not included — paid to the courier on delivery.</p>
                </div>

                {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm text-center font-bold">{error}</div>}

                {/* Spacer for sticky footer */}
                <div className="h-4"></div>

                {/* Sticky Footer */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col">
                        <div className="text-[10px] text-stone-500 flex items-center gap-1 mb-0.5">
                            <ShieldCheck size={12} className="text-green-600" />
                            Secured by Paystack
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xs font-bold text-stone-800">Total: GHS</span>
                            <span className="text-xl font-bold text-[#c9a84c] leading-none">{finalTotal.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={isProcessing}
                        className="bg-[#c9a84c] text-[#0a0a0a] px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-[#c9a84c]/20 hover:bg-[#d4b55c]"
                    >
                        {isProcessing ? <Loader size={16} className="animate-spin" /> : null}
                        {isProcessing ? 'Processing...' : 'Pay now'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CheckoutPage;
