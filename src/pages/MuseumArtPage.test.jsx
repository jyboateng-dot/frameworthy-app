import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MuseumArtPage from './MuseumArtPage';
import { UnitProvider } from '../context/UnitContext';
import { WishlistProvider } from '../context/WishlistContext';
import historicMasterpieces from '../../public/museum-data/historic-masterpieces.json';

describe('MuseumArtPage (Historic Masterpieces)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (url === '/museum-data/historic-masterpieces.json') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(historicMasterpieces),
                });
            }
            return Promise.reject(new Error(`Unexpected URL: ${url}`));
        }));
    });

    it('loads the 100-piece curated cross-museum Historic Masterpieces collection and filters by artist', async () => {
        const navigate = vi.fn();
        const setProductMode = vi.fn();
        const setSelectedSize = vi.fn();

        render(
            <UnitProvider>
                <WishlistProvider>
                    <MuseumArtPage
                        navigate={navigate}
                        setProductMode={setProductMode}
                        setSelectedSize={setSelectedSize}
                        isSubPage={true}
                        disableWindowScroll={true}
                    />
                </WishlistProvider>
            </UnitProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('A Woman Seated at a Window')).toBeInTheDocument();
        });

        expect(historicMasterpieces).toHaveLength(100);
        expect(screen.getByRole('button', { name: 'Rembrandt van Rijn' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Vincent van Gogh' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Claude Monet' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Vincent van Gogh' }));

        await waitFor(() => {
            expect(screen.getByText('Cypresses')).toBeInTheDocument();
            expect(screen.getByText('Adeline Ravoux')).toBeInTheDocument();
        });
    });
});
