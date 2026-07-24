import React, { useState } from 'react';
import AccessGate from './AccessGate';
import ValueCarousel from './ValueCarousel';

const ACCESS_KEY = 'fw_tester_access';
const CAROUSEL_KEY = 'fw_tester_carousel_seen';
const PUBLIC_PATHS = ['/terms', '/privacy', '/refund-policy', '/delivery-policy', '/help'];

const TesterGate = ({ children }) => {
    const isPublicPath = PUBLIC_PATHS.includes(window.location.pathname);
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

    if (isPublicPath) return children;

    if (!hasAccess) return <AccessGate onUnlock={handleUnlock} />;
    if (!hasSeenCarousel) return <ValueCarousel onDone={handleCarouselDone} />;
    return children;
};

export default TesterGate;
