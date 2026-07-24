import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToMessages, sendMessage, markThreadRead } from '../../services/chat';

// Chat panel — mounted once in App.jsx's AppLayout, opened via the "Chat
// with us" entry in Header's main menu (isOpen/setIsOpen are lifted up to
// AppLayout and shared with Header, since both are siblings there). Only
// ever opened for a signed-in user — Header's menu item routes a signed-out
// tap to /auth instead of calling onOpenChat, so this component can assume
// `user` is present whenever isOpen is true.
const ChatFloater = ({ isOpen, setIsOpen }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !user) return;
        const unsub = subscribeToMessages(user.uid, setMessages);
        markThreadRead(user.uid, 'customer').catch(() => {});
        return unsub;
    }, [isOpen, user]);

    useEffect(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    if (!isOpen || !user) return null;

    const handleSend = async (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || isSending) return;
        setDraft('');
        setIsSending(true);
        try {
            await sendMessage(user.uid, text, 'customer', { email: user.email, displayName: user.displayName });
        } catch (err) {
            console.error('Failed to send chat message:', err);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-[150] sm:w-96 sm:h-[520px] sm:rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-[#0a0a0a] text-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:pt-3 flex items-center justify-between shrink-0">
                <div>
                    <p className="font-serif font-bold text-sm text-[#e8e2d9]">FrameWorthy Support</p>
                    <p className="text-[10px] text-[#9a8e7d]">We usually reply within a day</p>
                </div>
                <button onClick={() => setIsOpen(false)} aria-label="Close chat" className="p-1.5 hover:bg-white/10 rounded-full transition text-[#9a8e7d]">
                    <X size={18} />
                </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
                {messages.length === 0 ? (
                    <div className="text-center text-xs text-stone-400 mt-8">Send a message and our team will get back to you.</div>
                ) : messages.map(m => (
                    <div key={m.id} className={`flex ${m.senderRole === 'customer' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${m.senderRole === 'customer' ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-900'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSend} className="p-3 border-t border-stone-200 flex items-center gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-full border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none text-sm"
                />
                <button type="submit" disabled={!draft.trim() || isSending} className="p-2.5 rounded-full bg-stone-900 text-white disabled:opacity-40 shrink-0">
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
};

export default ChatFloater;
