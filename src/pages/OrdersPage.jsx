import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserOrders } from '../services/db';
import { Package, Loader, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { generateItemDescription, formatDimensionWithOrientation } from '../utils/itemFormatters';
import { useNavigate } from 'react-router-dom';
import Price from '../components/common/Price';
import { getThumbnailUrl } from '../services/storage';

const OrdersPage = () => {
    const { user, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);

    useEffect(() => {
        // Firebase's auth state resolves asynchronously — on a hard refresh
        // or direct link to /orders, `user` starts out null even for an
        // already-authenticated visitor. Wait for authLoading to clear
        // before redirecting, otherwise a real session gets bounced to
        // /login a moment before it would have resolved.
        if (authLoading) return;

        if (!user) {
            navigate('/login');
            return;
        }

        fetchOrders(user.uid);
    }, [user, authLoading, navigate]);

    const fetchOrders = async (uid) => {
        setLoading(true);
        setFetchError(false);
        try {
            const data = await getUserOrders(uid);
            // Hide abandoned checkouts — an order row is written before
            // the Paystack popup opens, so closing it leaves one behind
            // that was never paid for.
            //
            // This must key off paymentStatus, not status: they're two
            // separate axes. paymentStatus ('pending' -> 'paid') is set
            // only by verifyPaystackPayment, while status
            // ('pending'/'processing'/'shipped'/'delivered') is fulfilment
            // progress that only the admin advances. A freshly paid order
            // is paymentStatus 'paid' but status still 'pending', so
            // filtering on status hid every order the customer had just
            // successfully paid for until an admin manually touched it.
            setOrders(data.filter(order => order.paymentStatus === 'paid'));
        } catch (err) {
            // Previously silent (console.error only) — a failed fetch fell
            // through to the same "No orders yet" empty state as a customer
            // with genuinely zero orders, so a network/Firestore hiccup
            // looked identical to "you've never ordered anything."
            console.error('Failed to fetch orders:', err);
            setFetchError(true);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-[#faf9f8] pt-24 pb-12 flex flex-col items-center justify-center">
                <Loader className="animate-spin text-[#c9a84c] mb-4" size={48} />
                <p className="text-sm font-bold tracking-widest uppercase text-stone-500">Loading Orders</p>
            </div>
        );
    }

    if (!user) return null;

    if (fetchError) {
        return (
            <div className="min-h-screen bg-[#faf9f8] pt-24 pb-12 flex flex-col items-center justify-center px-6 text-center">
                <Package size={64} className="text-stone-300 mb-4" />
                <h2 className="text-xl font-bold text-stone-800 mb-2">Couldn't load your orders</h2>
                <p className="text-sm text-stone-500 mb-4 max-w-sm">Something went wrong on our end. Your orders are still there — try again in a moment.</p>
                <button
                    onClick={() => fetchOrders(user.uid)}
                    className="mt-2 px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-bold rounded-full text-sm hover:bg-[#d4b55c] transition"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="min-h-screen bg-[#faf9f8] pt-24 pb-12 flex flex-col items-center justify-center">
                <Package size={64} className="text-stone-300 mb-4" />
                <h2 className="text-xl font-bold text-stone-800 mb-2">No orders yet</h2>
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
            <div className="bg-white sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b border-stone-100">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="text-stone-500 hover:text-stone-800 transition p-1 rounded-full hover:bg-stone-100"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="text-xl font-bold text-stone-900 tracking-tight">
                        My Orders
                    </div>
                </div>
            </div>

            {/* Orders List */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="space-y-6">
                    {orders.map((order, idx) => (
                        <div 
                            key={order.id} 
                            className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm animate-fade-in-up"
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50/50">
                                <div>
                                    <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">
                                        Order Placed
                                    </p>
                                    <p className="text-stone-800 font-medium">
                                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        }) : 'Recently'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 sm:gap-8">
                                    <div>
                                        <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">
                                            Total
                                        </p>
                                        <p className="text-stone-800 font-medium">
                                            <Price amount={order.totalPrice ?? order.items?.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0) ?? 0} />
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">
                                            Status
                                        </p>
                                        <div className="flex items-center justify-end">
                                            {/* Fulfilment progress only — every order shown here is
                                                already paid (see the paymentStatus filter above), so
                                                a 'paid' case would be dead code: 'paid' is a
                                                paymentStatus value and never appears in `status`.
                                                'pending' here means paid but not yet started. */}
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                                order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                                order.status === 'processing' ? 'bg-[#c9a84c]/20 text-yellow-900' :
                                                'bg-stone-100 text-stone-600'
                                            }`}>
                                                {order.status === 'pending' || !order.status
                                                    ? 'ORDER RECEIVED'
                                                    : order.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Items */}
                            <div className="p-6">
                                <div className="space-y-6">
                                    {order.items?.map((item, itemIdx) => (
                                        <div key={itemIdx} className="flex gap-4 sm:gap-6 border-b border-stone-100 last:border-0 pb-6 last:pb-0">
                                            {/* Thumbnail Container */}
                                            <div className="w-24 h-24 bg-stone-100 rounded-lg relative overflow-hidden flex-shrink-0 border border-stone-200">
                                                {(item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.image) ? (
                                                    <img
                                                        src={getThumbnailUrl(item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.image, 200)}
                                                        alt={generateItemDescription(item)}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <ImageIcon className="text-stone-300" size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Details */}
                                            <div className="flex-1 flex flex-col justify-between min-w-0">
                                                <div>
                                                    <h3 className="text-sm text-stone-800 leading-normal" title={generateItemDescription(item)}>
                                                        {item.quantity || 1}x {generateItemDescription(item)}
                                                        <span className="inline-flex items-center text-xs text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 ml-2 align-middle">
                                                            <span className="truncate max-w-[160px]">
                                                                {formatDimensionWithOrientation(item.size || item.selectedSize?.label || item.presetDims, item.orientation)}
                                                            </span>
                                                        </span>
                                                    </h3>
                                                </div>
                                                <div className="mt-1 flex items-end justify-between">
                                                    <p className="text-base font-bold text-stone-900">
                                                        <Price amount={item.price ?? item.totalPrice ?? 0} />
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OrdersPage;
