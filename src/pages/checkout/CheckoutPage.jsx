import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import { httpsCallable } from 'firebase/functions';
import emailjs from '@emailjs/browser';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { createOrder, getUserDeliveryAddresses } from '../../services/db';
import { functions } from '../../services/firebase';
import { MapPin, CreditCard, Ticket, ShieldCheck, Loader, X, Smartphone, Copy, Check } from 'lucide-react';
import { generateItemDescription, formatDimensionWithOrientation } from '../../utils/itemFormatters';
import { calculateSubtotal, resolvePromoCode, calculatePromoDiscount, calculateFinalTotal } from '../../utils/pricing';
import Price from '../../components/common/Price';

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
    const { cartItems, removeItems } = useCart();
    const { user } = useAuth();
    
    // Only checkout items that were selected in the cart
    const checkoutItems = cartItems.filter(item => item.isSelected);
    
    // Redirect if nothing selected
    useEffect(() => {
        if (checkoutItems.length === 0) {
            navigate('/cart');
        }
    }, [checkoutItems, navigate]);

    const subtotal = calculateSubtotal(checkoutItems);

    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [promoError, setPromoError] = useState('');

    const promoDiscount = calculatePromoDiscount(subtotal, appliedPromo);
    const finalTotal = calculateFinalTotal(subtotal, promoDiscount);

    const handleApplyPromo = () => {
        if (!promoInput.trim()) return;
        const promo = resolvePromoCode(promoInput);
        if (!promo) {
            setPromoError('Invalid promo code');
            return;
        }
        setAppliedPromo(promo);
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
        if (!user) return;
        // Without the `cancelled` guard, a slow fetch for a user who signs
        // out mid-request (and is replaced by a different signed-in user on
        // this same mounted page) can resolve AFTER the new user's own
        // fetch and overwrite the form with the PREVIOUS user's saved
        // name/phone/city/address right as the new user is about to place
        // an order under their own account.
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- standard "flip on loading before the fetch starts" idiom
        setIsFetchingAddresses(true);
        getUserDeliveryAddresses(user.uid).then(addresses => {
            if (cancelled) return;
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
            if (cancelled) return;
            console.error("Failed to load addresses", e);
            setIsFetchingAddresses(false);
        });
        return () => { cancelled = true; };
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
    // Deliberately closing the Paystack popup isn't a failure — it gets a
    // neutral notice rather than the red error treatment used for real
    // problems, so cancelling doesn't read as "something went wrong".
    const [notice, setNotice] = useState('');
    // Set only when money may have left the customer's account but we
    // couldn't confirm it. Held separately from `error` so the reference can
    // be rendered as copyable text rather than buried in a sentence.
    const [failedReference, setFailedReference] = useState('');
    const [referenceCopied, setReferenceCopied] = useState(false);
    // Tracks the still-pending order from the last submit attempt so that
    // cancelling the Paystack popup and immediately retrying (a common
    // pattern — open MoMo, back out, try card instead) reuses that same
    // order instead of creating a new abandoned one each time. Only reused
    // when the cart selection and promo are unchanged from when it was
    // created; a ref (not state) since it shouldn't itself trigger a render.
    const pendingOrderRef = useRef(null);

    const handleCopyReference = async () => {
        try {
            await navigator.clipboard.writeText(failedReference);
            setReferenceCopied(true);
            setTimeout(() => setReferenceCopied(false), 2000);
        } catch {
            // Clipboard can be unavailable (insecure context, permissions) —
            // the reference is still displayed for manual selection.
        }
    };

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
        setNotice('');
        setFailedReference('');

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

        // Everything actually baked into the order doc at creation time —
        // items, promo, and contact/shipping details — has to be unchanged
        // for reuse to be safe. Items/promo matter because verification
        // recomputes price from the order's own stored data, not from what
        // Paystack was told to charge. Contact/shipping matter because the
        // client can never update an existing order afterward (firestore
        // rules only allow admin updates) — reusing an order after editing
        // the delivery address would ship to the stale one with no way to
        // correct it.
        const attemptKey = [
            checkoutItems.map(i => i.id).sort().join(','),
            appliedPromo?.code || '',
            email, phoneNumber, city, deliveryAddress, fullName
        ].join('|');

        (async () => {
            let orderId;
            try {
                if (pendingOrderRef.current && pendingOrderRef.current.key === attemptKey) {
                    orderId = pendingOrderRef.current.orderId;
                } else {
                    const created = await createOrder(orderPayload);
                    orderId = created.id;
                    pendingOrderRef.current = { orderId, key: attemptKey };
                }
            } catch (err) {
                console.error('Order creation failed:', err);
                setError('We had trouble starting your order. Please try again.');
                setIsProcessing(false);
                return;
            }

            const reference = `FW_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            // Paystack takes `firstname`/`lastname` separately, so split the
            // single name field we collect. Anything after the first token is
            // the surname ("Kwame Nkrumah Jr" -> "Kwame" / "Nkrumah Jr").
            const [firstname, ...restOfName] = fullName.trim().split(/\s+/);
            const lastname = restOfName.join(' ');

            const itemCount = checkoutItems.reduce((n, item) => n + (item.quantity || 1), 0);

            initializePayment({
                config: {
                    reference,
                    email,
                    amount: Math.round(finalTotal * 100), // GHS -> pesewas
                    currency: 'GHS',
                    // Prefills inside Paystack's popup. `phone` matters most:
                    // mobile money is the default method, and without this the
                    // customer has to retype the number they just entered above.
                    firstname: firstname || undefined,
                    lastname: lastname || undefined,
                    phone: phoneNumber ? phoneNumber.trim() : undefined,
                    // Shown under the merchant name in the popup — without it
                    // the customer just sees their email echoed back.
                    label: `FrameWorthy · ${itemCount} item${itemCount === 1 ? '' : 's'}`,
                    // Surfaces on the Paystack dashboard and receipts. The
                    // reference alone is opaque during a support query or
                    // payment dispute; this makes a transaction traceable back
                    // to an order without cross-referencing Firestore.
                    metadata: {
                        orderId,
                        custom_fields: [
                            { display_name: 'Order ID', variable_name: 'order_id', value: orderId },
                            { display_name: 'Customer', variable_name: 'customer_name', value: fullName },
                            { display_name: 'Delivery', variable_name: 'delivery', value: `${deliveryAddress}, ${city}` },
                            { display_name: 'Items', variable_name: 'item_count', value: String(itemCount) }
                        ]
                    },
                    // Both channels are offered regardless of the toggle, with
                    // the selected one first. Passing only one meant a customer
                    // who opened MoMo but wanted to pay by card had to close the
                    // popup (cancelling the attempt), flip the toggle and start
                    // over; now they can just switch inside Paystack's own UI.
                    channels: paymentMethod === 'momo' ? ['mobile_money', 'card'] : ['card', 'mobile_money']
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
                            // Only the items just paid for — anything the
                            // customer deselected stays in the cart.
                            removeItems(checkoutItems.map(item => item.id));
                            // Carry the order reference through so the success
                            // page can show it. This is the only record a
                            // guest ever gets: guest orders use userId 'guest',
                            // so they can't be listed on /orders and aren't
                            // readable back under firestore.rules.
                            navigate('/success', {
                                state: { orderId, reference, email, total: finalTotal, isGuest: !user }
                            });
                        } else {
                            // Paystack also confirms successful charges directly to our
                            // server independently of this call (see paystackWebhook), so
                            // a charge that actually succeeded will still get marked paid
                            // even though this particular confirmation attempt failed —
                            // don't encourage paying a second time for the same order.
                            setError('We couldn\'t confirm your payment right away. If you were charged, your order will be confirmed automatically within a few minutes — check its status with the reference below. Please don\'t pay again for this order.');
                            setFailedReference(reference);
                            setIsProcessing(false);
                        }
                    } catch (err) {
                        console.error('Payment verification failed:', err);
                        setError('We couldn\'t confirm your payment right away. If you were charged, your order will be confirmed automatically within a few minutes — check its status with the reference below. Please don\'t pay again for this order.');
                        setFailedReference(reference);
                        setIsProcessing(false);
                    }
                },
                onClose: () => {
                    setNotice('Payment cancelled — your order is saved, you can pay whenever you\'re ready.');
                    setIsProcessing(false);
                }
            });
        })();
    };

    if (checkoutItems.length === 0) return null;

    return (
        <div className="min-h-screen bg-[#faf9f8] pb-24 font-sans text-stone-900">
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
                                    <label htmlFor="checkout-fullname" className="sr-only">Full Name</label>
                                    <input
                                        id="checkout-fullname"
                                        type="text"
                                        required
                                        placeholder="Full Name"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent mb-2"
                                        value={fullName}
                                        onChange={handleFieldChange(setFullName)}
                                    />
                                    <label htmlFor="checkout-phone" className="sr-only">Phone Number</label>
                                    <input
                                        id="checkout-phone"
                                        type="tel"
                                        required
                                        placeholder="Phone Number (e.g. 024 000 0000)"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent mb-2"
                                        value={phoneNumber}
                                        onChange={handleFieldChange(setPhoneNumber)}
                                    />
                                    <label htmlFor="checkout-email" className="sr-only">Email Address</label>
                                    <input
                                        id="checkout-email"
                                        type="email"
                                        required
                                        placeholder="Email Address"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="checkout-city" className="sr-only">City</label>
                                    <input
                                        id="checkout-city"
                                        type="text"
                                        required
                                        placeholder="City (e.g. Accra)"
                                        className="w-full border-b border-stone-200 py-1.5 text-base focus:outline-none focus:border-stone-500 bg-transparent"
                                        value={city}
                                        onChange={handleFieldChange(setCity)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="checkout-address" className="sr-only">Delivery Address / Landmark</label>
                                    <textarea
                                        id="checkout-address"
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
                            <Smartphone size={16} /> Mobile Money
                        </button>
                        <button type="button" onClick={() => setPaymentMethod('card')} className={`py-2 rounded border text-sm font-bold flex items-center justify-center gap-2 ${paymentMethod === 'card' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'}`}>
                            <CreditCard size={16} /> Card
                        </button>
                    </div>
                    <p className="text-xs text-stone-400 mt-3">
                        You'll enter your {paymentMethod === 'momo' ? 'Mobile Money' : 'card'} details securely on the next step — you can still switch there if you change your mind.
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
                                            <Price amount={item.totalPrice} className="font-bold text-sm text-stone-900" />
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
                                aria-label="Remove promo code"
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
                        <Price amount={subtotal} />
                    </div>
                    {appliedPromo && (
                        <div className="flex justify-between text-stone-600">
                            <span>Promo ({appliedPromo.code})</span>
                            <Price amount={promoDiscount} prefix="- " className="text-[#c9a84c]" />
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-stone-900 pt-2 border-t border-stone-100 mt-2">
                        <span>Total</span>
                        <Price amount={finalTotal} />
                    </div>
                    <p className="text-xs text-stone-400 pt-1">Shipping fee paid upon delivery.</p>
                </div>

                {notice && (
                    <div className="bg-stone-100 text-stone-600 p-3 rounded-xl text-sm text-center flex items-center justify-center gap-2">
                        <span>{notice}</span>
                        <button
                            type="button"
                            onClick={() => setNotice('')}
                            className="text-stone-400 hover:text-stone-700 transition shrink-0"
                            aria-label="Dismiss"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm text-center font-bold">
                        <p>{error}</p>
                        {failedReference && (
                            <div className="mt-2 flex items-center justify-center gap-2">
                                <code className="bg-white/70 px-2 py-1 rounded font-mono text-xs text-red-700 select-all break-all">
                                    {failedReference}
                                </code>
                                <button
                                    type="button"
                                    onClick={handleCopyReference}
                                    className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 transition shrink-0"
                                >
                                    {referenceCopied ? <Check size={14} /> : <Copy size={14} />}
                                    {referenceCopied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

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
                            <span className="text-xs font-bold text-stone-800">Total:</span>
                            <Price amount={finalTotal} className="text-xl font-bold text-[#c9a84c]" />
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
