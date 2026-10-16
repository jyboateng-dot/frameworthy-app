import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from './AuthPage';
import * as AuthContextModule from '../context/AuthContext';

describe('AuthPage Sign In and Sign Up Methods', () => {
    let mockLogin;
    let mockSignup;
    let mockGoogleLogin;
    let mockAppleLogin;
    let mockResetPassword;
    let mockNavigate;

    beforeEach(() => {
        mockLogin = vi.fn().mockResolvedValue({ user: { uid: 'u123', email: 'test@example.com' } });
        mockSignup = vi.fn().mockResolvedValue({ user: { uid: 'u456', email: 'new@example.com' } });
        mockGoogleLogin = vi.fn().mockResolvedValue({ user: { uid: 'g123', email: 'google@example.com' } });
        mockAppleLogin = vi.fn().mockResolvedValue({ user: { uid: 'a123', email: 'apple@example.com' } });
        mockResetPassword = vi.fn().mockResolvedValue({ data: { success: true } });
        mockNavigate = vi.fn();

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            user: null,
            login: mockLogin,
            signup: mockSignup,
            googleLogin: mockGoogleLogin,
            appleLogin: mockAppleLogin,
            resetPassword: mockResetPassword,
            redirectReturnTo: null,
            clearRedirectReturnTo: vi.fn(),
            isLoading: false,
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    const renderAuthPage = (initialEntries = ['/auth']) => {
        return render(
            <MemoryRouter initialEntries={initialEntries}>
                <AuthPage navigate={mockNavigate} />
            </MemoryRouter>
        );
    };

    it('renders both Google and Apple social sign-in buttons along with email inputs', () => {
        const { container } = renderAuthPage();

        expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
        const submitBtn = container.querySelector('button[type="submit"]');
        expect(submitBtn).toBeInTheDocument();
        expect(submitBtn).toHaveTextContent(/sign in/i);
    });

    it('successfully triggers Continue with Google and redirects to returnTo', async () => {
        const user = userEvent.setup();
        renderAuthPage(['/auth?returnTo=/checkout']);

        const googleBtn = screen.getByRole('button', { name: /continue with google/i });
        await user.click(googleBtn);

        expect(mockGoogleLogin).toHaveBeenCalledWith('/checkout');
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/checkout');
        });
    });

    it('successfully triggers Continue with Apple and redirects to returnTo', async () => {
        const user = userEvent.setup();
        renderAuthPage(['/auth?returnTo=/checkout']);

        const appleBtn = screen.getByRole('button', { name: /continue with apple/i });
        await user.click(appleBtn);

        expect(mockAppleLogin).toHaveBeenCalledWith('/checkout');
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/checkout');
        });
    });

    it('silently resets loading without displaying an error banner when Google/Apple popup is closed by user', async () => {
        const user = userEvent.setup();
        const popupClosedErr = new Error('The popup has been closed by the user');
        popupClosedErr.code = 'auth/popup-closed-by-user';
        mockGoogleLogin.mockRejectedValueOnce(popupClosedErr);

        renderAuthPage();

        const googleBtn = screen.getByRole('button', { name: /continue with google/i });
        await user.click(googleBtn);

        expect(mockGoogleLogin).toHaveBeenCalled();
        expect(screen.queryByText(/popup has been closed/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/authentication failed/i)).not.toBeInTheDocument();
    });

    it('displays a friendly error message when popup is blocked by the browser', async () => {
        const user = userEvent.setup();
        const popupBlockedErr = new Error('Popup blocked');
        popupBlockedErr.code = 'auth/popup-blocked';
        mockAppleLogin.mockRejectedValueOnce(popupBlockedErr);

        renderAuthPage();

        const appleBtn = screen.getByRole('button', { name: /continue with apple/i });
        await user.click(appleBtn);

        expect(await screen.findByText(/blocked the sign-in pop-up/i)).toBeInTheDocument();
    });

    it('validates required fields before submitting Sign In', async () => {
        const user = userEvent.setup();
        const { container } = renderAuthPage();

        const submitBtn = container.querySelector('button[type="submit"]');
        await user.click(submitBtn);

        expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
        expect(mockLogin).not.toHaveBeenCalled();
    });

    it('submits Sign In with email, password, and rememberMe persistence', async () => {
        const user = userEvent.setup();
        const { container } = renderAuthPage(['/auth?returnTo=/orders']);

        await user.type(screen.getByPlaceholderText(/email address/i), 'user@test.com');
        await user.type(screen.getByPlaceholderText(/password/i), 'Secret123!');
        await user.click(screen.getByRole('checkbox', { name: /remember me/i }));

        const submitBtn = container.querySelector('button[type="submit"]');
        await user.click(submitBtn);

        expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'Secret123!', true);
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/orders');
        });
    });

    it('displays a user-friendly error on invalid email or password', async () => {
        const user = userEvent.setup();
        const invalidCredErr = new Error('Invalid credential');
        invalidCredErr.code = 'auth/invalid-credential';
        mockLogin.mockRejectedValueOnce(invalidCredErr);

        const { container } = renderAuthPage();

        await user.type(screen.getByPlaceholderText(/email address/i), 'wrong@test.com');
        await user.type(screen.getByPlaceholderText(/password/i), 'wrongpass');
        const submitBtn = container.querySelector('button[type="submit"]');
        await user.click(submitBtn);

        expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    });

    it('switches to Create Account mode and shows Full Name field', async () => {
        const user = userEvent.setup();
        const { container } = renderAuthPage();

        expect(screen.queryByPlaceholderText(/full name/i)).not.toBeInTheDocument();

        // In initial login mode, the only button with "Create Account" is the tab switcher
        const createAccountTab = screen.getByRole('button', { name: /^create account$/i });
        await user.click(createAccountTab);

        expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
        const submitBtn = container.querySelector('button[type="submit"]');
        expect(submitBtn).toHaveTextContent(/create account/i);
    });

    it('submits Create Account and navigates on success', async () => {
        const user = userEvent.setup();
        const { container } = renderAuthPage(['/auth?mode=signup&returnTo=/customizer']);

        await user.type(screen.getByPlaceholderText(/full name/i), 'Jane Doe');
        await user.type(screen.getByPlaceholderText(/email address/i), 'jane@example.com');
        await user.type(screen.getByPlaceholderText(/password/i), 'StrongP@ss1');

        const submitBtn = container.querySelector('button[type="submit"]');
        await user.click(submitBtn);

        expect(mockSignup).toHaveBeenCalledWith('Jane Doe', 'jane@example.com', 'StrongP@ss1');
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/customizer');
        });
    });

    it('handles email already in use error with non-enumerating message', async () => {
        const user = userEvent.setup();
        const emailInUseErr = new Error('Email exists');
        emailInUseErr.code = 'auth/email-already-in-use';
        mockSignup.mockRejectedValueOnce(emailInUseErr);

        const { container } = renderAuthPage(['/auth?mode=signup']);

        await user.type(screen.getByPlaceholderText(/full name/i), 'Jane Doe');
        await user.type(screen.getByPlaceholderText(/email address/i), 'existing@example.com');
        await user.type(screen.getByPlaceholderText(/password/i), 'Secret123!');

        const submitBtn = container.querySelector('button[type="submit"]');
        await user.click(submitBtn);

        expect(await screen.findByText(/couldn't create your account with that email/i)).toBeInTheDocument();
    });

    it('toggles password visibility when the eye button is clicked', async () => {
        const user = userEvent.setup();
        renderAuthPage();

        const passwordInput = screen.getByPlaceholderText(/password/i);
        expect(passwordInput).toHaveAttribute('type', 'password');

        const toggleBtn = screen.getByRole('button', { name: /show password/i });
        await user.click(toggleBtn);
        expect(passwordInput).toHaveAttribute('type', 'text');

        const hideBtn = screen.getByRole('button', { name: /hide password/i });
        await user.click(hideBtn);
        expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('handles Forgot Password flow with validation and success notice', async () => {
        const user = userEvent.setup();
        renderAuthPage();

        const forgotBtn = screen.getByRole('button', { name: /forgot password\?/i });
        await user.click(forgotBtn);

        expect(await screen.findByText(/enter your email address above first/i)).toBeInTheDocument();
        expect(mockResetPassword).not.toHaveBeenCalled();

        await user.type(screen.getByPlaceholderText(/email address/i), 'reset@example.com');
        await user.click(forgotBtn);

        expect(mockResetPassword).toHaveBeenCalledWith('reset@example.com');
        expect(await screen.findByText(/password reset email sent to reset@example\.com/i)).toBeInTheDocument();
    });
});
