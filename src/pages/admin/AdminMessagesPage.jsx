import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscribeToAllThreads, subscribeToMessages, sendMessage, markThreadRead } from '../../services/chat';
import { Send, MessageCircle, ArrowLeft } from 'lucide-react';

// Mirrors AdminDashboard.jsx's own check — keep these in sync if the admin
// email ever changes.
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

    // --- Access Control (identical to AdminDashboard.jsx) ---
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

    return (
        <div className="min-h-screen bg-gray-50/50 pt-24 pb-12 px-4 md:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-black mb-1">Messages</h1>
                    <p className="text-gray-500">Customer conversations</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex h-[70vh]">
                    {/* Thread list */}
                    <div className={`w-full md:w-80 border-r border-gray-100 overflow-y-auto shrink-0 ${selectedUid ? 'hidden md:block' : ''}`}>
                        {threads.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No conversations yet.</div>
                        ) : threads.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedUid(t.id)}
                                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${selectedUid === t.id ? 'bg-gray-50' : ''}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold truncate">{t.userDisplayName || t.userEmail || 'Customer'}</span>
                                    {t.unreadByAdmin && <span className="w-2 h-2 rounded-full bg-[#c9a84c] shrink-0" />}
                                </div>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{t.lastMessage}</p>
                            </button>
                        ))}
                    </div>

                    {/* Conversation */}
                    <div className={`flex-1 flex flex-col min-w-0 ${selectedUid ? '' : 'hidden md:flex'}`}>
                        {!selectedUid ? (
                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <MessageCircle size={40} className="mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">Select a conversation</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
                                    <button onClick={() => setSelectedUid(null)} className="md:hidden p-1 -ml-1 text-gray-500" aria-label="Back to list">
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div>
                                        <p className="text-sm font-bold">{selectedThread?.userDisplayName || selectedThread?.userEmail || 'Customer'}</p>
                                        {selectedThread?.userEmail && <p className="text-xs text-gray-400">{selectedThread.userEmail}</p>}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {messages.map(m => (
                                        <div key={m.id} className={`flex ${m.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${m.senderRole === 'admin' ? 'bg-stone-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
                                                {m.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
                                    <input
                                        type="text"
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        placeholder="Type a reply..."
                                        className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none text-sm"
                                    />
                                    <button type="submit" disabled={!draft.trim() || isSending} className="p-2.5 rounded-full bg-stone-900 text-white disabled:opacity-40">
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
