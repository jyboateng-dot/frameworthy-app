import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import LogoMark from '../common/LogoMark';

const redeemTesterPin = httpsCallable(functions, 'redeemTesterPin');

const ERROR_MESSAGES = {
    invalid: "That PIN isn't valid. Double-check and try again.",
    used: 'That PIN has already been used. Reach out to whoever gave it to you for a new one.',
    default: 'Something went wrong. Please try again.',
};

const AccessGate = ({ onUnlock }) => {
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !pin.trim() || submitting) return;

        setSubmitting(true);
        setError(null);
        try {
            const result = await redeemTesterPin({ name: name.trim(), pin: pin.trim() });
            if (result.data?.success) {
                localStorage.setItem('fw_tester_name', name.trim());
                onUnlock();
            } else {
                setError(ERROR_MESSAGES[result.data?.reason] || ERROR_MESSAGES.default);
            }
        } catch {
            setError(ERROR_MESSAGES.default);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-center gap-2 mb-8">
                    <LogoMark size={36} ink="#1c1917" />
                    <span className="text-2xl font-serif font-bold tracking-tight text-stone-900 leading-none">FrameWorthy</span>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6 sm:p-8">
                    <h1 className="text-lg font-bold text-stone-900 text-center mb-1.5">Private Preview</h1>
                    <p className="text-sm text-stone-500 text-center mb-6 leading-relaxed">
                        FrameWorthy is currently in private testing. Enter your name and the one-time PIN you were given to continue.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <label htmlFor="access-gate-name" className="sr-only">Your name</label>
                        <input
                            id="access-gate-name"
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(null); }}
                            placeholder="Your name"
                            autoFocus
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-900/30 focus:border-stone-900/40 transition mb-3"
                        />

                        <label htmlFor="access-gate-pin" className="sr-only">One-time PIN</label>
                        <input
                            id="access-gate-pin"
                            type="text"
                            value={pin}
                            onChange={(e) => { setPin(e.target.value); setError(null); }}
                            placeholder="One-time PIN"
                            autoCapitalize="characters"
                            className={`w-full bg-stone-50 border rounded-lg px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 transition ${
                                error ? 'border-red-400 focus:ring-red-400' : 'border-stone-200 focus:ring-stone-900/30 focus:border-stone-900/40'
                            }`}
                        />
                        {error && (
                            <p className="text-xs text-red-500 mt-2">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={submitting || !name.trim() || !pin.trim()}
                            className="w-full mt-4 bg-stone-900 text-white font-semibold rounded-lg py-3 hover:bg-stone-800 active:bg-stone-950 transition disabled:opacity-50"
                        >
                            {submitting ? 'Checking…' : 'Continue'}
                        </button>
                    </form>
                </div>

                <p className="text-xs text-stone-400 text-center mt-6 leading-relaxed">
                    Each PIN works once. Need another? Reach out to whoever gave you this one.
                </p>
            </div>
        </div>
    );
};

export default AccessGate;
