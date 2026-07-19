import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { WishlistProvider, useWishlist } from './WishlistContext';

const wrapper = ({ children }) => <WishlistProvider>{children}</WishlistProvider>;

describe('WishlistContext', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts empty when localStorage has nothing saved', () => {
        const { result } = renderHook(() => useWishlist(), { wrapper });
        expect(result.current.wishlistItems).toEqual([]);
        expect(result.current.wishlistCount).toBe(0);
    });

    it('falls back to an empty wishlist when saved data is corrupt JSON', () => {
        localStorage.setItem('frameworthy_wishlist', '{not valid json');
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result } = renderHook(() => useWishlist(), { wrapper });
        expect(result.current.wishlistItems).toEqual([]);
        errSpy.mockRestore();
    });

    it('toggleWishlist adds a product not already present', () => {
        const { result } = renderHook(() => useWishlist(), { wrapper });
        act(() => {
            result.current.toggleWishlist({ id: 'p1', name: 'Frame' });
        });
        expect(result.current.wishlistItems).toHaveLength(1);
        expect(result.current.isInWishlist('p1')).toBe(true);
    });

    it('toggleWishlist removes a product already present', () => {
        const { result } = renderHook(() => useWishlist(), { wrapper });
        act(() => {
            result.current.toggleWishlist({ id: 'p1', name: 'Frame' });
        });
        act(() => {
            result.current.toggleWishlist({ id: 'p1', name: 'Frame' });
        });
        expect(result.current.wishlistItems).toHaveLength(0);
        expect(result.current.isInWishlist('p1')).toBe(false);
    });

    it('isInWishlist returns false for a product never added', () => {
        const { result } = renderHook(() => useWishlist(), { wrapper });
        expect(result.current.isInWishlist('missing')).toBe(false);
    });

    it('removeFromWishlist removes only the targeted product by id', () => {
        const { result } = renderHook(() => useWishlist(), { wrapper });
        act(() => {
            result.current.toggleWishlist({ id: 'p1' });
            result.current.toggleWishlist({ id: 'p2' });
        });
        act(() => {
            result.current.removeFromWishlist('p1');
        });
        expect(result.current.wishlistItems).toEqual([{ id: 'p2' }]);
    });

    it('wishlistCount reflects the number of items, not quantity', () => {
        const { result } = renderHook(() => useWishlist(), { wrapper });
        act(() => {
            result.current.toggleWishlist({ id: 'p1' });
            result.current.toggleWishlist({ id: 'p2' });
        });
        expect(result.current.wishlistCount).toBe(2);
    });

    it('clearWishlist empties the list', () => {
        const { result } = renderHook(() => useWishlist(), { wrapper });
        act(() => {
            result.current.toggleWishlist({ id: 'p1' });
        });
        act(() => {
            result.current.clearWishlist();
        });
        expect(result.current.wishlistItems).toEqual([]);
    });

    it('persists changes to localStorage', () => {
        const { result } = renderHook(() => useWishlist(), { wrapper });
        act(() => {
            result.current.toggleWishlist({ id: 'p1' });
        });
        const stored = JSON.parse(localStorage.getItem('frameworthy_wishlist'));
        expect(stored).toEqual([{ id: 'p1' }]);
    });
});
