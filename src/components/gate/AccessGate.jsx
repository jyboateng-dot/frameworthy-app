import React, { useState } from 'react';

const ACCESS_CODE = import.meta.env.VITE_TESTER_ACCESS_CODE;

const AccessGate = ({ onUnlock }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (code.trim().length > 0 && code.trim() === ACCESS_CODE) {
            onUnlock();
        } else {
            setError(true);
        }
    };

    return (
        <div className="min-h-screen bg-[#faf9f8] text-stone-900 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-center gap-0.5 mb-8">
                    <div className="w-9 h-9 border-4 border-double border-stone-900 rounded-[1px] flex items-center justify-center">
                        <span className="text-2xl font-serif font-bold text-stone-900 leading-none pb-1">Fr</span>
                    </div>
                    <span className="text-2xl font-serif font-bold tracking-tight text-stone-900 leading-none">ameWorthy</span>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6 sm:p-8">
                    <h1 className="text-lg font-bold text-stone-900 text-center mb-1.5">Private Preview</h1>
                    <p className="text-sm text-stone-500 text-center mb-6 leading-relaxed">
                        FrameWorthy is currently in private testing. Enter the access code you were given to continue.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <input
                            type="password"
                            value={code}
                            onChange={(e) => { setCode(e.target.value); setError(false); }}
                            placeholder="Access code"
                            autoFocus
                            className={`w-full bg-stone-50 border rounded-lg px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 transition ${
                                error ? 'border-red-400 focus:ring-red-400' : 'border-stone-200 focus:ring-stone-900/30 focus:border-stone-900/40'
                            }`}
                        />
                        {error && (
                            <p className="text-xs text-red-500 mt-2">That code isn't right. Double-check and try again.</p>
                        )}

                        <button
                            type="submit"
                            className="w-full mt-4 bg-stone-900 text-white font-semibold rounded-lg py-3 hover:bg-stone-800 active:bg-stone-950 transition"
                        >
                            Continue
                        </button>
                    </form>
                </div>

                <p className="text-xs text-stone-400 text-center mt-6">
                    Don't have a code? This site isn't open to the public yet.
                </p>
            </div>
        </div>
    );
};

export default AccessGate;
