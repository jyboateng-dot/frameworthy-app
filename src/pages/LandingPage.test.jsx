import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';
import { framesForCategory } from '../data/frameBrowsing';
import { CAROUSEL_SLIDES } from '../data/landingCarouselSlides';

afterEach(cleanup);

describe('home catalogue and carousel', () => {
    it('paginates featured frames and resets the page when changing categories', () => {
        const setSelectedFrame = vi.fn();
        const navigate = vi.fn();
        render(<LandingPage setSelectedFrame={setSelectedFrame} navigate={navigate} />);
        const featured = framesForCategory('Featured Frames');
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: featured[0].name })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('heading', { name: featured[12].name }));
        expect(setSelectedFrame).toHaveBeenCalledWith(featured[12]);
        expect(navigate).toHaveBeenCalledWith('/frame/customize');
        fireEvent.click(screen.getByRole('button', { name: 'Canvas', exact: true }));
        expect(screen.getByRole('heading', { name: 'Gallery Wrapped Canvas' })).toBeInTheDocument();
        expect(screen.queryByText('Page 2 of 2')).not.toBeInTheDocument();
    });

    it('exposes only the visible slide action and opens Met art only from its slide', () => {
        const onStartFraming = vi.fn();
        render(<LandingPage onStartFraming={onStartFraming} />);
        expect(screen.getAllByRole('button', { name: 'Start Framing' })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Start Framing' }));
        expect(onStartFraming).toHaveBeenLastCalledWith({});
        // Derived, not hardcoded: this test previously pinned the Met slide to
        // "10 — 13" and broke the moment the deck grew. What it actually cares
        // about is that the Met action belongs to the Met slide and no other.
        const metIndex = CAROUSEL_SLIDES.findIndex(slide => slide.triggersMetArt);
        expect(metIndex).toBeGreaterThan(-1);
        for (let i = 0; i < metIndex; i++) fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
        expect(screen.getByText(`${metIndex + 1} — ${CAROUSEL_SLIDES.length}`)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Start Framing' }));
        expect(onStartFraming).toHaveBeenLastCalledWith({ openMetArt: true });
        fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
        fireEvent.click(screen.getByRole('button', { name: 'Start Framing' }));
        expect(onStartFraming).toHaveBeenLastCalledWith({});
    });
});
