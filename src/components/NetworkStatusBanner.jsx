import React, { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { WifiOff } from 'lucide-react';

// Shows a small dismissible-by-reconnect banner when the device loses its
// network connection — most of the app (checkout, catalogue browsing,
// image uploads) needs a live connection, so a silent failure elsewhere
// is a worse experience than telling the user why up front. Network's web
// implementation just wraps navigator.onLine, so this works in a browser too.
const NetworkStatusBanner = () => {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        let listenerHandle;

        Network.getStatus().then((status) => setIsOffline(!status.connected));

        Network.addListener('networkStatusChange', (status) => {
            setIsOffline(!status.connected);
        }).then((listener) => { listenerHandle = listener; });

        return () => { listenerHandle?.remove(); };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-[#0a0a0a] text-[#e8e2d9] text-xs font-medium flex items-center justify-center gap-2 py-2 px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
            <WifiOff size={14} />
            You're offline — some features won't work until you reconnect.
        </div>
    );
};

export default NetworkStatusBanner;
