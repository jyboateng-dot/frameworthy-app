import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    updateProfile,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, appleProvider, functions } from '../services/firebase';
import { logClientError } from '../services/errorLogging';

const AUTH_RETURN_TO_KEY = 'fw_auth_return_to';

const sendPasswordResetLink = httpsCallable(functions, 'sendPasswordResetLink');

const AuthContext = createContext();



export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [redirectReturnTo, setRedirectReturnTo] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsLoading(false);
        });
        return unsubscribe;
    }, []);

    // Native apps (Capacitor) can't use signInWithPopup — Google deliberately
    // blocks its OAuth consent screen from loading inside an embedded
    // WebView. googleLogin/appleLogin below fall back to signInWithRedirect
    // there instead, which navigates the whole app away to Google and back
    // rather than opening a popup. This effect picks up the result once the
    // app reloads after that round trip and restores wherever the user was
    // headed (stashed in sessionStorage before the redirect, since React
    // Router state doesn't survive a real full-page navigation).
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        getRedirectResult(auth).then((result) => {
            if (result?.user) {
                const stashed = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
                sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
                setRedirectReturnTo(stashed || '/');
            }
        }).catch((err) => {
            logClientError({ message: err.message, stack: err.stack, type: 'redirect-auth-error' });
        });
    }, []);

    const login = async (email, password, rememberMe = false) => {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        return signInWithEmailAndPassword(auth, email, password);
    };

    const signup = async (name, email, password) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Update profile with name
        await updateProfile(userCredential.user, { displayName: name });
        return userCredential;
    };

    const googleLogin = (returnTo) => {
        if (Capacitor.isNativePlatform()) {
            if (returnTo) sessionStorage.setItem(AUTH_RETURN_TO_KEY, returnTo);
            return signInWithRedirect(auth, googleProvider);
        }
        return signInWithPopup(auth, googleProvider);
    };

    const appleLogin = (returnTo) => {
        if (Capacitor.isNativePlatform()) {
            if (returnTo) sessionStorage.setItem(AUTH_RETURN_TO_KEY, returnTo);
            return signInWithRedirect(auth, appleProvider);
        }
        return signInWithPopup(auth, appleProvider);
    };

    const logout = () => {
        return signOut(auth);
    };

    // Lets a user set/reset a password on their account via an emailed link —
    // this is also how a Google-only account (no password credential yet,
    // e.g. one created via "Sign in with Google") gets a password linked, so
    // they can subsequently sign in with plain email/password anywhere a
    // popup-based Google sign-in isn't available (embedded previews, etc).
    // Routed through a Cloud Function (sendPasswordResetLink) rather than
    // Firebase's own sendPasswordResetEmail — Firebase's built-in auth
    // emails come from a shared, no-reputation noreply@*.firebaseapp.com
    // address that routinely lands in spam; the function instead sends via
    // the project's own connected Gmail through EmailJS.
    const resetPassword = (email) => {
        return sendPasswordResetLink({ email });
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, googleLogin, appleLogin, logout, resetPassword, isLoading, redirectReturnTo, clearRedirectReturnTo: () => setRedirectReturnTo(null) }}>
            {children}
        </AuthContext.Provider>
    );
};
