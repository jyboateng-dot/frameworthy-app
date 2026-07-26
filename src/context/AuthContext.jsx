import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    signInWithCredential,
    getRedirectResult,
    updateProfile,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    OAuthProvider
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
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

    // Native "Sign In with Apple" on iOS specifically — App Store review
    // (guideline 4.8) expects the real native experience (Apple's own
    // account sheet, Face ID/Touch ID) since the app already offers Google
    // as an alternative sign-in method, not a browser round-trip. Android
    // has no native Apple ID account to hand off to, so it stays on the
    // signInWithRedirect path below like before.
    //
    // Firebase requires proof this credential was requested by this exact
    // attempt, not replayed from a captured token: a random nonce is hashed
    // and handed to Apple (who embeds it in the signed identityToken), then
    // the original raw value is handed to Firebase, which re-hashes it and
    // checks the two match.
    const appleLoginNative = async () => {
        const rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b) => b.toString(16).padStart(2, '0')).join('');
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
        const hashedNonce = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, '0')).join('');

        // clientId/redirectURI are required by the plugin's shared TS
        // interface but ignored by its native iOS implementation, which
        // talks to ASAuthorizationAppleIDProvider directly using the app's
        // own bundle ID/entitlement instead.
        const { response } = await SignInWithApple.authorize({
            clientId: 'com.frameworthyco.app',
            redirectURI: 'https://frameworthyco.com',
            scopes: 'email name',
            nonce: hashedNonce,
        });

        const credential = new OAuthProvider('apple.com').credential({
            idToken: response.identityToken,
            rawNonce,
        });
        const userCredential = await signInWithCredential(auth, credential);

        // Apple only ever sends the user's name on the very first
        // authorization for a given account — capture it into the Firebase
        // profile now, since it won't be offered again on later sign-ins.
        const fullName = [response.givenName, response.familyName].filter(Boolean).join(' ');
        if (fullName && !userCredential.user.displayName) {
            await updateProfile(userCredential.user, { displayName: fullName });
        }

        return userCredential;
    };

    const appleLogin = (returnTo) => {
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
            return appleLoginNative();
        }
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

    // Stable identity (useCallback) so consumers can safely list it as a
    // useEffect dependency without that effect re-running on every
    // AuthProvider render — setRedirectReturnTo itself is already stable
    // (useState setters are), so an empty dependency array is correct here.
    const clearRedirectReturnTo = useCallback(() => setRedirectReturnTo(null), []);

    return (
        <AuthContext.Provider value={{ user, login, signup, googleLogin, appleLogin, logout, resetPassword, isLoading, redirectReturnTo, clearRedirectReturnTo }}>
            {children}
        </AuthContext.Provider>
    );
};
