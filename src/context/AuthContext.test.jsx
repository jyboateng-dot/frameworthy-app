import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as firebaseAuth from 'firebase/auth';
import * as capacitorCore from '@capacitor/core';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';

// Mock dependencies
vi.mock('firebase/auth', () => {
    return {
        getAuth: vi.fn(() => ({})),
        createUserWithEmailAndPassword: vi.fn(),
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChanged: vi.fn((auth, cb) => {
            cb(null);
            return vi.fn(); // unsubscribe
        }),
        signInWithPopup: vi.fn(),
        signInWithRedirect: vi.fn(),
        signInWithCredential: vi.fn(),
        getRedirectResult: vi.fn().mockResolvedValue(null),
        updateProfile: vi.fn(),
        setPersistence: vi.fn().mockResolvedValue(undefined),
        browserLocalPersistence: 'LOCAL',
        browserSessionPersistence: 'SESSION',
        OAuthProvider: class {
            constructor(providerId) {
                this.providerId = providerId;
            }
            credential(opts) {
                return { providerId: this.providerId, ...opts };
            }
            addScope() {}
        },
        GoogleAuthProvider: class {
            setCustomParameters() {}
        },
    };
});

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { success: true } })),
    getFunctions: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => false),
        getPlatform: vi.fn(() => 'web'),
    },
}));

vi.mock('@capacitor-community/apple-sign-in', () => ({
    SignInWithApple: {
        authorize: vi.fn(),
    },
}));

// Test consumer component
const TestConsumer = ({ onReady }) => {
    const auth = useAuth();
    React.useEffect(() => {
        if (onReady) onReady(auth);
    }, [auth, onReady]);
    return <div>{auth.user ? `User: ${auth.user.email}` : 'No User'}</div>;
};

describe('AuthContext', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    const setupAuth = async () => {
        let authContext;
        render(
            <AuthProvider>
                <TestConsumer onReady={(ctx) => { authContext = ctx; }} />
            </AuthProvider>
        );
        return authContext;
    };

    it('sets persistence and signs in with email and password', async () => {
        firebaseAuth.signInWithEmailAndPassword.mockResolvedValueOnce({
            user: { uid: 'u1', email: 'test@test.com' },
        });

        const auth = await setupAuth();
        await act(async () => {
            await auth.login('test@test.com', 'mypassword', true);
        });

        expect(firebaseAuth.setPersistence).toHaveBeenCalledWith(expect.anything(), firebaseAuth.browserLocalPersistence);
        expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@test.com', 'mypassword');
    });

    it('creates user with email/password and updates display name', async () => {
        const mockUser = { uid: 'u2', email: 'new@test.com' };
        firebaseAuth.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
        firebaseAuth.updateProfile.mockResolvedValueOnce(undefined);

        const auth = await setupAuth();
        await act(async () => {
            await auth.signup('Test User', 'new@test.com', 'mypassword');
        });

        expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'new@test.com', 'mypassword');
        expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'Test User' });
    });

    it('calls signInWithPopup for googleLogin on web platform', async () => {
        firebaseAuth.signInWithPopup.mockResolvedValueOnce({
            user: { uid: 'g1', email: 'g@test.com' },
        });

        const auth = await setupAuth();
        await act(async () => {
            await auth.googleLogin('/customizer');
        });

        expect(firebaseAuth.signInWithPopup).toHaveBeenCalled();
        expect(firebaseAuth.signInWithRedirect).not.toHaveBeenCalled();
    });

    it('calls signInWithRedirect and stashes returnTo for googleLogin on native platform', async () => {
        capacitorCore.Capacitor.isNativePlatform.mockReturnValue(true);
        capacitorCore.Capacitor.getPlatform.mockReturnValue('android');

        const auth = await setupAuth();
        await act(async () => {
            await auth.googleLogin('/checkout');
        });

        expect(sessionStorage.getItem('fw_auth_return_to')).toBe('/checkout');
        expect(firebaseAuth.signInWithRedirect).toHaveBeenCalled();
    });

    it('calls signInWithPopup for appleLogin on web platform', async () => {
        capacitorCore.Capacitor.isNativePlatform.mockReturnValue(false);
        firebaseAuth.signInWithPopup.mockResolvedValueOnce({
            user: { uid: 'a1', email: 'apple@test.com' },
        });

        const auth = await setupAuth();
        await act(async () => {
            await auth.appleLogin('/orders');
        });

        expect(firebaseAuth.signInWithPopup).toHaveBeenCalled();
    });

    it('executes native Apple sheet via SignInWithApple on native iOS', async () => {
        capacitorCore.Capacitor.isNativePlatform.mockReturnValue(true);
        capacitorCore.Capacitor.getPlatform.mockReturnValue('ios');

        SignInWithApple.authorize.mockResolvedValueOnce({
            response: {
                identityToken: 'mock-jwt-token',
                givenName: 'John',
                familyName: 'Appleseed',
            },
        });
        firebaseAuth.signInWithCredential.mockResolvedValueOnce({
            user: { uid: 'ios-apple-1', displayName: null },
        });

        const auth = await setupAuth();
        await act(async () => {
            await auth.appleLogin();
        });

        expect(SignInWithApple.authorize).toHaveBeenCalledWith(expect.objectContaining({
            clientId: 'com.frameworthyco.app',
            redirectURI: 'https://frameworthyco.com',
            scopes: 'email name',
        }));
        expect(firebaseAuth.signInWithCredential).toHaveBeenCalled();
        expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(expect.anything(), {
            displayName: 'John Appleseed',
        });
    });

    it('calls signOut on logout', async () => {
        const auth = await setupAuth();
        await act(async () => {
            await auth.logout();
        });

        expect(firebaseAuth.signOut).toHaveBeenCalled();
    });
});
