import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import { Package, Loader, Search, Clock, Truck, CheckCircle } from 'lucide-react';
import Price from '../components/common/Price';

// Server-side lookup — guest orders (userId 'guest') can't be read from
// Firestore directly under the rules, so this goes through the
// lookupGuestOrder callable, which releases a single order's status to
// whoever presents both its id and the email it was placed under.
const lookupGuestOrder = httpsCallable(functions, 'lookupGuestOrder');

// Orders move stepwise through these statuses (set by the admin dashboard).
// There is no courier/shipment tracking — this page only reflects which
// step the order is on.
const STATUS_STEPS = ['pending', 'processing', 'shipped', 'delivered'];

const STATUS_META = {
    pending: { label: 'Order received', icon: Clock, copy: 'Paid and waiting to enter production.' },
    processing: { label: 'In production', icon: Package, copy: 'Your frame is being crafted.' },
    shipped: { label: 'Out for delivery', icon: Truck, copy: 'On its way to you.' },
    delivered: { label: 'Delivered', icon: CheckCircle, copy: 'Delivered — enjoy!' },
};

const OrderStatusPage = () => {
    const location = useLocation();
    // SuccessPage can link here with the id prefilled so a guest only has to
    // re-enter their email.
    const [orderId, setOrderId] = useState(location.state?.orderId || '');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResult(null);
        if (!orderId.trim() || !email.trim()) {
            setError('Enter both your order ID and the email you used at checkout.');
            return;
        }
        setIsLoading(true);
        try {
            const res = await lookupGuestOrder({ orderId: orderId.trim(), email: email.trim() });
            setResult(res.data);
        } catch (err) {
            // The function returns the same not-found for a wrong id and a
            // wrong email on purpose; mirror that neutrality here.
            setError(err.code === 'functions/not-found' || err.code === 'not-found'
                ? 'No order matches that ID and email. Double-check both — the ID is on your order confirmation.'
                : 'Something went wrong looking that up. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const activeStep = result ? Math.max(0, STATUS_STEPS.indexOf(result.status)) : 0;

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans">
            <div className="max-w-lg mx-auto px-6 pt-16 md:pt-24 pb-24">
                <h1 className="font-serif text-2xl md:text-3xl font-light tracking-tight leading-none mb-2">Order Status</h1>
                <p className="text-sm text-stone-500 mb-8">
                    Enter your order ID and the email you used at checkout. Your order ID is on the
                    confirmation screen and in your confirmation email.
                </p>

                <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Order ID</label>
                        <input
                            type="text"
                            value={orderId}
                            onChange={(e) => { setOrderId(e.target.value); setError(''); }}
                            placeholder="e.g. aB3xK9mQ7pL2nR5tV8wY"
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-stone-900 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                            placeholder="name@example.com"
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-stone-900 transition"
                        />
                    </div>

                    {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-stone-900 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-800 transition disabled:opacity-50"
                    >
                        {isLoading ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                        {isLoading ? 'Looking up…' : 'Find my order'}
                    </button>
                </form>

                {result && (
                    <div className="mt-6 bg-white border border-stone-200 rounded-xl shadow-sm p-6">
                        <div className="flex items-start justify-between mb-1">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Order</p>
                                <p className="font-mono text-sm">{result.orderId}</p>
                            </div>
                            {typeof result.totalPrice === 'number' && (
                                <Price amount={result.totalPrice} className="font-bold" />
                            )}
                        </div>
                        {result.createdAt && (
                            <p className="text-xs text-stone-500 mb-4">
                                Placed {new Date(result.createdAt).toLocaleDateString()}
                                {result.itemCount ? ` · ${result.itemCount} item${result.itemCount === 1 ? '' : 's'}` : ''}
                            </p>
                        )}

                        {result.paymentStatus !== 'paid' ? (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
                                This order was started but payment was never completed, so it isn&apos;t in
                                production. If you believe you were charged, contact support with the order ID above.
                            </div>
                        ) : (
                            <div className="space-y-3 mt-2">
                                {STATUS_STEPS.map((step, i) => {
                                    const meta = STATUS_META[step];
                                    const Icon = meta.icon;
                                    const reached = i <= activeStep;
                                    const current = i === activeStep;
                                    return (
                                        <div key={step} className={`flex items-start gap-3 ${reached ? '' : 'opacity-35'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                current ? 'bg-[#c9a84c] text-stone-950' : reached ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'
                                            }`}>
                                                <Icon size={15} />
                                            </div>
                                            <div className="pt-1">
                                                <p className={`text-sm ${current ? 'font-bold' : 'font-medium'}`}>{meta.label}</p>
                                                {current && <p className="text-xs text-stone-500">{meta.copy}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderStatusPage;
