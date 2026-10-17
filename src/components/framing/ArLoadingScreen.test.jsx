import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ArLoadingScreen from './ArLoadingScreen';

describe('ArLoadingScreen', () => {
    const mockFrame = {
        name: 'Natural Oak Gallery',
        color: '#d4b28c',
        railWidthIn: 0.8,
    };

    it('renders the Meta-style AR loading screen with coaching cards and privacy notice', () => {
        const onClose = vi.fn();
        render(
            <ArLoadingScreen
                isOpen
                onClose={onClose}
                frame={mockFrame}
                widthIn={12}
                heightIn={16}
                matReveal={{ sideIn: 2, topIn: 2, bottomIn: 2 }}
                matColorHex="#fcfbf9"
                artworkUrl="https://example.com/art.jpg"
                status="loading"
            />
        );

        // Core elements
        expect(screen.getByText(/1:1 Scale AR/i)).toBeInTheDocument();
        expect(screen.getByText(/Preview in your room/i)).toBeInTheDocument();
        expect(screen.getByText(/Crafting precision solid wood moulding…/i)).toBeInTheDocument();

        // Dimensions badge
        expect(screen.getByText(/Natural Oak Gallery/i)).toBeInTheDocument();

        // Spatial coaching cards
        expect(screen.getByText(/Point Camera/i)).toBeInTheDocument();
        expect(screen.getByText(/Step Back/i)).toBeInTheDocument();
        expect(screen.getByText(/Good Light/i)).toBeInTheDocument();

        // Privacy reassurance
        expect(screen.getByText(/Camera feed is used exclusively for live spatial placement/i)).toBeInTheDocument();

        // Cancel button
        const cancelBtn = screen.getByRole('button', { name: /Cancel AR preview/i });
        fireEvent.click(cancelBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles Escape key to close the loading screen', () => {
        const onClose = vi.fn();
        render(
            <ArLoadingScreen
                onClose={onClose}
                frame={mockFrame}
                widthIn={10}
                heightIn={10}
                status="loading"
            />
        );

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('adapts properly to 3D studio viewer mode (isViewerOnly = true)', () => {
        render(
            <ArLoadingScreen
                onClose={vi.fn()}
                frame={mockFrame}
                widthIn={12}
                heightIn={16}
                status="loading"
                isViewerOnly
            />
        );

        expect(screen.getByText(/3D Studio Preview/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Interactive 3D model/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/360° Orbit/i)).toBeInTheDocument();
        expect(screen.getByText(/Pinch & Zoom/i)).toBeInTheDocument();
        expect(screen.getByText(/True Finish/i)).toBeInTheDocument();
    });

    it('renders the error view with retry and return actions when status is error', () => {
        const onClose = vi.fn();
        const onRetry = vi.fn();
        render(
            <ArLoadingScreen
                onClose={onClose}
                onRetry={onRetry}
                frame={mockFrame}
                widthIn={12}
                heightIn={16}
                status="error"
            />
        );

        expect(screen.getByText(/Spatial Preview Unavailable/i)).toBeInTheDocument();
        expect(screen.getByText(/We couldn't connect to the AR camera viewer/i)).toBeInTheDocument();

        const retryBtn = screen.getByRole('button', { name: /Try Again/i });
        fireEvent.click(retryBtn);
        expect(onRetry).toHaveBeenCalledTimes(1);

        const returnBtn = screen.getByRole('button', { name: /Return to Customizer/i });
        fireEvent.click(returnBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
