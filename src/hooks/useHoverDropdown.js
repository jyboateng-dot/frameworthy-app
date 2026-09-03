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
    // Attach to the pill+panel's outer wrapper — lets the outside-click
    // listener below tell "inside this dropdown" apart from "anywhere else".
    const containerRef = useRef(null);

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

    // Selecting or tapping anywhere outside the pill/panel collapses it.
    // Matters most on touch devices: there's no hover-out to close it there,
    // so without this the only way to dismiss an open dropdown was picking
    // an option — tapping elsewhere on the page just left it hanging open.
    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [open]);

    return { open, setOpen, hoverProps, closeOnSelect, containerRef };
};
