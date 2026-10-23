import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CropMetricsBar from './CropMetricsBar';
import SmartAlignmentPad from './SmartAlignmentPad';
import DirectCanvasCropper from './DirectCanvasCropper';
import CropStudioModal from './CropStudioModal';
import { frameGeometry, imageCrop, DEFAULT_POSITION, MIN_CROP_DPI } from '../../utils/frameFit';

describe('Cropping Components & Sandbox Suite', () => {
    const mockImageNatural = { w: 2400, h: 3200 };
    const mockSize = { id: '16x20', width: 16, height: 20, label: '16 × 20 in' };
    const mockGeometry = frameGeometry(mockSize, 'portrait', 2, 0.787);
    const mockCrop = imageCrop(mockImageNatural, mockGeometry, DEFAULT_POSITION, MIN_CROP_DPI);
    const mockFrame = {
        id: 'prodigi-classic-black',
        name: 'Classic Black',
        baseColor: '#242321',
        mouldingWidthIn: 0.787
    };

    describe('CropMetricsBar', () => {
        it('renders effective DPI and retained percentage correctly', () => {
            render(
                <CropMetricsBar
                    imageNatural={mockImageNatural}
                    geometry={mockGeometry}
                    crop={mockCrop}
                    position={DEFAULT_POSITION}
                />
            );

            // Aperture width is 16 - 2*2 = 12 inches
            // crop.w is 2400
            // effectiveDpi = Math.round(2400 / 12) = 200 DPI
            expect(screen.getByText(/200 DPI/i)).toBeInTheDocument();
            expect(screen.getByText(/Image Retained/i)).toBeInTheDocument();
            expect(screen.getByText(/Crop Center/i)).toBeInTheDocument();
            expect(screen.getByText(/Zoom Level/i)).toBeInTheDocument();
        });

        it('displays warning when effective DPI falls below minimum print floor', () => {
            const lowResCrop = { ...mockCrop, w: 1200 }; // 1200 / 12 = 100 DPI (< 150)
            render(
                <CropMetricsBar
                    imageNatural={mockImageNatural}
                    geometry={mockGeometry}
                    crop={lowResCrop}
                    position={DEFAULT_POSITION}
                />
            );
            expect(screen.getByText(/Below Print Floor/i)).toBeInTheDocument();
        });
    });

    describe('SmartAlignmentPad (Concept 3)', () => {
        it('renders 9 directional joypad buttons and handles orientation click', () => {
            const onPositionChange = vi.fn();
            render(
                <SmartAlignmentPad
                    image="https://example.com/test.jpg"
                    natural={mockImageNatural}
                    geometry={mockGeometry}
                    position={DEFAULT_POSITION}
                    onPositionChange={onPositionChange}
                />
            );

            // Joypad button Top Left
            const topLeftBtn = screen.getByTitle('Top Left');
            expect(topLeftBtn).toBeInTheDocument();
            fireEvent.click(topLeftBtn);

            expect(onPositionChange).toHaveBeenCalledWith(expect.objectContaining({
                x: 0,
                y: 0
            }));
        });

        it('provides preset chips for portrait headroom', () => {
            const onPositionChange = vi.fn();
            render(
                <SmartAlignmentPad
                    image="https://example.com/test.jpg"
                    natural={mockImageNatural}
                    geometry={mockGeometry}
                    position={DEFAULT_POSITION}
                    onPositionChange={onPositionChange}
                />
            );

            const headroomBtn = screen.getByText('Portrait Headroom');
            expect(headroomBtn).toBeInTheDocument();
            fireEvent.click(headroomBtn);

            expect(onPositionChange).toHaveBeenCalledWith(expect.objectContaining({
                y: 0.22
            }));
        });
    });

    describe('DirectCanvasCropper (Concept 1)', () => {
        it('renders frame, mat, artwork, and HUD controls', () => {
            const onPositionChange = vi.fn();
            render(
                <DirectCanvasCropper
                    image="https://example.com/test.jpg"
                    natural={mockImageNatural}
                    geometry={mockGeometry}
                    position={DEFAULT_POSITION}
                    onPositionChange={onPositionChange}
                    frame={mockFrame}
                    matColor="#faf9f5"
                />
            );

            expect(screen.getByRole('button', { name: /Zoom in/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Zoom out/i })).toBeInTheDocument();
            expect(screen.getByTitle(/Reset to center/i)).toBeInTheDocument();
        });

        it('triggers zoom change on HUD button click', () => {
            const onPositionChange = vi.fn();
            render(
                <DirectCanvasCropper
                    image="https://example.com/test.jpg"
                    natural={mockImageNatural}
                    geometry={mockGeometry}
                    position={{ x: 0.5, y: 0.5, zoom: 1 }}
                    onPositionChange={onPositionChange}
                    frame={mockFrame}
                />
            );

            const zoomInBtn = screen.getByRole('button', { name: /Zoom in/i });
            fireEvent.click(zoomInBtn);
            expect(onPositionChange).toHaveBeenCalledWith(expect.objectContaining({
                zoom: 1.1
            }));
        });
    });

    describe('CropStudioModal (Concept 2)', () => {
        it('does not render when isOpen is false', () => {
            const { container } = render(
                <CropStudioModal
                    isOpen={false}
                    onClose={vi.fn()}
                    onApply={vi.fn()}
                    image="https://example.com/test.jpg"
                    natural={mockImageNatural}
                    geometry={mockGeometry}
                />
            );
            expect(container).toBeEmptyDOMElement();
        });

        it('renders illuminated aperture cutout, presets, and commit action when open', () => {
            const onApply = vi.fn();
            const onClose = vi.fn();
            render(
                <CropStudioModal
                    isOpen={true}
                    onClose={onClose}
                    onApply={onApply}
                    image="https://example.com/test.jpg"
                    natural={mockImageNatural}
                    geometry={mockGeometry}
                    initialPosition={DEFAULT_POSITION}
                />
            );

            expect(screen.getByText('Precision Framing Studio')).toBeInTheDocument();
            expect(screen.getByText('Apply Composition')).toBeInTheDocument();
            expect(screen.getByText('Portrait Headroom')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Apply Composition'));
            expect(onApply).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });
});
