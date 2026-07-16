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
        <div className="min-h-screen bg-fw-dark flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-center gap-0.5 mb-8">
                    <div className="w-9 h-9 border-4 border-double border-fw-text rounded-[1px] flex items-center justify-center">
                        <span className="text-2xl font-serif font-bold text-fw-text leading-none pb-1">Fr</span>
                    </div>
                    <span className="text-2xl font-serif font-bold tracking-tight text-fw-text leading-none">ameWorthy</span>
                </div>

                <div className="bg-fw-card border border-white/[0.07] rounded-xl p-6 sm:p-8">
                    <h1 className="text-lg font-serif font-bold text-fw-text text-center mb-1.5">Private Preview</h1>
                    <p className="text-sm text-fw-muted text-center mb-6 leading-relaxed">
                        FrameWorthy is currently in private testing. Enter the access code you were given to continue.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <input
                            type="password"
                            value={code}
                            onChange={(e) => { setCode(e.target.value); setError(false); }}
                            placeholder="Access code"
                            autoFocus
                            className={`w-full bg-fw-surface border rounded-lg px-4 py-3 text-base text-fw-text placeholder:text-fw-dim focus:outline-none focus:ring-1 transition ${
                                error ? 'border-red-500/60 focus:ring-red-500/60' : 'border-white/10 focus:ring-fw-gold/60 focus:border-fw-gold/60'
                            }`}
                        />
                        {error && (
                            <p className="text-xs text-red-400 mt-2">That code isn't right. Double-check and try again.</p>
                        )}

                        <button
                            type="submit"
                            className="w-full mt-4 bg-fw-gold text-fw-dark font-semibold rounded-lg py-3 hover:brightness-110 active:brightness-95 transition"
                        >
                            Continue
                        </button>
                    </form>
                </div>

                <p className="text-xs text-fw-dim text-center mt-6">
                    Don't have a code? This site isn't open to the public yet.
                </p>
            </div>
        </div>
    );
};

export default AccessGate;
