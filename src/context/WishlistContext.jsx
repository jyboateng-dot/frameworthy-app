import React, { createContext, useContext, useState, useEffect } from 'react';

const WishlistContext = createContext();
const WISHLIST_STORAGE_KEY = 'frameworthy_wishlist';

export function useWishlist() {
    return useContext(WishlistContext);
}

export const WishlistProvider = ({ children }) => {
    // Load initial wishlist from localStorage
    const [wishlistItems, setWishlistItems] = useState(() => {
        try {
            const localData = localStorage.getItem(WISHLIST_STORAGE_KEY);
            return localData ? JSON.parse(localData) : [];
        } catch (error) {
            console.error("Failed to load wishlist from local storage", error);
            return [];
        }
    });

    // Save wishlist to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
        } catch (error) {
            console.error("Failed to save wishlist to local storage", error);
        }
    }, [wishlistItems]);

    // Same cross-tab race as CartContext: without this, two open tabs each
    // hold a stale in-memory copy and one tab's wishlist add/remove can get
    // silently overwritten by the other tab's next write. Re-sync from
    // localStorage whenever another tab changes it.
    useEffect(() => {
        const handleStorage = (e) => {
            if (e.key !== WISHLIST_STORAGE_KEY) return;
            try {
                setWishlistItems(e.newValue ? JSON.parse(e.newValue) : []);
            } catch (error) {
                console.error("Failed to sync wishlist from another tab", error);
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Check if an item is in the wishlist
    const isInWishlist = (productId) => {
        return wishlistItems.some(item => item.id === productId);
    };

    // Toggle wishlist status
    const toggleWishlist = (product) => {
        setWishlistItems(prev => {
            if (prev.some(item => item.id === product.id)) {
                return prev.filter(item => item.id !== product.id);
            } else {
                return [...prev, product];
            }
        });
    };

    // Remove from wishlist by ID
    const removeFromWishlist = (productId) => {
        setWishlistItems(prev => prev.filter(item => item.id !== productId));
    };

    // Clear wishlist
    const clearWishlist = () => {
        setWishlistItems([]);
    };

    const value = {
        wishlistItems,
        wishlistCount: wishlistItems.length,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist
    };

    return (
        <WishlistContext.Provider value={value}>
            {children}
        </WishlistContext.Provider>
    );
};
