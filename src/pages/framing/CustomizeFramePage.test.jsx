import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomizeFramePage from './CustomizeFramePage';
import { DEFAULT_DEMO_IMAGE, FRAME_SIZES, FRAME_STYLES, MAT_COLORS } from '../../data/constants';

if (typeof window !== 'undefined') {
    window.scrollTo = vi.fn();
    window.matchMedia = window.matchMedia || vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    window.Image = class {
        set src(v) {
            this._src = v;
            queueMicrotask(() => this.onload?.());
        }
        get src() { return this._src; }
    };
}

vi.mock('../../context/CartContext', () => ({
    useCart: () => ({
        addToCart: vi.fn(),
        updateCartItem: vi.fn(),
        toggleAllSelection: vi.fn(),
    }),
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        user: null,
    }),
}));

vi.mock('../../context/UnitContext', () => ({
    useUnit: () => ({
        unit: 'in',
        setUnit: vi.fn(),
    }),
}));

vi.mock('../../context/WishlistContext', () => ({
    useWishlist: () => ({
        toggleWishlist: vi.fn(),
        isInWishlist: () => false,
    }),
}));

describe('CustomizeFramePage mounting', () => {
    const defaultProps = {
        uploadedImage: DEFAULT_DEMO_IMAGE,
        setUploadedImage: vi.fn(),
        productionImage: null,
        setProductionImage: vi.fn(),
        selectedFrame: FRAME_STYLES[0],
        setSelectedFrame: vi.fn(),
        selectedSize: FRAME_SIZES[0],
        setSelectedSize: vi.fn(),
        roomSceneId: 'modern-living',
        setRoomSceneId: vi.fn(),
        setTotalPrice: vi.fn(),
        navigate: vi.fn(),
        orientation: 'portrait',
        setOrientation: vi.fn(),
        matColor: MAT_COLORS[0],
        setMatColor: vi.fn(),
        matWidth: 2,
        setMatWidth: vi.fn(),
        glassType: 'standard',
        setGlassType: vi.fn(),
        hardwareType: 'wire',
        setHardwareType: vi.fn(),
        activeLayout: 'single',
        setActiveLayout: vi.fn(),
        collageImages: [],
        setCollageImages: vi.fn(),
        frameThickness: 'standard',
        setFrameThickness: vi.fn(),
        isPreset: false,
        setIsPreset: vi.fn(),
        presetTitle: '',
        setPresetTitle: vi.fn(),
        presetDims: '',
        setPresetDims: vi.fn(),
    };

    it('mounts cleanly on /frame/customize without crashing', () => {
        render(
            <MemoryRouter initialEntries={['/frame/customize']}>
                <CustomizeFramePage {...defaultProps} />
            </MemoryRouter>
        );

        expect(screen.getByRole('heading', { name: 'Start Framing' })).toBeInTheDocument();
    });

    it('navigates back to homepage and restores scroll position when closing Met modal opened from homepage', () => {
        const navigate = vi.fn();
        const scrollToSpy = vi.spyOn(window, 'scrollTo');

        render(
            <MemoryRouter initialEntries={[{ pathname: '/frame/customize', state: { openMetArt: true, returnOnClose: true, returnScrollY: 420, returnTo: '/' } }]}>
                <CustomizeFramePage {...defaultProps} navigate={navigate} />
            </MemoryRouter>
        );

        const closeBtn = screen.getByRole('button', { name: 'Close modal' });
        expect(closeBtn).toBeInTheDocument();
        fireEvent.click(closeBtn);

        expect(navigate).toHaveBeenCalledWith(expect.anything());
        expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ top: 420 }));
    });

    it('keeps size options collapsed by default and allows user to expand and collapse via button', () => {
        render(
            <MemoryRouter initialEntries={['/frame/customize']}>
                <CustomizeFramePage {...defaultProps} />
            </MemoryRouter>
        );

        const moreSizesBtn = screen.getByRole('button', { name: /\+ more sizes/i });
        expect(moreSizesBtn).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /- less sizes/i })).not.toBeInTheDocument();

        // Expanding the list via click
        fireEvent.click(moreSizesBtn);
        const lessSizesBtn = screen.getByRole('button', { name: /- less sizes/i });
        expect(lessSizesBtn).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /\+ more sizes/i })).not.toBeInTheDocument();

        // Collapsing back down
        fireEvent.click(lessSizesBtn);
        expect(screen.getByRole('button', { name: /\+ more sizes/i })).toBeInTheDocument();
    });

    it('keeps size options collapsed and places an external uploaded size in the collapsed list view', () => {
        // Size 24x30 (or 60x80cm) is not part of the standard 12 popular sizes in collapsed view
        const externalSize = { id: '24x30', width: 24, height: 30, label: '24x30"' };

        render(
            <MemoryRouter initialEntries={[{
                pathname: '/frame/customize',
                state: {
                    presetImage: 'https://example.com/art.jpg',
                    presetTitle: 'Museum Art',
                    initialSize: externalSize,
                }
            }]}>
                <CustomizeFramePage
                    {...defaultProps}
                    selectedSize={externalSize}
                />
            </MemoryRouter>
        );

        // Size list MUST remain collapsed
        expect(screen.getByRole('button', { name: /\+ more sizes/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /- less sizes/i })).not.toBeInTheDocument();

        // The external size button is rendered and marked pressed
        const selectedButton = screen.getByRole('button', { name: /24 × 30/i });
        expect(selectedButton).toBeInTheDocument();
        expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders room thumbnail rail to the left of the visualizer on larger screens (desktop)', async () => {
        window.innerWidth = 1200;
        window.dispatchEvent(new Event('resize'));

        const setRoomSceneId = vi.fn();
        render(
            <MemoryRouter initialEntries={['/frame/customize']}>
                <CustomizeFramePage
                    {...defaultProps}
                    roomSceneId={null}
                    setRoomSceneId={setRoomSceneId}
                />
            </MemoryRouter>
        );

        // The thumbnail rail is present on desktop
        const rail = screen.getByTestId('room-thumbnail-rail');
        expect(rail).toBeInTheDocument();

        // Clicking a room thumbnail in the left panel switches scene
        const loftThumb = screen.getByRole('tab', { name: 'Studio Loft' });
        expect(loftThumb).toBeInTheDocument();
        fireEvent.click(loftThumb);
        await waitFor(() => {
            expect(setRoomSceneId).toHaveBeenCalledWith('studio-loft');
        });
    });

    it('does not render room thumbnail rail on mobile/small screens', () => {
        window.innerWidth = 375;
        window.dispatchEvent(new Event('resize'));

        render(
            <MemoryRouter initialEntries={['/frame/customize']}>
                <CustomizeFramePage
                    {...defaultProps}
                    roomSceneId={null}
                />
            </MemoryRouter>
        );

        expect(screen.queryByTestId('room-thumbnail-rail')).not.toBeInTheDocument();
    });
});
