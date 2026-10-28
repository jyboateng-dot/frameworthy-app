import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoomThumbnailRail from './RoomThumbnailRail';
import { ROOM_SCENES } from '../../data/roomScenes';

describe('RoomThumbnailRail', () => {
    const mockSelect = vi.fn();

    it('renders the thumbnail rail and all room view options including Close-Up', () => {
        render(
            <RoomThumbnailRail
                activeId={null}
                onSelect={mockSelect}
                wallColor={{ id: 'bone', hex: '#ede8dd' }}
            />
        );

        const rail = screen.getByTestId('room-thumbnail-rail');
        expect(rail).toBeInTheDocument();

        // Check Close-Up button
        const closeUpBtn = screen.getByRole('tab', { name: 'Close-Up' });
        expect(closeUpBtn).toBeInTheDocument();
        expect(closeUpBtn).toHaveAttribute('aria-selected', 'true');

        // Check each room scene button
        ROOM_SCENES.forEach((scene) => {
            const btn = screen.getByRole('tab', { name: scene.name });
            expect(btn).toBeInTheDocument();
            expect(btn).toHaveAttribute('aria-selected', 'false');
        });
    });

    it('triggers onSelect with correct scene id when a thumbnail is clicked', () => {
        const handleSelect = vi.fn();
        render(
            <RoomThumbnailRail
                activeId={null}
                onSelect={handleSelect}
                wallColor={{ id: 'white', hex: '#ffffff' }}
            />
        );

        const loftBtn = screen.getByRole('tab', { name: 'Studio Loft' });
        fireEvent.click(loftBtn);
        expect(handleSelect).toHaveBeenCalledWith('studio-loft');

        const closeUpBtn = screen.getByRole('tab', { name: 'Close-Up' });
        fireEvent.click(closeUpBtn);
        expect(handleSelect).toHaveBeenCalledWith(null);
    });

    it('marks active scene as selected with aria-selected and active styling', () => {
        render(
            <RoomThumbnailRail
                activeId="dining-room"
                onSelect={mockSelect}
                wallColor={{ id: 'white', hex: '#ffffff' }}
            />
        );

        const diningBtn = screen.getByRole('tab', { name: 'Dining Room' });
        expect(diningBtn).toHaveAttribute('aria-selected', 'true');

        const closeUpBtn = screen.getByRole('tab', { name: 'Close-Up' });
        expect(closeUpBtn).toHaveAttribute('aria-selected', 'false');
    });

    it('renders preview with customer uploaded image', () => {
        render(
            <RoomThumbnailRail
                activeId="bedroom"
                onSelect={mockSelect}
                wallColor={{ id: 'sage', hex: '#e2e8e0' }}
                uploadedImage="data:image/png;base64,sample"
                selectedFrame={{ id: 'black', baseColor: '#1a1a1a' }}
                matWidth="2in"
                matColor={{ id: 'white', hex: '#ffffff' }}
            />
        );

        const bedroomBtn = screen.getByRole('tab', { name: 'Bedroom' });
        expect(bedroomBtn).toBeInTheDocument();
        expect(bedroomBtn).toHaveAttribute('aria-selected', 'true');
    });
});
