import React, { useState } from 'react';
import { Check, Copy, Package } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Price from '../components/common/Price';

const SuccessPage = ({ productMode, setProductMode, navigate }) => {
    const location = useLocation();
    // Passed by CheckoutPage on a verified payment. Absent if someone lands
    // here directly (or refreshes, since router state doesn't survive that),
    // so every use below is optional.
    const { orderId, reference, email, total, isGuest } = location.state || {};
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!orderId) return;
        try {
            await navigator.clipboard.writeText(orderId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard unavailable (insecure context/permissions) — the id
            // is still on screen and selectable.
        }
    };

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans flex flex-col items-center px-6 pt-8 md:pt-14 pb-16 text-center animate-fade-in-up">
            <div className="w-full max-w-sm bg-emerald-600 text-white rounded-xl shadow-md px-6 py-4 mb-8 flex items-center justify-center gap-2.5">
                <Check size={22} strokeWidth={3.5} />
                <span className="font-extrabold text-lg uppercase tracking-wider">Order Confirmed</span>
            </div>

            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-3">Thank you!</h2>
            <p className="text-stone-500 max-w-md mb-8 leading-relaxed">
                Your custom {productMode === 'frame' ? 'frame' : 'photo book'} is being crafted.
                {email ? <> We&apos;ve sent a confirmation to <span className="font-medium text-stone-900">{email}</span>.</> : ' You will receive a confirmation email shortly with your order details.'}
            </p>

            {orderId && (
                <div className="w-full max-w-sm bg-white border border-stone-200 rounded-xl shadow-sm p-4 mb-8 text-left">
                    {/* Order ID first — it's what the admin dashboard searches
                        on, so it's the fastest way for support to find this
                        order. The Paystack reference is shown too for
                        payment-side queries. */}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                        Order ID
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 font-mono text-sm text-stone-900 break-all select-all">{orderId}</code>
                        <button
                            onClick={handleCopy}
                            className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#c9a84c] hover:text-[#a3853c] transition"
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>

                    {reference && (
                        <div className="mt-3 pt-3 border-t border-stone-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                                Payment reference
                            </p>
                            <code className="font-mono text-xs text-stone-500 break-all select-all">{reference}</code>
                        </div>
                    )}

                    {typeof total === 'number' && (
                        <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-stone-100">
                            <span className="text-xs text-stone-500">Total paid</span>
                            <Price amount={total} className="text-sm font-bold text-stone-900" />
                        </div>
                    )}
                    {isGuest && (
                        // A guest order is stored under userId 'guest', so it
                        // can't be listed on /orders — this id (plus their
                        // email) is how they check its status on /order-status.
                        <p className="text-[11px] text-stone-500 mt-3 leading-relaxed">
                            You checked out as a guest — keep this Order ID safe. Together with your email,
                            it&apos;s how you check this order&apos;s status (and how we find it if you get in touch).
                        </p>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                    onClick={() => { setProductMode(null); navigate('/'); }}
                    className="w-full py-3 bg-[#c9a84c] text-[#0a0a0a] rounded-full font-bold shadow-lg shadow-[#c9a84c]/20 hover:bg-[#d4b55c] transition-colors"
                >
                    Back to Home
                </button>
                {/* Signed-in customers get their order history; guests get
                    the id+email lookup instead — /orders queries by uid, so
                    it has nothing to show a guest. */}
                <button
                    onClick={() => navigate(
                        isGuest ? '/order-status' : '/orders',
                        isGuest && orderId ? { state: { orderId } } : undefined
                    )}
                    className="w-full py-3 text-stone-500 hover:text-[#c9a84c] transition-colors flex items-center justify-center gap-2 font-medium"
                >
                    <Package size={16} /> {isGuest ? 'Check Order Status' : 'View Order Status'}
                </button>
            </div>
        </div>
    );
};

export default SuccessPage;
