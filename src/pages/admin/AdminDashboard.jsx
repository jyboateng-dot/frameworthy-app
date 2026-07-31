import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getOrders, updateOrderStatus } from '../../services/db';
import { Package, Search, Image as ImageIcon, CheckCircle, Clock, Truck, ChevronDown, CircleDollarSign, AlertTriangle, ClipboardList, Share2 } from 'lucide-react';
import OrderDetailModal from './OrderDetailModal';
import ShareOrdersModal from './ShareOrdersModal';
import { isAdminEmail } from '../../constants/admin';

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered'];

const AdminDashboard = () => {
    const { user, isLoading: authLoading } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    // Unpaid (abandoned-checkout) orders are hidden by default so fulfillment
    // staff never mistake one for a paid order to ship.
    const [showUnpaid, setShowUnpaid] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
    const [sharingOrders, setSharingOrders] = useState(null);

    useEffect(() => {
        // Only fetch if user is authorized
        if (user && isAdminEmail(user.email)) {
            fetchOrders();
        }
    }, [user]);

    const fetchOrders = async () => {
        setLoading(true);
        setFetchError(false);
        try {
            const data = await getOrders();
            setOrders(data);
        } catch (error) {
            // Previously silent (console.error only) — a failed fetch fell
            // through to the same "No orders found" empty state as a
            // genuinely empty order book, so a transient error could read
            // to an admin as "nothing to fulfill."
            console.error("Failed to fetch orders:", error);
            setFetchError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = (orderIdsToShare) => {
        const ordersToShare = orders.filter(o => orderIdsToShare.has(o.id));
        setSharingOrders(ordersToShare);
    };

    const toggleOrderSelection = (orderId) => {
        const newSelection = new Set(selectedOrderIds);
        if (newSelection.has(orderId)) {
            newSelection.delete(orderId);
        } else {
            newSelection.add(orderId);
        }
        setSelectedOrderIds(newSelection);
    };

    const handleStatusChange = async (orderId, newStatus) => {
        const order = orders.find(o => o.id === orderId);
        const currentIndex = STATUS_ORDER.indexOf(order?.status || 'pending');
        const newIndex = STATUS_ORDER.indexOf(newStatus);
        // The dropdown always lists every status regardless of where the
        // order currently is, so a misclick can silently regress a shipped
        // order back to pending with nothing else catching it (the rules
        // and updateOrderStatus don't enforce a state machine either) —
        // require a deliberate confirmation for anything that isn't a
        // forward or same-status move.
        if (newIndex < currentIndex) {
            const confirmed = window.confirm(
                `This moves the order backward from "${order.status || 'pending'}" to "${newStatus}". Are you sure?`
            );
            if (!confirmed) return;
        }

        setUpdatingId(orderId);
        try {
            await updateOrderStatus(orderId, newStatus);
            // Update local state without refetching entirely
            setOrders(orders.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Failed to update order status. Please try again.");
        } finally {
            setUpdatingId(null);
        }
    };

    // --- Access Control ---
    if (authLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;
    
    // Redirect if not logged in or not the admin
    if (!user || !isAdminEmail(user.email)) {
        return <Navigate to="/" replace />;
    }

    const unpaidCount = orders.filter(order => order.paymentStatus !== 'paid').length;

    const filteredOrders = orders
        .filter(order => showUnpaid || order.paymentStatus === 'paid')
        .filter(order =>
            order.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id.toLowerCase().includes(searchTerm.toLowerCase())
        );

    // Comparing selectedOrderIds.size to filteredOrders.length breaks as soon
    // as a search/filter changes the visible set without also changing the
    // selection count to match — the checkbox could render "checked" with
    // none of the visible rows actually selected, and clicking it would
    // wipe out a real (now-hidden) selection instead of acting on what's
    // visible. Comparing actual membership, and only toggling the currently
    // visible orders, keeps this correct regardless of filter state.
    const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.has(o.id));

    const toggleAllSelection = () => {
        const next = new Set(selectedOrderIds);
        filteredOrders.forEach(o => allFilteredSelected ? next.delete(o.id) : next.add(o.id));
        setSelectedOrderIds(next);
    };

    const getStatusIcon = (status) => {
        switch(status) {
            case 'pending': return <Clock size={14} className="text-amber-500" />;
            case 'processing': return <Package size={14} className="text-blue-500" />;
            case 'shipped': return <Truck size={14} className="text-purple-500" />;
            case 'delivered': return <CheckCircle size={14} className="text-emerald-500" />;
            default: return <Clock size={14} className="text-gray-500" />;
        }
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'processing': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'shipped': return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            default: return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pt-24 pb-12 px-4 md:px-8">
            <div className="max-w-6xl mx-auto">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-black mb-1">Admin Dashboard</h1>
                        <p className="text-gray-500">Manage your FrameWorthy orders</p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowUnpaid(v => !v)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold transition-colors ${showUnpaid ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                            <AlertTriangle size={14} />
                            {showUnpaid ? 'Hide unpaid' : `Show unpaid${unpaidCount > 0 ? ` (${unpaidCount})` : ''}`}
                        </button>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by email or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:border-black focus:ring-1 focus:ring-black outline-none w-full md:w-64"
                            />
                        </div>
                    </div>
                </div>

                {/* Bulk Action Bar */}
                {selectedOrderIds.size > 0 && (
                    <div className="bg-gray-900 text-white px-6 py-3 rounded-xl shadow-lg flex items-center justify-between mb-6 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <div className="flex items-center gap-2">
                            <span className="font-bold">{selectedOrderIds.size}</span>
                            <span className="text-gray-300">order{selectedOrderIds.size > 1 ? 's' : ''} selected</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedOrderIds(new Set())}
                                className="text-sm text-gray-400 hover:text-white transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleShare(selectedOrderIds)}
                                className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-100 transition"
                            >
                                <Share2 size={16} />
                                Share Orders
                            </button>
                        </div>
                    </div>
                )}

                {/* Orders Table/List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                        </div>
                    ) : fetchError ? (
                        <div className="p-12 text-center text-gray-500">
                            <AlertTriangle size={48} className="mx-auto mb-4 text-red-300" />
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Couldn't load orders</h3>
                            <p className="mb-4">Something went wrong fetching orders. This isn't the same as having no orders — try again.</p>
                            <button
                                onClick={fetchOrders}
                                className="px-6 py-2 bg-gray-900 text-white font-bold rounded-full text-sm hover:bg-gray-800 transition"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Package size={48} className="mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No orders found</h3>
                            <p>
                                {!showUnpaid && unpaidCount > 0
                                    ? `No paid orders match. ${unpaidCount} unpaid order${unpaidCount > 1 ? 's are' : ' is'} hidden — click "Show unpaid" to view.`
                                    : "You haven't received any orders yet, or none match your search."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                                        <th className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                                                checked={allFilteredSelected}
                                                onChange={toggleAllSelection}
                                                aria-label="Select all orders"
                                            />
                                        </th>
                                        <th className="px-6 py-4 font-bold">Order Details</th>
                                        <th className="px-6 py-4 font-bold">Customer</th>
                                        <th className="px-6 py-4 font-bold">Configuration</th>
                                        <th className="px-6 py-4 font-bold">Price</th>
                                        <th className="px-6 py-4 font-bold">Payment</th>
                                        <th className="px-6 py-4 font-bold">Status</th>
                                        <th className="px-6 py-4 font-bold"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredOrders.map(order => (
                                        <tr key={order.id} className={`hover:bg-gray-50/50 transition ${selectedOrderIds.has(order.id) ? 'bg-gray-50' : ''}`}>
                                            
                                            {/* Checkbox */}
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                                                    checked={selectedOrderIds.has(order.id)}
                                                    onChange={() => toggleOrderSelection(order.id)}
                                                    aria-label={`Select order ${order.id}`}
                                                />
                                            </td>

                                            {/* ID & Date */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="text-sm font-bold">{order.id.slice(0, 8).toUpperCase()}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown date'}
                                                </div>
                                            </td>

                                            {/* Customer Info */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="text-sm font-medium">{order.userEmail}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {order.shippingAddress?.address}<br/>
                                                    {order.shippingAddress?.city}, {order.shippingAddress?.zip}
                                                </div>
                                            </td>

                                            {/* Configuration */}
                                            <td className="px-6 py-4 align-top">
                                                {(order.items || []).slice(0, 1).map((item, i) => (
                                                    <div key={i} className="flex items-start gap-3">
                                                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center shrink-0 border border-gray-200 overflow-hidden relative">
                                                            {(item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.image) ? (
                                                                <img src={item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.image} alt="Preview" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ImageIcon size={20} className="text-gray-400" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold">{item.frame}</div>
                                                            <div className="text-xs text-gray-600 mt-0.5">
                                                                {item.size} • {item.orientation}
                                                            </div>
                                                            {item.quantity > 1 && (
                                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">
                                                                    Qty {item.quantity}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {(order.items?.length || 0) > 1 && (
                                                    <div className="text-[10px] font-bold text-gray-400 mt-1 ml-[60px]">
                                                        +{order.items.length - 1} more item{order.items.length - 1 > 1 ? 's' : ''}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Price */}
                                            <td className="px-6 py-4 align-top text-sm font-bold whitespace-nowrap">
                                                {order.currency} {order.totalPrice}
                                            </td>

                                            {/* Payment Status */}
                                            <td className="px-6 py-4 align-top">
                                                {order.paymentStatus === 'paid' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CircleDollarSign size={12} />
                                                        Paid
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200" title="Checkout was started but payment was never verified — do not fulfill.">
                                                        <AlertTriangle size={12} />
                                                        Unpaid
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status Selector */}
                                            <td className="px-6 py-4 align-top">
                                                {order.paymentStatus !== 'paid' ? (
                                                    <span className="text-xs text-gray-400 italic">Awaiting payment</span>
                                                ) : (
                                                    <div className="relative inline-block">
                                                        <select
                                                            value={order.status || 'pending'}
                                                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                            disabled={updatingId === order.id}
                                                            className={`appearance-none pl-8 pr-8 py-1.5 rounded-full text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/10 transition-all ${getStatusColor(order.status || 'pending')} ${updatingId === order.id ? 'opacity-50 cursor-wait' : ''}`}
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="processing">Processing</option>
                                                            <option value="shipped">Shipped</option>
                                                            <option value="delivered">Delivered</option>
                                                        </select>
                                                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            {getStatusIcon(order.status || 'pending')}
                                                        </div>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            <ChevronDown size={12} />
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 align-top">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors whitespace-nowrap"
                                                    >
                                                        <ClipboardList size={12} /> View & Fulfill
                                                    </button>
                                                    <button
                                                        onClick={() => handleShare(new Set([order.id]))}
                                                        className="inline-flex items-center justify-center p-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
                                                        title="Share Order"
                                                    >
                                                        <Share2 size={14} />
                                                    </button>
                                                </div>
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>

            <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
            {sharingOrders && sharingOrders.length > 0 && (
                <ShareOrdersModal orders={sharingOrders} onClose={() => setSharingOrders(null)} />
            )}
        </div>
    );
};

export default AdminDashboard;
