import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FrameSelectionModal from './FrameSelectionModal';
import { FRAME_STYLES } from '../data/constants';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('restores a saved selection in its current category, then reopens a featured selection', () => {
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
        const onSelect = vi.fn();
        const onClose = vi.fn();
        const props = { isOpen: true, onSelect, onClose };
        const { unmount } = render(<FrameSelectionModal {...props} selectedFrame={{ id: 'frame-83735', category: 'Textured & Decorative' }} />);
        expect(screen.getByRole('button', { name: 'Glossy Finishes' })).toHaveAttribute('aria-pressed', 'true');
        expect(scrollIntoView).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Featured Frames' }));
        fireEvent.click(screen.getByRole('button', { name: /Flat Black Deep/ }));
        const selected = FRAME_STYLES.find(frame => frame.id === 'frame-8446');
        expect(onSelect).toHaveBeenCalledWith(selected);
        expect(onClose).toHaveBeenCalledOnce();
        unmount();
        render(<FrameSelectionModal {...props} selectedFrame={selected} />);
        expect(screen.getByRole('button', { name: 'Featured Frames' })).toHaveAttribute('aria-pressed', 'true');
    } finally {
        HTMLElement.prototype.scrollIntoView = original;
    }
});
