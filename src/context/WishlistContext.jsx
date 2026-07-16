import React, { createContext, useContext, useState, useEffect } from 'react';

const WishlistContext = createContext();

export function useWishlist() {
    return useContext(WishlistContext);
}

export const WishlistProvider = ({ children }) => {
    // Load initial wishlist from localStorage
    const [wishlistItems, setWishlistItems] = useState(() => {
        try {
            const localData = localStorage.getItem('frameworthy_wishlist');
            return localData ? JSON.parse(localData) : [];
        } catch (error) {
            console.error("Failed to load wishlist from local storage", error);
            return [];
        }
    });

    // Save wishlist to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('frameworthy_wishlist', JSON.stringify(wishlistItems));
        } catch (error) {
            console.error("Failed to save wishlist to local storage", error);
        }
    }, [wishlistItems]);

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
