import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomizeFramePage from './CustomizeFramePage';
import { DEFAULT_DEMO_IMAGE, FRAME_SIZES, FRAME_STYLES, MAT_COLORS } from '../../data/constants';

if (typeof window !== 'undefined') {
    window.scrollTo = vi.fn();
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
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

describe('CustomizeFramePage mounting', () => {
    it('mounts cleanly on /frame/customize without crashing', () => {
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

        render(
            <MemoryRouter initialEntries={['/frame/customize']}>
                <CustomizeFramePage {...defaultProps} />
            </MemoryRouter>
        );

        expect(screen.getByRole('heading', { name: 'Start Framing' })).toBeInTheDocument();
    });
});
