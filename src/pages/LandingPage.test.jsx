import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';
import { framesForCategory, PRODIGI_FRAME_CATEGORIES } from '../data/frameBrowsing';
import { CAROUSEL_SLIDES } from '../data/landingCarouselSlides';

afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
});

describe('home catalogue and carousel', () => {
    it('shows the seven fulfilment categories without exposing the supplier and selects the chosen finish', () => {
        const setSelectedFrame = vi.fn();
        const navigate = vi.fn();
        render(<LandingPage setSelectedFrame={setSelectedFrame} navigate={navigate} />);
        expect(screen.getByText(/Explore made-to-order frames and canvases/)).toBeInTheDocument();
        expect(screen.queryByText(/Prodigi/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Classic Frames' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText(/Solid, satin-laminated wood with a 20 mm face and 22 mm depth/)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Black' })).toBeInTheDocument();
        expect(screen.getAllByText('From £32').length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button').filter(button => button.hasAttribute('aria-pressed'))).toHaveLength(7);
        fireEvent.click(screen.getByRole('button', { name: 'Float Framed Canvas' }));
        expect(screen.getByText(/subtle shadow gap and floating effect/)).toBeInTheDocument();
        const floatFrames = framesForCategory(PRODIGI_FRAME_CATEGORIES[4]);
        fireEvent.click(screen.getByRole('heading', { name: /Natural/ }));
        expect(setSelectedFrame).toHaveBeenCalledWith(floatFrames.find(frame => frame.id.endsWith('-natural')));
        expect(navigate).toHaveBeenCalledWith('/frame/customize');
        fireEvent.click(screen.getByRole('button', { name: 'Classic Framed Canvas', exact: true }));
        expect(screen.getByRole('heading', { name: 'Antique Gold' })).toBeInTheDocument();
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
        expect(onStartFraming).toHaveBeenLastCalledWith(expect.objectContaining({ openMetArt: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
        fireEvent.click(screen.getByRole('button', { name: 'Start Framing' }));
        expect(onStartFraming).toHaveBeenLastCalledWith({});
    });

    it('auto-advances slides periodically when not paused', () => {
        vi.useFakeTimers();
        try {
            render(<LandingPage />);
            expect(screen.getByText(/01\s*—\s*15/)).toBeInTheDocument();
            act(() => {
                vi.advanceTimersByTime(5100);
            });
            expect(screen.getByText(/02\s*—\s*15/)).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('phone home page', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    const renderOnPhone = (props) => {
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: query === '(max-width: 767px)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        return render(<LandingPage {...props} />);
    };

    it('keeps the phone layout active for the development mobile preview URL', () => {
        window.history.replaceState({}, '', '/?mobile=1');
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        render(<LandingPage />);

        expect(screen.getByRole('heading', { name: 'Frame moments that matter' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Next slide' })).not.toBeInTheDocument();
    });

    it('shows the phone layout with its starting points and swipeable frame rail', () => {
        const onStartFraming = vi.fn();
        const navigate = vi.fn();
        const setSelectedFrame = vi.fn();
        renderOnPhone({ onStartFraming, navigate, setSelectedFrame });
        expect(screen.getByRole('heading', { name: 'Frame moments that matter' })).toBeInTheDocument();
        expect(screen.getByText(/Turn cherished memories into frames made for your home/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Next slide' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Prodigi/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Browse Museum Art' }));
        expect(navigate).toHaveBeenCalledWith('/curated-art');

        const hero = screen.getByRole('heading', { name: 'Frame moments that matter' }).closest('section');
        fireEvent.touchStart(hero, { touches: [{ clientX: 300 }] });
        fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 100 }] });
        expect(screen.getByRole('heading', { name: 'Upload from Anywhere' })).toBeInTheDocument();
        expect(screen.getByText(/Upload photos from your phone/i)).toBeInTheDocument();

        fireEvent.touchStart(hero, { touches: [{ clientX: 300 }] });
        fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 100 }] });
        expect(screen.getByRole('heading', { name: 'Make Every Detail Yours' })).toBeInTheDocument();
        expect(screen.getByText(/Customise frames, mounts and sizes/i)).toBeInTheDocument();

        fireEvent.touchStart(hero, { touches: [{ clientX: 300 }] });
        fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 100 }] });
        expect(screen.getByRole('heading', { name: 'See It Live as You Build' })).toBeInTheDocument();
        expect(screen.getByText(/Test mounts and wall colours in the visualizer/i)).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: /Start Framing/ })[0]);
        expect(onStartFraming).toHaveBeenLastCalledWith({});
        fireEvent.click(screen.getByRole('button', { name: /Museum Masterpieces/ }));
        expect(onStartFraming).toHaveBeenLastCalledWith(expect.objectContaining({ openMetArt: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Museum Art' }));
        expect(navigate).toHaveBeenCalledWith('/curated-art');

        expect(screen.getAllByRole('button').filter(button => button.hasAttribute('aria-pressed'))).toHaveLength(7);
        fireEvent.click(screen.getByRole('button', { name: 'Float Framed Canvas' }));
        const floatFrames = framesForCategory(PRODIGI_FRAME_CATEGORIES[4]);
        fireEvent.click(screen.getByRole('heading', { name: /Natural/ }));
        expect(setSelectedFrame).toHaveBeenCalledWith(floatFrames.find(frame => frame.id.endsWith('-natural')));
        expect(navigate).toHaveBeenCalledWith('/frame/customize');
    });
});
