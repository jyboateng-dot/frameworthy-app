import React from 'react';
import { Check } from 'lucide-react';

const SuccessPage = ({ productMode, setProductMode, navigate }) => {
    return (
        <div className="min-h-screen bg-[#0e0e0e] flex flex-col items-center justify-center p-8 text-center animate-fade-in-up">
            <div className="w-20 h-20 bg-[#25d366]/15 text-[#25d366] rounded-full flex items-center justify-center mb-6 shadow-sm">
                <Check size={40} strokeWidth={3} />
            </div>
            <h2 className="text-4xl font-serif font-bold mb-4 text-[#e8e2d9]">Order Confirmed!</h2>
            <p className="text-[#9a8e7d] text-lg max-w-md mb-8">
                Your custom {productMode === 'frame' ? 'frame' : 'photo book'} is being crafted. You will receive an email shortly with tracking details.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={() => { setProductMode(null); navigate('/'); }} className="w-full py-3 bg-[#c9a84c] text-[#0a0808] rounded-full font-bold shadow-lg hover:scale-[1.02] transition">
                    Back to Home
                </button>
                <button className="w-full py-3 text-[#5a5248] hover:text-[#c9a84c] transition">
                    View Order Status
                </button>
            </div>
        </div>
    );
};

export default SuccessPage;
