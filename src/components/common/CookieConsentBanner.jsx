import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConsentStatus, grantConsent, declineConsent } from '../../services/cookieConsent';

// Shown once, on the first visit that hasn't made a decision yet — hidden
// permanently (via localStorage, see cookieConsent.js) the moment either
// button is pressed.
//
// Gated on the same measurement ID that gates analytics itself
// (firebase.js/ANALYTICS.md): with no ID set, this app sets no tracking
// cookies at all (Firebase Auth's session and the cart/wishlist are
// localStorage, not cookies — see PrivacyPage.jsx), so there's genuinely
// nothing to ask consent for yet. This starts showing automatically the
// moment a measurement ID is configured, no other code change needed.
const ANALYTICS_CONFIGURED = Boolean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);

const CookieConsentBanner = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState(() => getConsentStatus());

    if (!ANALYTICS_CONFIGURED || status) return null;

    const handleAccept = () => {
        grantConsent();
        setStatus('granted');
    };

    const handleDecline = () => {
        declineConsent();
        setStatus('declined');
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-[200] shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-3">
                <p className="text-xs text-stone-600 flex-1 text-center sm:text-left">
                    We use cookies to understand how the site is used and improve it. See our{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/privacy')}
                        className="underline hover:text-stone-900 transition-colors"
                    >
                        Privacy Policy
                    </button>{' '}
                    for details.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleDecline}
                        className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors"
                    >
                        Decline
                    </button>
                    <button
                        type="button"
                        onClick={handleAccept}
                        className="px-4 py-2 text-xs font-bold bg-[#0a0a0a] text-white rounded-full hover:bg-stone-800 transition-colors"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsentBanner;
