import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();
const CART_STORAGE_KEY = 'frameworthy_cart';

const loadStoredCart = () => {
    try {
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.warn('Failed to load saved cart, starting empty:', error);
        return [];
    }
};

export const CartProvider = ({ children }) => {
    const [cartCount, setCartCount] = useState(0);
    const [cartItems, setCartItems] = useState(loadStoredCart);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Update cartCount to reflect total quantity across all items — matches
    // CartPage's own "Cart (N)" count, so the header badge and the cart page
    // never disagree about how many items are in the cart.
    useEffect(() => {
        setCartCount(cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0));
    }, [cartItems]);

    // Persist on every change so a refresh or new tab doesn't lose the cart
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
        } catch (error) {
            console.warn('Failed to save cart:', error);
        }
    }, [cartItems]);

    const addToCart = (item) => {
        // Find if identical item exists to just increment quantity
        // For custom frames, this is tricky, so we'll just treat every addition as a unique item for now
        // but initialize with quantity 1 and isSelected true
        const itemWithId = { 
            ...item, 
            id: crypto.randomUUID(),
            quantity: 1,
            isSelected: true 
        };
        setCartItems(prev => [itemWithId, ...prev]);
        setIsCartOpen(true);
    };

    const removeFromCart = (id) => {
        setCartItems(prev => prev.filter(item => item.id !== id));
    };

    // Mirrors functions/pricing.js's server-side bound exactly (integer,
    // 1-100) — without this, a quantity set outside that range (only
    // reachable via devtools/direct context calls, not the +/- buttons,
    // which only ever pass quantity ± 1) would still let Paystack charge
    // for it, but verifyPaystackPayment would then always reject the order
    // as unpriceable, leaving it paid-for but stuck pending forever.
    const updateQuantity = (id, newQuantity) => {
        if (!Number.isInteger(newQuantity) || newQuantity < 1 || newQuantity > 100) return;
        setCartItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantity: newQuantity } : item
        ));
    };

    const toggleItemSelection = (id) => {
        setCartItems(prev => prev.map(item => 
            item.id === id ? { ...item, isSelected: !item.isSelected } : item
        ));
    };

    const toggleAllSelection = (isSelected) => {
        setCartItems(prev => prev.map(item => ({ ...item, isSelected })));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    // Checkout only ever purchases the *selected* items, so clearing the
    // whole cart afterwards would silently delete the unselected ones the
    // customer deliberately left behind for later. Removes just what was
    // actually paid for, by id.
    const removeItems = (ids) => {
        const idSet = new Set(ids);
        setCartItems(prev => prev.filter(item => !idSet.has(item.id)));
    };

    return (
        <CartContext.Provider value={{ 
            cartCount, 
            cartItems, 
            addToCart, 
            removeFromCart,
            updateQuantity,
            toggleItemSelection,
            toggleAllSelection,
            clearCart,
            removeItems,
            isCartOpen,
            setIsCartOpen
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);

