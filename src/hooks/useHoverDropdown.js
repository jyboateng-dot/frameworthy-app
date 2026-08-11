import { useState, useRef, useEffect, useCallback } from 'react';

const CLOSE_DELAY_MS = 150;

export const isHoverCapable = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

/**
 * Shared open/close state for pill dropdowns: hover-to-open/close on PC
 * (mouse leaving the control is what closes it, not selecting an option),
 * click-to-toggle everywhere else, where selecting an option closes
 * immediately since there's no cursor to "move away".
 */
export const useHoverDropdown = () => {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef(null);

    useEffect(() => () => clearTimeout(closeTimer.current), []);

    const openNow = useCallback(() => { clearTimeout(closeTimer.current); setOpen(true); }, []);
    const closeSoon = useCallback(() => { closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS); }, []);

    const hoverProps = {
        onMouseEnter: () => isHoverCapable() && openNow(),
        onMouseLeave: () => isHoverCapable() && closeSoon(),
    };

    // Call after an option is picked: stays open on hover-capable devices
    // (mouseleave/closeSoon takes over from there), closes immediately elsewhere.
    const closeOnSelect = useCallback(() => {
        if (!isHoverCapable()) setOpen(false);
    }, []);

    return { open, setOpen, hoverProps, closeOnSelect };
};
