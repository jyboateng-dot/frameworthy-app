import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MuseumArtPage, { __resetMuseumArtCacheForTests } from './MuseumArtPage';
import { UnitProvider } from '../context/UnitContext';
import { WishlistProvider } from '../context/WishlistContext';
import historicMasterpieces from '../../public/museum-data/historic-masterpieces.json';

describe('MuseumArtPage (Historic Masterpieces)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        __resetMuseumArtCacheForTests();
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

    it('presents all 100 curated masterpieces together without subcategories, paginated and with Available up to on every card', async () => {
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
            expect(screen.getAllByText(/Available up to/i)).toHaveLength(24);
        });

        expect(historicMasterpieces).toHaveLength(100);
        // No artist sub-category filter buttons
        expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();

        // Simulate 400px thumbnail onLoad and verify Available up to never disappears
        const images = screen.getAllByRole('img');
        images.forEach((img) => {
            Object.defineProperty(img, 'naturalWidth', { value: 400, configurable: true });
            Object.defineProperty(img, 'naturalHeight', { value: 320, configurable: true });
            fireEvent.load(img);
        });

        expect(screen.getAllByText(/Available up to/i)).toHaveLength(24);
    });
});
