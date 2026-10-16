import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Mail, MessageCircle, Check, Send, Lock, User } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { formatOrdersForSharing, formatOrderForClient, generateItemDescription, GLASS_LABELS, HARDWARE_LABELS, matWidthLabel } from '../../utils/itemFormatters';
import { getPrintQualityJpegUrl, getThumbnailUrl } from '../../services/storage';
import { openExternalLink } from '../../utils/nativeLinks';

const ADMIN_EMAIL = 'admin@frameworthyco.com';
const RECIPIENTS_STORAGE_KEY = 'fw_share_recipients_history';
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Converts a local Ghanaian number (e.g. "0240000002") or an already
// international one into the digits-only format wa.me requires.
const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return null;
    let digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    else if (digits.startsWith('0')) digits = '233' + digits.slice(1);
    return digits || null;
};

// Frame preview images (src/data/constants.jsx) are root-relative paths
// served from this app's own origin (e.g. "/frames/x.jpg") — that works
// fine in-app, but the hidden HTML block below gets emailed and pasted
// into external clients where a relative path has nothing to resolve
// against. Absolutize anything that isn't already a full URL/data URI.
const toAbsoluteUrl = (url) => {
    if (!url || /^(https?:|data:|blob:)/i.test(url)) return url;
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

const ShareOrdersModal = ({ orders, onClose }) => {
    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [sendError, setSendError] = useState('');
    const [recipients, setRecipients] = useState([]);
    const [recipientInput, setRecipientInput] = useState('');
    const [recipientError, setRecipientError] = useState('');
    const [pastRecipients, setPastRecipients] = useState([]);
    const htmlRef = useRef(null);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(RECIPIENTS_STORAGE_KEY) || '[]');
            setPastRecipients(Array.isArray(stored) ? stored : []);
        } catch {
            setPastRecipients([]);
        }
    }, []);

    if (!orders || orders.length === 0) return null;

    const shareText = formatOrdersForSharing(orders);

    const addRecipient = (email) => {
        const clean = email.trim().toLowerCase();
        if (!clean) return;
        if (!isValidEmail(clean)) {
            setRecipientError('Enter a valid email address');
            return;
        }
        setRecipientError('');
        setRecipientInput('');
        if (clean === ADMIN_EMAIL || recipients.includes(clean)) return;
        setRecipients(prev => [...prev, clean]);
    };

    const removeRecipient = (email) => {
        setRecipients(prev => prev.filter(r => r !== email));
    };

    const handleRecipientKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addRecipient(recipientInput);
        }
    };

    const handleCopy = async () => {
        const plainText = shareText;
        const htmlContent = htmlRef.current ? htmlRef.current.innerHTML : '';

        try {
            if (window.ClipboardItem) {
                const typeText = new Blob([plainText], { type: 'text/plain' });
                const typeHtml = new Blob([htmlContent], { type: 'text/html' });
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': typeText,
                        'text/html': typeHtml
                    })
                ]);
            } else {
                // Fallback for older browsers
                await navigator.clipboard.writeText(plainText);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // Ultimate fallback
            navigator.clipboard.writeText(plainText);
        }
    };

    const handleWhatsApp = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        openExternalLink(url);
    };

    const handleEmail = () => {
        const toList = [ADMIN_EMAIL, ...recipients].join(',');
        const subject = encodeURIComponent(`FrameWorthy Orders (${orders.length})`);
        const body = encodeURIComponent(shareText);
        window.location.href = `mailto:${toList}?subject=${subject}&body=${body}`;
    };

    // Client messaging only applies to a single order — bulk selections span
    // multiple customers, so there's no single phone/email to target.
    const singleOrder = orders.length === 1 ? orders[0] : null;
    const clientMessage = singleOrder ? formatOrderForClient(singleOrder) : '';
    const clientPhone = formatPhoneForWhatsApp(singleOrder?.shippingAddress?.phone);
    const clientEmail = singleOrder?.userEmail;
    const isGuestEmail = !clientEmail || clientEmail === 'guest@frameworthy.com' || clientEmail === 'guest@frameworthyco.com';

    const handleClientWhatsApp = () => {
        if (!clientPhone) return;
        const url = `https://wa.me/${clientPhone}?text=${encodeURIComponent(clientMessage)}`;
        openExternalLink(url);
    };

    const handleClientEmail = () => {
        if (!clientEmail || isGuestEmail) return;
        const subject = encodeURIComponent('Your FrameWorthy Order Update');
        const body = encodeURIComponent(clientMessage);
        window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
    };

    const handleDirectSend = async () => {
        const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
        const templateId = import.meta.env.VITE_EMAILJS_STUDIO_TEMPLATE_ID;
        const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

        if (!serviceId || !templateId || !publicKey) {
            setSendError("EmailJS Studio Template is not configured. Add VITE_EMAILJS_STUDIO_TEMPLATE_ID to your .env.local file — the service ID and public key are already detected.");
            return;
        }

        setSendError('');
        setSending(true);
        const htmlContent = htmlRef.current ? htmlRef.current.innerHTML : '';
        const toEmail = [ADMIN_EMAIL, ...recipients].join(', ');

        try {
            await emailjs.send(
                serviceId,
                templateId,
                {
                    to_email: toEmail, // Requires EmailJS template's To Email field to use {{to_email}}
                    subject: `FrameWorthy Orders (${orders.length})`,
                    message_html: htmlContent, // Requires EmailJS template to use {{{message_html}}}
                    plain_text: shareText
                },
                publicKey
            );
            setSendSuccess(true);
            setTimeout(() => setSendSuccess(false), 3000);

            if (recipients.length > 0) {
                const updatedHistory = Array.from(new Set([...recipients, ...pastRecipients])).slice(0, 20);
                localStorage.setItem(RECIPIENTS_STORAGE_KEY, JSON.stringify(updatedHistory));
                setPastRecipients(updatedHistory);
            }
        } catch (error) {
            console.error("Failed to send email:", error);
            setSendError("Failed to send email directly. Check your EmailJS configuration or use the manual copy/email buttons below.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <h2 className="text-lg font-bold text-gray-900">Share Orders ({orders.length})</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content — only the order-summary preview scrolls; recipients
                    and client-messaging live in the pinned section below so
                    they're never scrolled out of sight. */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    <p className="text-sm text-gray-500 mb-4">
                        Review the generated order summary below. Click <strong>Copy (Rich Text)</strong> to copy a version with actual images that you can paste directly into an Email document!
                    </p>
                    <div className="relative">
                        <textarea
                            readOnly
                            value={shareText}
                            className="w-full h-64 p-4 text-sm font-mono bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none shadow-sm"
                        />
                        <button
                            onClick={handleCopy}
                            className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition flex items-center gap-1.5 text-xs font-bold shadow-sm"
                        >
                            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                            {copied ? 'Copied!' : 'Copy (Rich Text)'}
                        </button>
                    </div>
                </div>

                {/* Pinned bottom panel — recipients, client-messaging, and
                    actions. Sits outside the scrollable Content div so it's
                    always visible without scrolling. */}
                <div className="shrink-0 bg-gray-50 border-t border-gray-100">
                    <div className="px-6 pt-4 pb-1 max-h-[38vh] overflow-y-auto space-y-4">
                        {/* Recipients */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Send In-App To</h3>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a84c]/15 text-[#8a6d1f] rounded-full text-xs font-bold">
                                    <Lock size={12} />
                                    FrameWorthy Admin
                                </span>
                                {recipients.map(email => (
                                    <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
                                        {email}
                                        <button onClick={() => removeRecipient(email)} className="hover:text-red-600 transition" aria-label={`Remove ${email}`}>
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={recipientInput}
                                    onChange={(e) => { setRecipientInput(e.target.value); setRecipientError(''); }}
                                    onKeyDown={handleRecipientKeyDown}
                                    placeholder="Add recipient email..."
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                                />
                                <button
                                    onClick={() => addRecipient(recipientInput)}
                                    className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition"
                                >
                                    Add
                                </button>
                            </div>
                            {recipientError && <p className="text-xs text-red-600 mt-1.5">{recipientError}</p>}
                            {pastRecipients.filter(r => !recipients.includes(r)).length > 0 && (
                                <div className="mt-3">
                                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Past Recipients</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {pastRecipients.filter(r => !recipients.includes(r)).map(email => (
                                            <button
                                                key={email}
                                                onClick={() => addRecipient(email)}
                                                className="px-2.5 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full text-xs hover:bg-gray-100 transition"
                                            >
                                                + {email}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Message Client — only meaningful for a single order, since a
                            bulk selection can span multiple customers */}
                        {singleOrder && (
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                                    <User size={12} />
                                    Message Client Directly
                                </h3>
                                <p className="text-xs text-gray-500 mb-3">
                                    {singleOrder.customerName || 'This customer'} — {clientPhone ? `+${clientPhone}` : 'no phone on file'} · {isGuestEmail ? 'no email on file' : clientEmail}
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleClientWhatsApp}
                                        disabled={!clientPhone}
                                        className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white py-2.5 px-4 rounded-lg text-sm font-bold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <MessageCircle size={16} />
                                        WhatsApp Client
                                    </button>
                                    <button
                                        onClick={handleClientEmail}
                                        disabled={isGuestEmail}
                                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg text-sm font-bold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Mail size={16} />
                                        Email Client
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                {/* Footer / Actions */}
                <div className="p-6 bg-white border-t border-gray-100 shrink-0 flex flex-col gap-3">
                {sendError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{sendError}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={handleDirectSend}
                        disabled={sending}
                        className={`flex-1 flex items-center justify-center gap-2 ${sendSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-black hover:bg-gray-800'} text-white py-3 px-4 rounded-xl font-bold transition shadow-sm disabled:opacity-50`}
                    >
                        {sendSuccess ? <Check size={18} /> : <Send size={18} />}
                        {sending ? 'Sending...' : sendSuccess ? 'Sent!' : 'Send in-app'}
                    </button>
                    <button
                        onClick={handleWhatsApp}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white py-3 px-4 rounded-xl font-bold transition shadow-sm"
                    >
                        <MessageCircle size={18} />
                        WhatsApp
                    </button>
                    <button
                        onClick={handleEmail}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold transition shadow-sm"
                    >
                        <Mail size={18} />
                        Mail App
                    </button>
                </div>
                </div>
                </div>

            </div>

            {/* Hidden Rich HTML Content for Clipboard */}
            <div ref={htmlRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0 }}>
                {orders.map(order => (
                    <div key={order.id} style={{ fontFamily: 'sans-serif', marginBottom: '40px', paddingBottom: '20px', borderBottom: '2px solid #eee' }}>
                        <h2 style={{ margin: '0 0 5px 0' }}>Order #{order.id.slice(0, 8).toUpperCase()}</h2>
                        <p style={{ margin: '0 0 15px 0', color: '#666' }}>
                            {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'Unknown Date'}
                        </p>

                        <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
                            <div>
                                <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Customer</h4>
                                <p style={{ margin: 0 }}>{order.userEmail || 'guest@frameworthy.com'}</p>
                            </div>
                            {order.shippingAddress && (
                                <div>
                                    <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Deliver To</h4>
                                    <p style={{ margin: 0 }}>
                                        {order.shippingAddress.address}<br />
                                        {order.shippingAddress.apartment && <>{order.shippingAddress.apartment}<br /></>}
                                        {order.shippingAddress.city}, {order.shippingAddress.zip}<br />
                                        {order.shippingAddress.phone}
                                    </p>
                                </div>
                            )}
                        </div>

                        <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>
                            Items to Produce ({(order.items || []).reduce((acc, item) => acc + (item.quantity || 1), 0)})
                        </h4>

                        {(order.items || []).map((item, index) => {
                            const sizeLabel = item.selectedSize?.label || item.size || 'Unknown Size';
                            const matDesc = item.matWidth !== 'none' && item.matColor ? `${item.matColor.name} (${matWidthLabel(item.matWidth)})` : 'No Mount';
                            const printUrl = getPrintQualityJpegUrl(item.image, item);

                            return (
                                <div key={index} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', marginBottom: '15px', display: 'flex', gap: '20px' }}>
                                    
                                    {/* Images */}
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{ width: '120px', height: '120px', border: '1px solid #eee', position: 'relative' }}>
                                            {(item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.imageUrl || item.image) && (
                                                <img
                                                    src={toAbsoluteUrl(getThumbnailUrl(item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.imageUrl || item.image, 240))}
                                                    alt={generateItemDescription(item)}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            )}
                                        </div>
                                        {item.selectedFrame && (
                                            <div style={{ width: '120px', height: '120px', border: '1px solid #eee', position: 'relative' }}>
                                                {(item.selectedFrame.thumbnailImage || item.selectedFrame.previewImg || item.selectedFrame.image) && (
                                                    <img
                                                        src={toAbsoluteUrl(item.selectedFrame.thumbnailImage || item.selectedFrame.previewImg || item.selectedFrame.image)}
                                                        alt={item.selectedFrame.name || 'Selected frame'}
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div>
                                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>{generateItemDescription(item)}</h3>
                                        <table style={{ fontSize: '13px', lineHeight: '1.5' }}>
                                            <tbody>
                                                {item.selectedFrame?.name && (
                                                    <tr><td style={{ color: '#666', paddingRight: '10px' }}>Frame Style:</td><td>{item.selectedFrame.name}</td></tr>
                                                )}
                                                <tr><td style={{ color: '#666', paddingRight: '10px' }}>Size:</td><td>{sizeLabel}</td></tr>
                                                <tr><td style={{ color: '#666', paddingRight: '10px' }}>Orientation:</td><td>{item.orientation || 'Portrait'}</td></tr>
                                                {item.glassType && (
                                                    <tr><td style={{ color: '#666', paddingRight: '10px' }}>Glazing:</td><td>{GLASS_LABELS[item.glassType] || item.glassType}</td></tr>
                                                )}
                                                {item.hardwareType && (
                                                    <tr><td style={{ color: '#666', paddingRight: '10px' }}>Hardware:</td><td>{HARDWARE_LABELS[item.hardwareType] || item.hardwareType}</td></tr>
                                                )}
                                                <tr><td style={{ color: '#666', paddingRight: '10px' }}>Mount:</td><td>{matDesc}</td></tr>
                                                <tr><td style={{ color: '#666', paddingRight: '10px' }}>Qty:</td><td>{item.quantity}</td></tr>
                                            </tbody>
                                        </table>

                                        {printUrl && (
                                            <div style={{ marginTop: '15px' }}>
                                                <a href={printUrl} style={{ display: 'inline-block', backgroundColor: '#000', color: '#fff', padding: '8px 15px', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', borderRadius: '4px' }}>
                                                    Download Print-Ready JPEG
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ShareOrdersModal;
