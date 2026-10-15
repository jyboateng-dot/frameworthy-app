import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from './CartContext';

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;

describe('CartContext', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('addToCart returns the new item id so a late result can be attached to it', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        let id;
        act(() => { id = result.current.addToCart({ name: 'frame' }); });
        expect(typeof id).toBe('string');
        expect(result.current.cartItems[0]).toMatchObject({ id, name: 'frame', quantity: 1, isSelected: true });
    });

    it('updateCartItem patches only the matching item', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        let first; let second;
        act(() => { first = result.current.addToCart({ name: 'a', visualizerImage: null }); });
        act(() => { second = result.current.addToCart({ name: 'b', visualizerImage: null }); });
        act(() => result.current.updateCartItem(first, { visualizerImage: 'https://cdn/thumb.jpg' }));
        expect(result.current.cartItems.find((item) => item.id === first).visualizerImage).toBe('https://cdn/thumb.jpg');
        expect(result.current.cartItems.find((item) => item.id === second).visualizerImage).toBeNull();
    });

    it('updateCartItem does not resurrect an item that was removed before the update arrived', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        let id;
        act(() => { id = result.current.addToCart({ name: 'a' }); });
        act(() => result.current.removeFromCart(id));
        act(() => result.current.updateCartItem(id, { visualizerImage: 'https://cdn/late.jpg' }));
        expect(result.current.cartItems).toEqual([]);
    });

    it('updates destination quotes together without losing quantities or unselected items', () => {
        localStorage.setItem('frameworthy_cart', JSON.stringify([
            { id: 'a', quantity: 3, isSelected: true, totalPrice: 20, prodigi: { destinationCountryCode: 'GB' } },
            { id: 'b', quantity: 1, isSelected: false, totalPrice: 30, prodigi: { destinationCountryCode: 'GB' } },
        ]));
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => result.current.updateDeliveryQuotes([{ id: 'a', totalPrice: 18, prodigi: { destinationCountryCode: 'JE' } }]));
        expect(result.current.cartItems[0]).toMatchObject({ quantity: 3, isSelected: true, totalPrice: 18, currency: 'GBP', prodigi: { destinationCountryCode: 'JE' } });
        expect(result.current.cartItems[1]).toMatchObject({ quantity: 1, isSelected: false, totalPrice: 30, prodigi: { destinationCountryCode: 'GB' } });
    });

    it('starts empty when localStorage has no saved cart', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        expect(result.current.cartItems).toEqual([]);
        expect(result.current.cartCount).toBe(0);
    });

    it('loads a previously saved cart from localStorage', () => {
        localStorage.setItem('frameworthy_cart', JSON.stringify([
            { id: 'a', quantity: 2, isSelected: true },
        ]));
        const { result } = renderHook(() => useCart(), { wrapper });
        expect(result.current.cartItems).toHaveLength(1);
    });

    it('falls back to an empty cart when saved data is corrupt JSON', () => {
        localStorage.setItem('frameworthy_cart', '{not valid json');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useCart(), { wrapper });
        expect(result.current.cartItems).toEqual([]);
        warnSpy.mockRestore();
    });

    it('addToCart assigns an id, defaults quantity to 1, and selects the item', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'Frame A' });
        });
        expect(result.current.cartItems).toHaveLength(1);
        const item = result.current.cartItems[0];
        expect(item.id).toBeTruthy();
        expect(item.quantity).toBe(1);
        expect(item.isSelected).toBe(true);
        expect(result.current.isCartOpen).toBe(true);
    });

    it('cartCount sums quantities across all items, not just item count', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
            result.current.addToCart({ name: 'B' });
        });
        const [first] = result.current.cartItems;
        act(() => {
            result.current.updateQuantity(first.id, 3);
        });
        expect(result.current.cartCount).toBe(4); // 3 + 1
    });

    it('removeFromCart removes only the targeted item', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
            result.current.addToCart({ name: 'B' });
        });
        const idToRemove = result.current.cartItems[0].id;
        act(() => {
            result.current.removeFromCart(idToRemove);
        });
        expect(result.current.cartItems).toHaveLength(1);
        expect(result.current.cartItems.find(i => i.id === idToRemove)).toBeUndefined();
    });

    // Checkout buys only the selected items, so it removes exactly those on
    // success. It used to call clearCart(), which wiped the whole cart —
    // silently deleting anything the customer had deselected to buy later.
    it('removeItems removes only the given ids, leaving the rest of the cart intact', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
            result.current.addToCart({ name: 'B' });
            result.current.addToCart({ name: 'C' });
        });
        const [first, , third] = result.current.cartItems;
        act(() => {
            result.current.removeItems([first.id, third.id]);
        });
        expect(result.current.cartItems).toHaveLength(1);
        expect(result.current.cartItems[0].name).toBe('B');
    });

    it('removeItems leaves the cart untouched when given no ids', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
        });
        act(() => {
            result.current.removeItems([]);
        });
        expect(result.current.cartItems).toHaveLength(1);
    });

    it('updateQuantity ignores values below 1', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
        });
        const id = result.current.cartItems[0].id;
        act(() => {
            result.current.updateQuantity(id, 0);
        });
        expect(result.current.cartItems[0].quantity).toBe(1);
    });

    it('updateQuantity ignores values above 100 (matches the server-side cap)', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
        });
        const id = result.current.cartItems[0].id;
        act(() => {
            result.current.updateQuantity(id, 101);
        });
        expect(result.current.cartItems[0].quantity).toBe(1);
    });

    it('updateQuantity ignores non-integer and NaN values', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
        });
        const id = result.current.cartItems[0].id;
        act(() => {
            result.current.updateQuantity(id, 2.5);
        });
        expect(result.current.cartItems[0].quantity).toBe(1);
        act(() => {
            result.current.updateQuantity(id, NaN);
        });
        expect(result.current.cartItems[0].quantity).toBe(1);
    });

    it('updateQuantity accepts a value at the boundary (100)', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
        });
        const id = result.current.cartItems[0].id;
        act(() => {
            result.current.updateQuantity(id, 100);
        });
        expect(result.current.cartItems[0].quantity).toBe(100);
    });

    it('toggleItemSelection flips only the targeted item', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
            result.current.addToCart({ name: 'B' });
        });
        const [second, first] = result.current.cartItems; // addToCart prepends
        act(() => {
            result.current.toggleItemSelection(first.id);
        });
        expect(result.current.cartItems.find(i => i.id === first.id).isSelected).toBe(false);
        expect(result.current.cartItems.find(i => i.id === second.id).isSelected).toBe(true);
    });

    it('toggleAllSelection sets isSelected for every item', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
            result.current.addToCart({ name: 'B' });
        });
        act(() => {
            result.current.toggleAllSelection(false);
        });
        expect(result.current.cartItems.every(i => i.isSelected === false)).toBe(true);
    });

    it('clearCart empties the cart', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
        });
        act(() => {
            result.current.clearCart();
        });
        expect(result.current.cartItems).toEqual([]);
        expect(result.current.cartCount).toBe(0);
    });

    it('persists cart changes to localStorage', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        act(() => {
            result.current.addToCart({ name: 'A' });
        });
        const stored = JSON.parse(localStorage.getItem('frameworthy_cart'));
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('A');
    });
});
