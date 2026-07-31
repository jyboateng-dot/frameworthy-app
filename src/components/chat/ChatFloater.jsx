import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToMessages, subscribeToThread, sendMessage, markThreadRead, requestHumanSupport } from '../../services/chat';

// Instant Messaging Floater Component with AI Assistant & Real-time Typing
const ChatFloater = ({ isOpen, setIsOpen }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [thread, setThread] = useState(null);
    const [draft, setDraft] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !user) return;
        const unsubMsgs = subscribeToMessages(user.uid, setMessages);
        const unsubThread = subscribeToThread(user.uid, setThread);
        markThreadRead(user.uid, 'customer').catch(() => {});
        return () => {
            unsubMsgs();
            unsubThread();
        };
    }, [isOpen, user]);

    useEffect(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, thread?.isAiTyping]);

    if (!isOpen || !user) return null;

    const handleSend = async (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || isSending) return;
        setIsSending(true);
        try {
            await sendMessage(user.uid, text, 'customer', { email: user.email, displayName: user.displayName });
            // Only clear on confirmed success — clearing eagerly meant a
            // failed send (offline, Firestore error) silently lost whatever
            // the customer had just typed, with no way to recover it.
            setDraft('');
        } catch (err) {
            console.error('Failed to send chat message:', err);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-[150] sm:w-[420px] sm:h-[580px] sm:rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden border border-stone-300">
            {/* CHAT HEADER */}
            <div className="bg-[#0a0a0a] text-white px-5 py-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:pt-4 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-[#c9a84c] text-stone-950 font-bold flex items-center justify-center text-sm shadow">
                            FW
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0a0a0a]"></span>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="font-serif font-bold text-base text-[#faf9f8] tracking-wide">FrameWorthy Support</p>
                            <Sparkles size={13} className="text-[#c9a84c]" />
                        </div>
                        <p className="text-xs font-semibold text-[#c9a84c]">
                            {thread?.humanRequested ? 'Human Support Active' : 'AI Assistant • 24/7 Support'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chat"
                    className="p-2 hover:bg-white/15 rounded-full transition text-stone-300 hover:text-white"
                >
                    <X size={20} />
                </button>
            </div>

            {/* MESSAGE HISTORY */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-[#faf9f8]">
                {messages.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-white border border-stone-200 rounded-xl my-4 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-[#c9a84c]/15 text-[#b08e33] mx-auto flex items-center justify-center mb-3">
                            <Bot size={20} />
                        </div>
                        <p className="font-serif font-bold text-stone-900 text-base mb-1">Welcome to Instant Messaging 👋</p>
                        <p className="text-xs font-medium text-stone-700 leading-relaxed max-w-xs mx-auto">
                            Ask me anything about frame styles, custom dimensions, glass, canvas finishes, pricing, or Ghana delivery!
                        </p>
                    </div>
                ) : (
                    messages.map(m => {
                        const isCustomer = m.senderRole === 'customer';
                        const isAssistant = m.senderRole === 'assistant';
                        const isAdmin = m.senderRole === 'admin';

                        return (
                            <div key={m.id} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                                {isAssistant && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#b08e33] mb-1 flex items-center gap-1">
                                        <Bot size={11} /> AI Studio Assistant
                                    </span>
                                )}
                                {isAdmin && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1 flex items-center gap-1">
                                        Studio Representative
                                    </span>
                                )}
                                <div
                                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm md:text-base leading-relaxed ${
                                        isCustomer
                                            ? 'bg-stone-950 text-white font-normal shadow-sm rounded-br-none'
                                            : isAssistant
                                            ? 'bg-white border border-[#c9a84c]/40 text-stone-900 font-normal shadow-sm rounded-bl-none'
                                            : 'bg-white border border-stone-300 text-stone-900 font-normal shadow-sm rounded-bl-none'
                                    }`}
                                >
                                    {m.text}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* AI IS TYPING INDICATOR */}
                {thread?.isAiTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-[#c9a84c]/40 px-4 py-3 rounded-2xl rounded-bl-none text-xs text-stone-700 font-medium flex items-center gap-2 shadow-sm">
                            <Bot size={14} className="text-[#b08e33] animate-pulse" />
                            <span>AI Assistant is typing</span>
                            <span className="flex gap-1 items-center ml-1">
                                <span className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                <span className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* CHAT INPUT FORM */}
            <form
                onSubmit={handleSend}
                className="p-3.5 bg-white border-t border-stone-300 flex items-center gap-2.5 shrink-0 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))]"
            >
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ask about frames, glass, delivery, sizing..."
                    className="flex-1 px-4 py-3 rounded-xl border border-stone-300 focus:border-stone-950 focus:ring-1 focus:ring-stone-950 outline-none text-base font-normal text-stone-900 placeholder:text-stone-400 bg-stone-50 focus:bg-white transition"
                />
                <button
                    type="submit"
                    disabled={!draft.trim() || isSending}
                    className="p-3 rounded-xl bg-[#c9a84c] hover:bg-[#d4b55c] text-stone-950 font-bold disabled:opacity-30 disabled:hover:bg-[#c9a84c] shrink-0 transition shadow-sm"
                    title="Send message"
                >
                    <Send size={18} className="stroke-[2.5]" />
                </button>
            </form>
        </div>
    );
};

export default ChatFloater;
