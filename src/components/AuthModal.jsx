import React from 'react';
import { useNavigate } from 'react-router-dom';

const AuthModal = ({ isOpen, onClose, returnTo = '/checkout' }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-6 text-center space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-stone-900 mb-2">Almost there!</h3>
                        <p className="text-sm text-stone-500">Sign in to access more features, or check out as a guest.</p>
                    </div>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`)}
                            className="w-full bg-[#0a0a0a] text-white py-3.5 rounded-full font-bold text-sm hover:bg-stone-800 transition shadow-lg shadow-black/10"
                        >
                            Sign In / Sign Up
                        </button>
                        <button 
                            onClick={() => navigate(returnTo)}
                            className="w-full bg-stone-100 text-stone-800 py-3.5 rounded-full font-bold text-sm hover:bg-stone-200 transition"
                        >
                            Checkout as Guest
                        </button>
                    </div>
                    
                    <button 
                        onClick={onClose}
                        className="text-xs font-bold text-stone-400 hover:text-stone-600 underline underline-offset-2"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
