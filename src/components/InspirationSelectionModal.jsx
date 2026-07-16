import React from 'react';
import { X } from 'lucide-react';
import InspirationPage from '../pages/InspirationPage';

export default function InspirationSelectionModal({
    isOpen,
    onClose,
    onApplySelection,
    setSelectedFrame,
    setSelectedSize
}) {
    if (!isOpen) return null;

    // The Inspiration subpages call navigate('/frame/customize', { state })
    // exactly as they do on the standalone /inspiration route. Instead of a
    // real navigation, forward the whole state object to the SAME handler the
    // real-navigation path uses (applyInspirationSelection in
    // CustomizeFramePage) — one interpretation of a selection, shared by every
    // entry point, so the two can't drift apart again.
    const mockNavigate = (path, options) => {
        if (options && options.state) {
            onApplySelection(options.state);
        }
        onClose();
    };

    // Dummy setter since modal doesn't need to actually set product mode in app state yet
    // (mockNavigate does everything)
    const mockSetProductMode = () => {};

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#faf9f8] rounded-xl shadow-2xl w-full max-w-6xl h-full md:max-h-[90vh] flex flex-col overflow-hidden relative animate-scale-up">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-50 p-2.5 bg-[#faf9f8] border border-stone-200 hover:bg-white rounded-full transition-all text-stone-500 hover:text-stone-900 shadow-sm"
                >
                    <X size={20} strokeWidth={2.5} />
                </button>

                {/* Subpage content, completely taking over the modal content area */}
                <div className="flex-1 overflow-y-auto w-full relative">
                    <InspirationPage
                        isModal={true}
                        navigate={mockNavigate}
                        setProductMode={mockSetProductMode}
                        setSelectedFrame={setSelectedFrame}
                        setSelectedSize={setSelectedSize}
                    />
                </div>
            </div>
        </div>
    );
}
