import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FrameSelectionModal from './FrameSelectionModal';
import { FRAME_STYLES } from '../data/constants';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('limits the curated picker to fulfilment categories and selects a finish without exposing the supplier', () => {
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
        const onSelect = vi.fn();
        const onClose = vi.fn();
        const props = { isOpen: true, onSelect, onClose };
        const { unmount } = render(<FrameSelectionModal {...props} selectedFrame={{ id: 'frame-83735', category: 'Textured & Decorative' }} />);
        expect(screen.getByRole('button', { name: 'Classic Frames' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByText(/Prodigi/i)).not.toBeInTheDocument();
        expect(screen.getAllByRole('button').filter(button => button.hasAttribute('aria-pressed'))).toHaveLength(7);
        fireEvent.click(screen.getByRole('button', { name: 'Box Frames' }));
        fireEvent.click(screen.getByRole('button', { name: /Black/ }));
        const selected = FRAME_STYLES.find(frame => frame.id === 'prodigi-box-black');
        expect(onSelect).toHaveBeenCalledWith(selected);
        expect(onClose).toHaveBeenCalledOnce();
        unmount();
        render(<FrameSelectionModal {...props} selectedFrame={selected} />);
        expect(screen.getByRole('button', { name: 'Box Frames' })).toHaveAttribute('aria-pressed', 'true');
    } finally {
        HTMLElement.prototype.scrollIntoView = original;
    }
});

it('presents fulfilment finishes as selectable cards in the shared curated collection', () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<FrameSelectionModal isOpen onSelect={onSelect} onClose={onClose} selectedFrame={{ id: 'frame-8446' }} />);

    expect(screen.getByRole('heading', { name: 'Frame Catalogue' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Classic Frames' }));
    expect(screen.getByText(/Solid, satin-laminated wood with a 20 mm face and 22 mm depth/)).toBeInTheDocument();
    const classicBlack = screen.getByRole('button', { name: /Black/ });
    expect(classicBlack.querySelector('img')).toHaveAttribute('src', expect.stringContaining('classic-black.png'));
    expect(classicBlack).not.toHaveTextContent(/depth/i);
    expect(classicBlack).toHaveTextContent('From £32');
    fireEvent.click(screen.getByRole('button', { name: 'Box Frames' }));
    expect(screen.getByText(/clean, contemporary shadow-line look/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Black/ })).not.toHaveTextContent(/depth/i);
    expect(screen.getByRole('button', { name: /Black/ })).toHaveTextContent('From £38');
    fireEvent.click(screen.getByRole('button', { name: 'Classic Frames' }));
    fireEvent.click(screen.getByRole('button', { name: /Black/ }));
    expect(onSelect).toHaveBeenCalledWith(FRAME_STYLES.find(frame => frame.id === 'prodigi-classic-black'));
    expect(onClose).toHaveBeenCalledOnce();
});
