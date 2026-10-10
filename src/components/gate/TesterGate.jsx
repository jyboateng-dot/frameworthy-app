import React, { useState } from 'react';
import AccessGate from './AccessGate';
import ValueCarousel from './ValueCarousel';

const ACCESS_KEY = 'fw_tester_access';
const CAROUSEL_KEY = 'fw_tester_carousel_seen';
// /order-status is public for the same reason as /help: someone following up
// on an order (possibly from a different device than the one they tested on,
// e.g. via their confirmation email) shouldn't be stopped by the tester PIN
// wall. The page itself reveals nothing without a valid order-id + email pair.
const PUBLIC_PATHS = ['/', '/terms', '/privacy', '/refund-policy', '/delivery-policy', '/help', '/order-status'];

const TesterGate = ({ children }) => {
    const isPublicPath = PUBLIC_PATHS.includes(window.location.pathname);
    const isLocalPreview = import.meta.env.DEV && import.meta.env.VITE_SKIP_TESTER_GATE === 'true';
    const [hasAccess, setHasAccess] = useState(() => localStorage.getItem(ACCESS_KEY) === 'granted');
    const [hasSeenCarousel, setHasSeenCarousel] = useState(() => localStorage.getItem(CAROUSEL_KEY) === 'true');

    const handleUnlock = () => {
        localStorage.setItem(ACCESS_KEY, 'granted');
        setHasAccess(true);
    };

    const handleCarouselDone = () => {
        localStorage.setItem(CAROUSEL_KEY, 'true');
        setHasSeenCarousel(true);
    };

    if (isPublicPath || isLocalPreview) return children;

    if (!hasAccess) return <AccessGate onUnlock={handleUnlock} />;
    if (!hasSeenCarousel) return <ValueCarousel onDone={handleCarouselDone} />;
    return children;
};

export default TesterGate;
