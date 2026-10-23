import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FrameFitPanel from './FrameFitPanel';
import { DEFAULT_POSITION } from '../../utils/frameFit';

describe('FrameFitPanel', () => {
    const defaultProps = {
        image: 'https://images.example.com/art.jpg',
        natural: { w: 3000, h: 2000 },
        // 12x18 in landscape -> width: 18, height: 12
        size: { width: 12, height: 18, label: '12x18' },
        orientation: 'landscape',
        mat: 'none',
        rail: 1,
        frame: { id: 'classic-black', baseColor: '#1a1a1a' },
        matColor: '#ffffff',
        unit: 'in',
        position: { x: 0.5, y: 0.5, zoom: 1 },
        onPosition: vi.fn(),
        onApply: vi.fn(),
        error: '',
        price: 150,
        matPrice: 20,
        step: 4,
        minimumDpi: 75,
    };

    it('renders the Zoom, Horizontal, and Vertical sliders with formatted badges', () => {
        render(<FrameFitPanel {...defaultProps} />);

        expect(screen.getByRole('slider', { name: 'Zoom artwork' })).toBeInTheDocument();
        expect(screen.getByRole('slider', { name: 'Horizontal position' })).toBeInTheDocument();
        expect(screen.getByRole('slider', { name: 'Vertical position' })).toBeInTheDocument();

        expect(screen.getByText('1.00×')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Center horizontally' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Center vertically' })).toBeInTheDocument();
    });

    it('calls onPosition with updated zoom when moving the zoom slider', () => {
        const onPosition = vi.fn();
        render(<FrameFitPanel {...defaultProps} onPosition={onPosition} />);

        const zoomSlider = screen.getByRole('slider', { name: 'Zoom artwork' });
        fireEvent.change(zoomSlider, { target: { value: '1.5' } });

        expect(onPosition).toHaveBeenCalledWith({
            x: 0.5,
            y: 0.5,
            zoom: 1.5,
        });
    });

    it('auto-nudges zoom when dragging horizontal pan at zoom 1 with 0 overflow', () => {
        const onPosition = vi.fn();
        // 18x12 aspect ratio matches 3000x2000 exactly -> 0 overflow at zoom 1
        render(<FrameFitPanel {...defaultProps} onPosition={onPosition} />);

        const horizontalSlider = screen.getByRole('slider', { name: 'Horizontal position' });
        fireEvent.change(horizontalSlider, { target: { value: '0.2' } });

        // Auto-nudges zoom to 1.15 so the image visibly moves on screen
        expect(onPosition).toHaveBeenCalledWith({
            x: 0.2,
            y: 0.5,
            zoom: 1.15,
        });
    });

    it('auto-nudges zoom when dragging vertical pan at zoom 1 with 0 overflow', () => {
        const onPosition = vi.fn();
        render(<FrameFitPanel {...defaultProps} onPosition={onPosition} />);

        const verticalSlider = screen.getByRole('slider', { name: 'Vertical position' });
        fireEvent.change(verticalSlider, { target: { value: '0.8' } });

        expect(onPosition).toHaveBeenCalledWith({
            x: 0.5,
            y: 0.8,
            zoom: 1.15,
        });
    });

    it('provides quick action buttons for Center, Fit (1.0×), and zoom presets', () => {
        const onPosition = vi.fn();
        render(<FrameFitPanel {...defaultProps} position={{ x: 0.2, y: 0.3, zoom: 1.8 }} onPosition={onPosition} />);

        // Center button
        fireEvent.click(screen.getByRole('button', { name: 'Center artwork' }));
        expect(onPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 0.5, y: 0.5 }));

        // Fit (1.0x) button
        fireEvent.click(screen.getByRole('button', { name: 'Fit (1.0×)' }));
        expect(onPosition).toHaveBeenCalledWith(expect.objectContaining({ zoom: 1 }));

        // Reset button in header
        fireEvent.click(screen.getByRole('button', { name: 'Reset image position' }));
        expect(onPosition).toHaveBeenCalledWith(DEFAULT_POSITION);
    });

    it('renders the Clean Historical Borders banner and toggles trim state when clicked', () => {
        const onToggleTrim = vi.fn();
        const cleanFrameInsets = { top: 0.04, bottom: 0.04, left: 0.03, right: 0.03 };

        const { rerender } = render(
            <FrameFitPanel
                {...defaultProps}
                cleanFrameInsets={cleanFrameInsets}
                trimFrameEdges={true}
                onToggleTrim={onToggleTrim}
            />
        );

        expect(screen.getByText('Clean Historical Borders')).toBeInTheDocument();
        expect(screen.getByText(/Auto-trimmed 4% leftover frame edge/i)).toBeInTheDocument();

        const toggleBtn = screen.getByRole('button', { name: 'Disable edge trim' });
        expect(toggleBtn).toHaveTextContent('Trimmed');
        fireEvent.click(toggleBtn);
        expect(onToggleTrim).toHaveBeenCalledWith(false);

        // When trim is disabled
        rerender(
            <FrameFitPanel
                {...defaultProps}
                cleanFrameInsets={cleanFrameInsets}
                trimFrameEdges={false}
                onToggleTrim={onToggleTrim}
            />
        );

        expect(screen.getByText('Showing original with vintage framing')).toBeInTheDocument();
        const enableBtn = screen.getByRole('button', { name: 'Enable edge trim' });
        expect(enableBtn).toHaveTextContent('Show Original');
        fireEvent.click(enableBtn);
        expect(onToggleTrim).toHaveBeenCalledWith(true);
    });
});
