import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { httpsCallable } from 'firebase/functions';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { createOrder, getUserDeliveryAddresses } from '../../services/db';
import { functions } from '../../services/firebase';
import { Ticket, ShieldCheck, Loader, X, Copy, Check } from 'lucide-react';
import { getItemTitle, getItemSubtitle, generateItemDescription, formatDimensionWithOrientation, getItemCustomizerSpecs } from '../../utils/itemFormatters';
import { useUnit } from '../../context/UnitContext';
import {
    calculateSubtotal,
    resolvePromoCode,
    calculatePromoDiscount,
    calculateFinalTotal,
    computeOrderCostBreakdown,
} from '../../utils/pricing';
import Price from '../../components/common/Price';
import { getThumbnailUrl } from '../../services/storage';
import DeliveryAddressSection from '../../components/checkout/DeliveryAddressSection';
import { quoteCheckoutDestination } from '../../services/checkoutDelivery';
import { isGbJerseyCountry, isValidDeliveryPostalCode, normalizePostalCode } from '../../utils/deliveryAddress';

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;
const verifyPaystackPayment = httpsCallable(functions, 'verifyPaystackPayment');
const createPayPalOrder = httpsCallable(functions, 'createPayPalOrder');
const capturePayPalOrder = httpsCallable(functions, 'capturePayPalOrder');

const CheckoutPage = () => {
    const navigate = useNavigate();
    const { cartItems, removeItems, updateDeliveryQuotes } = useCart();
    const { user } = useAuth();
    const { unit } = useUnit();
    
    // Only checkout items that were selected in the cart
    const checkoutItems = useMemo(() => cartItems.filter(item => item.isSelected), [cartItems]);
    const prodigiDestinations = [...new Set(checkoutItems.map(item => item.prodigi?.destinationCountryCode).filter(Boolean))];
    const hasProdigiItems = prodigiDestinations.length > 0;
    const prodigiDestination = prodigiDestinations[0] || 'GH';
    const checkoutCurrencies = [...new Set(checkoutItems.map(item => item.currency || 'GHS'))];
    const checkoutCurrency = checkoutCurrencies[0] || 'GHS';
    const hasMixedCurrencies = checkoutCurrencies.length > 1;
    const isGbpProdigiCheckout = hasProdigiItems && checkoutCurrency === 'GBP';
    // Payment completion clears the selected cart items before the success
    // route mounts. Keep the empty-checkout redirect from racing that
    // transition and sending a paid customer back to /cart.
    const paymentCompletedRef = useRef(false);
    
    // Redirect if nothing selected
    useEffect(() => {
        if (checkoutItems.length === 0 && !paymentCompletedRef.current) {
            navigate('/cart');
        }
    }, [checkoutItems, navigate]);

    const subtotal = calculateSubtotal(checkoutItems);
    const costBreakdown = useMemo(() => {
        return computeOrderCostBreakdown(checkoutItems, checkoutCurrency);
    }, [checkoutItems, checkoutCurrency]);

    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [promoError, setPromoError] = useState('');

    const promoDiscount = checkoutCurrency === 'GHS' ? calculatePromoDiscount(subtotal, appliedPromo) : 0;
    const finalTotal = isGbpProdigiCheckout || costBreakdown.hasItemizedQuote
        ? Math.max(0, (costBreakdown.totalCost ?? (costBreakdown.itemsSubtotal + costBreakdown.deliveryCost + costBreakdown.taxCost)) - promoDiscount)
        : calculateFinalTotal(subtotal, promoDiscount);

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
    const [paymentMethod] = useState('momo');

    const [fullName, setFullName] = useState(user ? user.displayName || '' : '');
    const [email, setEmail] = useState(user ? user.email || '' : '');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [city, setCity] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [stateOrCounty, setStateOrCounty] = useState('');
    const [postalOrZipCode, setPostalOrZipCode] = useState('');

    const [isUpdatingCountry, setIsUpdatingCountry] = useState(false);
    const [countryError, setCountryError] = useState('');
    const destinationRequest = useRef(0);
    const currentItemsRef = useRef(checkoutItems);
    currentItemsRef.current = checkoutItems;

    const [savedAddresses, setSavedAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState('new');
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(false);
    const deliveryEditedRef = useRef(false);

    useEffect(() => {
        if (!user) return;
        setEmail(current => current || user.email || '');
        setFullName(current => current || user.displayName || '');
    }, [user]);

    useEffect(() => {
        if (!user) return;
        // Without the `cancelled` guard, a slow fetch for a user who signs
        // out mid-request (and is replaced by a different signed-in user on
        // this same mounted page) can resolve AFTER the new user's own
        // fetch and overwrite the form with the PREVIOUS user's saved
        // name/phone/city/address right as the new user is about to place
        // an order under their own account.
        let cancelled = false;
        setIsFetchingAddresses(true);
        getUserDeliveryAddresses(user.uid).then(addresses => {
            if (cancelled) return;
            const matchingAddresses = addresses.filter(address => address.countryCode === prodigiDestination
                || (!address.countryCode && isValidDeliveryPostalCode(prodigiDestination, address.postalOrZipCode || address.zip || '')));
            setSavedAddresses(matchingAddresses);
            if (matchingAddresses.length > 0 && !deliveryEditedRef.current) {
                const latest = matchingAddresses[0];
                setSelectedAddressId(latest.id);
                setFullName(latest.fullName);
                setPhoneNumber(latest.phoneNumber);
                setCity(latest.city);
                setDeliveryAddress(latest.deliveryAddress);
                setAddressLine2(latest.addressLine2 || '');
                setStateOrCounty(latest.stateOrCounty || '');
                setPostalOrZipCode(latest.postalOrZipCode || latest.zip || '');
            }
            setIsFetchingAddresses(false);
        }).catch(e => {
            if (cancelled) return;
            console.error("Failed to load addresses", e);
            setIsFetchingAddresses(false);
        });
        return () => { cancelled = true; };
    }, [user, prodigiDestination]);

    const handleAddressSelect = (e) => {
        setPaypalCheckout(null);
        const val = e.target.value;
        setSelectedAddressId(val);
        if (val === 'new') {
            setCity('');
            setDeliveryAddress('');
            setAddressLine2('');
            setStateOrCounty('');
            setPostalOrZipCode('');
        } else {
            const addr = savedAddresses.find(a => a.id === val);
            if (addr) {
                setFullName(addr.fullName);
                setPhoneNumber(addr.phoneNumber);
                setCity(addr.city);
                setDeliveryAddress(addr.deliveryAddress);
                setAddressLine2(addr.addressLine2 || '');
                setStateOrCounty(addr.stateOrCounty || '');
                setPostalOrZipCode(addr.postalOrZipCode || addr.zip || '');
            }
        }
    };

    const handleFieldChange = (setter) => (e) => {
        deliveryEditedRef.current = true;
        setPaypalCheckout(null);
        setter(e.target.value);
        if (selectedAddressId !== 'new' && selectedAddressId !== 'custom') {
            setSelectedAddressId('custom');
        }
    };

    const updateDeliveryAddress = (updates) => {
        deliveryEditedRef.current = true;
        setPaypalCheckout(null);
        const setters = { line1: setDeliveryAddress, line2: setAddressLine2, city: setCity, stateOrCounty: setStateOrCounty, postalOrZipCode: setPostalOrZipCode };
        Object.entries(updates).forEach(([key, value]) => setters[key]?.(value));
        setSelectedAddressId('custom');
    };

    const changeDeliveryCountry = async (countryCode) => {
        if (countryCode === prodigiDestination && prodigiDestinations.length === 1) return;
        const request = ++destinationRequest.current;
        const snapshot = JSON.stringify(checkoutItems);
        setIsUpdatingCountry(true);
        setPaypalCheckout(null);
        setCountryError('');
        try {
            const updates = await quoteCheckoutDestination(checkoutItems, countryCode);
            if (request !== destinationRequest.current) return;
            if (JSON.stringify(currentItemsRef.current) !== snapshot) throw new Error('Your cart changed while updating delivery. Please choose the country again.');
            updateDeliveryQuotes(updates);
            deliveryEditedRef.current = false;
            setDeliveryAddress('');
            setAddressLine2('');
            setCity('');
            setStateOrCounty('');
            setPostalOrZipCode('');
            setSelectedAddressId('new');
            setSavedAddresses([]);
        } catch {
            if (request === destinationRequest.current) setCountryError('We could not update delivery for every item. Your current country and prices are unchanged. Please try again or review your cart.');
        } finally {
            if (request === destinationRequest.current) setIsUpdatingCountry(false);
        }
    };

    const [isProcessing, setIsProcessing] = useState(false);
    const [paypalCheckout, setPaypalCheckout] = useState(null);
    const paypalCheckoutRef = useRef(null);
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

    // Paystack is shelved. Its historical server-side verification remains
    // deployed solely for existing pending records, but it is no longer
    // imported or reachable through the customer checkout.
    const initializePayment = () => {};

    const handleCheckoutSubmit = (e) => {
        e.preventDefault();

        if (isUpdatingCountry) return;
        if (checkoutCurrency !== 'GBP') {
            setError('This order needs a current GBP product quote before it can be paid for.');
            return;
        }
        if (checkoutCurrency === 'GBP' && !PAYPAL_CLIENT_ID) {
            setError('Online payment is being set up. Your configured items remain saved in the cart.');
            return;
        }
        if (hasMixedCurrencies) {
            setError('GBP and GHS items must be checked out separately.');
            return;
        }

        if (!fullName.trim()) {
            setError('Please enter your full name.');
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }
        // Loose on purpose — real numbers show up as "024 000 0000",
        // "+233 24 000 0000", or "233240000000" depending on how someone
        // types it. Checking digit count rather than an exact format
        // catches the "abc"/"12"/empty cases without rejecting a real
        // number just for its punctuation or an optional country code.
        const phoneDigits = phoneNumber.replace(/\D/g, '');
        if (phoneDigits.length < 9 || phoneDigits.length > 13) {
            setError('Please enter a valid phone number.');
            return;
        }
        if (!city.trim() || !deliveryAddress.trim()) {
            setError('Please complete delivery address details.');
            return;
        }
        if (prodigiDestinations.length > 1) {
            setError('Items shipping to different countries must be checked out separately.');
            return;
        }
        const normalizedPostalCode = normalizePostalCode(postalOrZipCode);
        if (hasProdigiItems && !isValidDeliveryPostalCode(prodigiDestination, normalizedPostalCode)) {
            setError(isGbJerseyCountry(prodigiDestination)
                ? 'Please enter a valid UK or Jersey postcode, for example SW1A 1AA.'
                : 'Please enter the postal code required for delivery.');
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
                line2: addressLine2,
                phone: phoneNumber,
                city: city,
                stateOrCounty,
                zip: normalizedPostalCode || '00233',
                postalOrZipCode: normalizedPostalCode || '00233',
                countryCode: prodigiDestination,
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
                productionImage: item.productionImage || null,
                productionSpec: item.productionSpec || null,
                printQuality: item.printQuality || null,
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
                posterMeta: item.posterMeta || null,
                prodigi: item.prodigi || null
            })),
            totalPrice: finalTotal,
            currency: checkoutCurrency,
            promoCode: appliedPromo?.code || null,
            promoDiscount: appliedPromo ? promoDiscount : 0,
            paymentMethodDetails: { type: checkoutCurrency === 'GBP' ? 'paypal' : paymentMethod },
            // Orders always start pending. A server-side payment verification
            // function is the only path allowed to flip this to paid.
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
            email, phoneNumber, city, deliveryAddress, addressLine2, stateOrCounty, normalizedPostalCode, prodigiDestination, fullName
        ].join('|');

        return (async () => {
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

            if (checkoutCurrency === 'GBP') {
                paypalCheckoutRef.current = { orderId, attemptKey };
                setPaypalCheckout({ orderId, attemptKey });
                setIsProcessing(false);
                setNotice('Your details are saved. Continue securely with PayPal below.');
                return { orderId, attemptKey };
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
                            { display_name: 'Delivery', variable_name: 'delivery', value: [deliveryAddress, addressLine2, city, stateOrCounty, normalizedPostalCode].filter(Boolean).join(', ') },
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
                            // Only the items just paid for — anything the
                            // customer deselected stays in the cart.
                            paymentCompletedRef.current = true;
                            removeItems(checkoutItems.map(item => item.id));
                            // Carry the order reference through so the success
                            // page can show it. This is the only record a
                            // guest ever gets: guest orders use userId 'guest',
                            // so they can't be listed on /orders and aren't
                            // readable back under firestore.rules.
                            navigate('/success', {
                                state: { orderId, reference, email, total: finalTotal, currency: checkoutCurrency, isGuest: !user }
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

    const finishPayPalCheckout = async (paypalOrderId) => {
        if (!paypalCheckout?.orderId) throw new Error('Your checkout session has expired. Please try again.');
        setIsProcessing(true);
        setError('');
        try {
            const result = await capturePayPalOrder({ orderId: paypalCheckout.orderId, paypalOrderId });
            if (!result.data?.success) throw new Error('PayPal could not confirm the payment.');
            paymentCompletedRef.current = true;
            removeItems(checkoutItems.map(item => item.id));
            navigate('/success', {
                state: { orderId: paypalCheckout.orderId, reference: paypalOrderId, email, total: finalTotal, currency: checkoutCurrency, isGuest: !user },
            });
        } catch (err) {
            console.error('PayPal payment capture failed:', err);
            setError(err.message || 'We could not confirm your PayPal payment. Please try again.');
            setIsProcessing(false);
            throw err;
        }
    };

    if (checkoutItems.length === 0) return null;

    return (
        <div className="min-h-screen bg-[#faf9f8] pb-24 font-sans text-stone-900">
            {/* Header */}
            <div className="bg-white sticky top-0 z-40 px-4 py-3 flex items-center gap-4 border-b border-stone-100 shadow-sm">
                <h1 className="text-xl font-serif font-bold text-stone-900">Checkout</h1>
                <button type="button" onClick={() => navigate('/cart')} className="ml-auto text-sm text-stone-600 underline underline-offset-4">Back to cart</button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="max-w-2xl mx-auto pt-3 px-3 space-y-3">
                
                <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby="contact-heading">
                    <h2 id="contact-heading" className="mb-4 text-sm font-bold">Contact</h2>
                    <div className="space-y-3">
                        <label className="block text-xs font-medium text-stone-700">Email
                            <input id="checkout-email" name="email" type="email" autoComplete="email" required value={email} onChange={event => { setPaypalCheckout(null); setEmail(event.target.value); }} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#c9a84c]" />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-medium text-stone-700">Full name
                                <input id="checkout-fullname" name="name" autoComplete="shipping name" required value={fullName} onChange={handleFieldChange(setFullName)} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#c9a84c]" />
                            </label>
                            <label className="block text-xs font-medium text-stone-700">Phone number
                                <input id="checkout-phone" name="tel" type="tel" autoComplete="shipping tel" required value={phoneNumber} onChange={handleFieldChange(setPhoneNumber)} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#c9a84c]" />
                            </label>
                        </div>
                        <p className="text-xs text-stone-500">For your order confirmation and delivery updates.</p>
                    </div>
                </section>
                <DeliveryAddressSection
                    address={{ fullName, line1: deliveryAddress, line2: addressLine2, city, stateOrCounty, postalOrZipCode }}
                    onChange={updateDeliveryAddress}
                    countryCode={prodigiDestination}
                    onCountryChange={changeDeliveryCountry}
                    isUpdatingCountry={isUpdatingCountry}
                    countryError={countryError}
                    savedAddresses={savedAddresses}
                    selectedAddressId={selectedAddressId}
                    onAddressSelect={handleAddressSelect}
                    isFetchingAddresses={isFetchingAddresses}
                />
                {(hasMixedCurrencies || prodigiDestinations.length > 1) && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your selected items have different currencies or delivery countries. Please choose one destination for all items or check them out separately.</p>}

                {/* PayPal Express — prominent early payment option, following
                    the Wix-style checkout pattern. */}
                {checkoutCurrency === 'GBP' ? (
                    <section className="relative isolate overflow-hidden rounded-xl border border-[#c9dff0] bg-[#f7fbff] shadow-sm" aria-labelledby="payment-heading">
                        <div className="flex items-center justify-between gap-3 border-b border-[#dcecf7] px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <img src="https://www.paypalobjects.com/webstatic/icon/pp32.png" alt="PayPal" className="h-8 w-8 shrink-0 object-contain" />
                                <div className="min-w-0">
                                    <h3 id="payment-heading" className="text-sm font-bold text-stone-900">PayPal Express Checkout</h3>
                                    <p className="mt-0.5 text-xs text-stone-600">Fast, secure checkout by <span className="font-bold text-[#0070ba]">PayPal</span></p>
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                                <Price amount={finalTotal} currency={checkoutCurrency} className="text-sm font-bold text-stone-900" />
                                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#27658b] ring-1 ring-inset ring-[#c9dff0]"><ShieldCheck size={12} aria-hidden="true" /> Secure</span>
                            </div>
                        </div>
                        <div className="bg-white px-4 py-3">
                            {!PAYPAL_CLIENT_ID ? (
                                <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">Online payment is being set up. Please check back shortly.</p>
                            ) : (
                                <div className="relative z-0 mt-4 border-t border-stone-100 pt-4">
                                    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'GBP', intent: 'capture', components: 'buttons' }}>
                                        <PayPalButtons
                                            style={{ layout: 'vertical', shape: 'rect', label: 'paypal', tagline: false }}
                                            forceReRender={[finalTotal]}
                                            disabled={isProcessing}
                                            onClick={async (_, actions) => {
                                                const result = await handleCheckoutSubmit({ preventDefault: () => {} });
                                                if (result?.orderId) return actions.resolve();
                                                return actions.reject();
                                            }}
                                            createOrder={async () => {
                                                const pending = paypalCheckoutRef.current;
                                                if (!pending?.orderId) throw new Error('Your checkout details need to be completed first.');
                                                const result = await createPayPalOrder({ orderId: pending.orderId });
                                                if (!result.data?.id) throw new Error('Could not start PayPal checkout.');
                                                return result.data.id;
                                            }}
                                            onApprove={(data) => finishPayPalCheckout(data.orderID)}
                                            onCancel={() => setNotice('PayPal checkout cancelled — your order is saved, and you can try again whenever you are ready.')}
                                            onError={(err) => {
                                                console.error('PayPal checkout error:', err);
                                                setError('PayPal could not start checkout. Please try again.');
                                            }}
                                        />
                                    </PayPalScriptProvider>
                                </div>
                            )}
                        </div>
                    </section>
                ) : <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-stone-900">Online checkout</h3>
                    <p className="mt-1 text-xs leading-5 text-stone-600">Prices are charged in GBP. Choose a GBP delivery quote to continue.</p>
                </div>}

                {/* Items Container */}
                <details className="group rounded-xl border border-stone-200 bg-white overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                        <img src={getThumbnailUrl(checkoutItems[0].visualizerImage || checkoutItems[0].productionImage || checkoutItems[0].uploadedImage, 120)} alt="Your configured artwork" className="h-12 w-12 rounded-lg bg-stone-100 object-contain" />
                        <span className="flex-1 text-sm font-bold">Your order · {checkoutItems.reduce((count, item) => count + (item.quantity || 1), 0)} item(s)</span>
                        <span className="text-xs text-stone-500 underline underline-offset-4 group-open:hidden">View details</span>
                        <span className="hidden text-xs text-stone-500 underline underline-offset-4 group-open:inline">Hide details</span>
                    </summary>
                    <div className="p-4 space-y-4">
                        <h3 className="font-bold text-sm text-stone-900 -mb-1">
                            {checkoutItems.length === 1 ? 'Review Order' : 'Review Orders'}
                        </h3>
                        {checkoutItems.map((item, index) => {
                            const itemTitle = getItemTitle(item);
                            const itemSubtitle = getItemSubtitle(item);
                            const fullDescription = generateItemDescription(item);
                            const specs = getItemCustomizerSpecs(item);
                            
                            const variantText = item.isPreset && item.presetDims ? item.presetDims : item.selectedSize?.label || 'Custom Size';
                            
                            return (
                                <div key={`${item.id}-${index}`} className="flex gap-3">
                                    <div className="w-20 h-20 bg-stone-100 rounded-lg border border-stone-200 overflow-hidden flex-shrink-0">
                                        <img src={getThumbnailUrl(item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage, 180)} alt={fullDescription} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-bold text-stone-900 leading-snug">
                                                    {itemTitle}
                                                </h3>
                                                <span className="inline-flex items-center text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                                                    <span className="truncate max-w-[160px]">{formatDimensionWithOrientation(variantText, item.orientation, unit)}</span>
                                                </span>
                                            </div>

                                            {itemSubtitle && (
                                                <p className="text-xs font-medium text-stone-700 mt-0.5">
                                                    {itemSubtitle}
                                                </p>
                                            )}

                                            {specs.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {specs.map((spec, sIdx) => (
                                                        <span
                                                            key={sIdx}
                                                            className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium"
                                                        >
                                                            <span className="text-stone-400 mr-1">{spec.label}:</span>
                                                            <span className="text-stone-700">{spec.value}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2 flex items-center justify-between">
                                            <Price amount={item.prodigi?.quoteItemsGbp || item.totalPrice} currency={item.currency || 'GBP'} className="font-bold text-sm text-stone-900" />
                                            <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded">Qty: {item.quantity || 1}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </details>

                {/* Promo Code */}
                {checkoutCurrency === 'GHS' && <div className="bg-white rounded-xl shadow-sm p-4">
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
                                className="text-stone-600 hover:text-red-500 transition"
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
                </div>}

                {/* Summary */}
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 text-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                        <span className="font-bold text-stone-900 text-xs tracking-wider uppercase">Order Summary</span>
                        <span className="text-xs text-stone-500 font-medium">{checkoutItems.reduce((count, item) => count + (item.quantity || 1), 0)} item(s)</span>
                    </div>

                    {/* Items Subtotal */}
                    <div className="flex justify-between text-stone-600">
                        <span className="text-stone-700">Items Subtotal</span>
                        <Price amount={costBreakdown.itemsSubtotal} currency={checkoutCurrency} className="font-medium text-stone-800" />
                    </div>

                    {/* Delivery & Shipping */}
                    <div className="flex justify-between items-start text-stone-600">
                        <div className="pr-2">
                            <div className="flex items-center gap-1.5">
                                <span className="text-stone-700">Delivery</span>
                                {costBreakdown.deliveryCost === 0 && (
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                                        {costBreakdown.isPayOnDelivery ? 'Pay on delivery' : 'Included'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="font-medium text-stone-800 shrink-0">
                            {costBreakdown.deliveryCost > 0 ? (
                                <Price amount={costBreakdown.deliveryCost} currency={checkoutCurrency} />
                            ) : (
                                <span className="text-xs text-stone-600 font-semibold">
                                    {costBreakdown.isPayOnDelivery ? 'Pay on arrival' : 'Included'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Tax / VAT */}
                    <div className="flex justify-between items-start text-stone-600">
                        <div className="pr-2">
                            <div className="flex items-center gap-1.5">
                                <span className="text-stone-700">{hasProdigiItems ? 'VAT / Sales Tax' : 'Tax (VAT)'}</span>
                                {costBreakdown.taxCost === 0 && (
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                                        Included
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="font-medium text-stone-800 shrink-0">
                            {costBreakdown.taxCost > 0 ? (
                                <Price amount={costBreakdown.taxCost} currency={checkoutCurrency} />
                            ) : (
                                <span className="text-xs text-stone-600 font-semibold">Included</span>
                            )}
                        </div>
                    </div>

                    {/* Promo Discount if applied */}
                    {appliedPromo && (
                        <div className="flex justify-between text-stone-600 pt-2 border-t border-stone-100">
                            <span className="text-stone-700 font-medium">Promo ({appliedPromo.code})</span>
                            <Price amount={promoDiscount} currency={checkoutCurrency} prefix="- " className="text-[#c9a84c] font-bold" />
                        </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between font-bold text-stone-900 pt-2.5 border-t border-stone-100">
                        <span className="text-base">Total{checkoutCurrency === 'GBP' ? ' (GBP)' : ''}</span>
                        <Price amount={finalTotal} currency={checkoutCurrency} className="text-base font-bold" />
                    </div>

                    <p className="text-xs text-stone-500 pt-0.5">
                        {hasProdigiItems
                            ? 'Delivery and destination tax are itemized above in your verified quote.'
                            : 'Delivery fee is paid directly to the courier upon arrival.'}
                    </p>
                </div>

                {notice && (
                    <div className="bg-stone-100 text-stone-600 p-3 rounded-xl text-sm text-center flex items-center justify-center gap-2">
                        <span>{notice}</span>
                        <button
                            type="button"
                            onClick={() => setNotice('')}
                            className="text-stone-600 hover:text-stone-700 transition shrink-0"
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

                {/* Sticky Footer — the embedded PayPal buttons become the only
                    payment action once the order is ready, so keep the fixed
                    FrameWorthy bar out of that payment surface. */}
                {(!paypalCheckout && !(checkoutCurrency === 'GBP' && PAYPAL_CLIENT_ID)) && <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col">
                        <div className="text-[10px] text-stone-500 flex items-center gap-1 mb-0.5">
                            <ShieldCheck size={12} className="text-green-600" />
                            {checkoutCurrency === 'GBP' ? 'Secured by PayPal' : 'GBP quote required'}
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xs font-bold text-stone-800">Total:</span>
                            <Price amount={finalTotal} currency={checkoutCurrency} className="text-xl font-bold text-[#c9a84c]" />
                        </div>
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={isProcessing || hasMixedCurrencies || isUpdatingCountry || prodigiDestinations.length > 1 || checkoutCurrency !== 'GBP' || (checkoutCurrency === 'GBP' && (!PAYPAL_CLIENT_ID || paypalCheckout))}
                        className="bg-[#c9a84c] text-[#0a0a0a] px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-[#c9a84c]/20 hover:bg-[#d4b55c]"
                    >
                        {isProcessing ? <Loader size={16} className="animate-spin" /> : null}
                        {isProcessing ? 'Processing...' : checkoutCurrency === 'GBP' ? (paypalCheckout ? 'PayPal ready' : 'Continue to PayPal') : 'GBP quote required'}
                    </button>
                </div>}
            </form>
        </div>
    );
};

export default CheckoutPage;
