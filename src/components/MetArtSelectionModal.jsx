import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MetArtPage from '../pages/MetArtPage';

export default function MetArtSelectionModal({ isOpen, onClose, onSelect }) {
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget && onClose) onClose();
            }}
        >
            <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
                {/* Close button */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 z-10 p-2 bg-stone-50 hover:bg-stone-100 text-stone-500 rounded-full transition-colors"
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>
                <div className="flex-1 overflow-y-auto overscroll-y-contain">
                    <MetArtPage isSubPage={true} onSelect={onSelect} navigate={navigate} />
                </div>
            </div>
        </div>
    );
}
