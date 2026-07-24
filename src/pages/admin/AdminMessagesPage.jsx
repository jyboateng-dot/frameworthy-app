import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscribeToAllThreads, subscribeToMessages, sendMessage, markThreadRead, toggleAiAutoReply } from '../../services/chat';
import { Send, MessageCircle, ArrowLeft, Bot, Sparkles, UserCheck } from 'lucide-react';

const ADMIN_EMAIL = 'admin@frameworthyco.com';

const AdminMessagesPage = () => {
    const { user, isLoading: authLoading } = useAuth();
    const [threads, setThreads] = useState([]);
    const [selectedUid, setSelectedUid] = useState(null);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (!user || user.email !== ADMIN_EMAIL) return;
        const unsub = subscribeToAllThreads(setThreads);
        return unsub;
    }, [user]);

    useEffect(() => {
        if (!selectedUid) { setMessages([]); return; }
        const unsub = subscribeToMessages(selectedUid, setMessages);
        markThreadRead(selectedUid, 'admin').catch(() => {});
        return unsub;
    }, [selectedUid]);

    if (authLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>;
    if (!user || user.email !== ADMIN_EMAIL) {
        return <Navigate to="/" replace />;
    }

    const handleSend = async (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || !selectedUid || isSending) return;
        setDraft('');
        setIsSending(true);
        try {
            await sendMessage(selectedUid, text, 'admin');
        } catch (err) {
            console.error('Failed to send reply:', err);
        } finally {
            setIsSending(false);
        }
    };

    const selectedThread = threads.find(t => t.id === selectedUid);
    const isAiEnabled = selectedThread?.aiEnabled !== false;

    const handleToggleAi = async () => {
        if (!selectedUid) return;
        await toggleAiAutoReply(selectedUid, !isAiEnabled);
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pt-24 pb-12 px-4 md:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black mb-1">Customer Support Inbox</h1>
                        <p className="text-gray-500 text-sm">Real-time IM conversations &amp; AI Studio Assistant management</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex h-[75vh]">
                    {/* Thread list */}
                    <div className={`w-full md:w-80 border-r border-gray-200 overflow-y-auto shrink-0 ${selectedUid ? 'hidden md:block' : ''}`}>
                        {threads.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No conversations yet.</div>
                        ) : threads.map(t => {
                            const threadAiOn = t.aiEnabled !== false;
                            const isHumanReq = t.humanRequested;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedUid(t.id)}
                                    className={`w-full text-left px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition ${selectedUid === t.id ? 'bg-amber-50/50' : ''}`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-sm font-bold truncate text-gray-900">{t.userDisplayName || t.userEmail || 'Customer'}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isHumanReq && (
                                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                                    Human Req
                                                </span>
                                            )}
                                            {threadAiOn && <Sparkles size={12} className="text-[#c9a84c]" title="AI Auto-Reply Active" />}
                                            {t.unreadByAdmin && <span className="w-2.5 h-2.5 rounded-full bg-[#c9a84c]" />}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{t.lastMessage}</p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Conversation Detail */}
                    <div className={`flex-1 flex flex-col min-w-0 ${selectedUid ? '' : 'hidden md:flex'}`}>
                        {!selectedUid ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <MessageCircle size={40} className="mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm font-semibold">Select a customer conversation to view or reply</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Conversation Header */}
                                <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between gap-4 shrink-0 bg-stone-50/60">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSelectedUid(null)} className="md:hidden p-1 -ml-1 text-gray-500" aria-label="Back to list">
                                            <ArrowLeft size={18} />
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-gray-900">{selectedThread?.userDisplayName || selectedThread?.userEmail || 'Customer'}</p>
                                                {selectedThread?.humanRequested && (
                                                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                        <UserCheck size={11} /> Human Agent Requested
                                                    </span>
                                                )}
                                            </div>
                                            {selectedThread?.userEmail && <p className="text-xs text-gray-500">{selectedThread.userEmail}</p>}
                                        </div>
                                    </div>

                                    {/* AI AUTO-REPLY TOGGLE */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1">
                                            <Bot size={14} className={isAiEnabled ? 'text-[#c9a84c]' : 'text-gray-400'} /> AI Auto-Reply
                                        </span>
                                        <button
                                            onClick={handleToggleAi}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                                                isAiEnabled 
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                                    : 'bg-gray-200 text-gray-700 border border-gray-300'
                                            }`}
                                        >
                                            {isAiEnabled ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                </div>

                                {/* Message Stream */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-50/30">
                                    {messages.map(m => {
                                        const isAdmin = m.senderRole === 'admin';
                                        const isAssistant = m.senderRole === 'assistant';

                                        return (
                                            <div key={m.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                                                {isAssistant && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#b08e33] mb-1 flex items-center gap-1">
                                                        <Bot size={11} /> AI Studio Assistant
                                                    </span>
                                                )}
                                                {isAdmin && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                                        Human Admin
                                                    </span>
                                                )}
                                                <div
                                                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                                        isAdmin
                                                            ? 'bg-stone-900 text-white font-medium rounded-br-none'
                                                            : isAssistant
                                                            ? 'bg-amber-50 border border-amber-200 text-stone-900 font-medium rounded-bl-none shadow-sm'
                                                            : 'bg-white border border-gray-200 text-gray-900 font-normal rounded-bl-none shadow-sm'
                                                    }`}
                                                >
                                                    {m.text}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Admin Reply Form */}
                                <form onSubmit={handleSend} className="p-3.5 border-t border-gray-200 flex items-center gap-2 shrink-0 bg-white">
                                    <input
                                        type="text"
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        placeholder="Type human admin reply..."
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none text-sm font-medium"
                                    />
                                    <button type="submit" disabled={!draft.trim() || isSending} className="p-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold disabled:opacity-40 transition">
                                        <Send size={16} />
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminMessagesPage;
