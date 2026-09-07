import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ANALYTICS_CONFIGURED is read as a module-level constant from
// import.meta.env, so — same as the Google Drive API key issue fixed
// earlier in this app's test suite — a plain vi.stubEnv() only reaches a
// module imported AFTER the stub is in place. Reset and re-import fresh
// for each test rather than relying on a static top-level import.
const loadBanner = async (measurementId) => {
    vi.resetModules();
    vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', measurementId || '');
    const { default: CookieConsentBanner } = await import('./CookieConsentBanner');
    return CookieConsentBanner;
};

const renderBanner = (CookieConsentBanner) =>
    render(<MemoryRouter><CookieConsentBanner /></MemoryRouter>);

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
});

describe('CookieConsentBanner', () => {
    it('renders nothing when analytics is not configured (no measurement ID)', async () => {
        const CookieConsentBanner = await loadBanner('');
        renderBanner(CookieConsentBanner);
        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    });

    it('shows the banner on a first visit once analytics is configured and no decision has been made', async () => {
        const CookieConsentBanner = await loadBanner('G-TEST123');
        renderBanner(CookieConsentBanner);
        expect(screen.getByText(/we use cookies/i)).toBeInTheDocument();
    });

    it('does not show again once the visitor has already accepted', async () => {
        localStorage.setItem('fw_cookie_consent', 'granted');
        const CookieConsentBanner = await loadBanner('G-TEST123');
        renderBanner(CookieConsentBanner);
        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    });

    it('does not show again once the visitor has already declined', async () => {
        localStorage.setItem('fw_cookie_consent', 'declined');
        const CookieConsentBanner = await loadBanner('G-TEST123');
        renderBanner(CookieConsentBanner);
        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    });

    it('hides itself and records acceptance when Accept is clicked', async () => {
        const CookieConsentBanner = await loadBanner('G-TEST123');
        renderBanner(CookieConsentBanner);

        await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
        expect(localStorage.getItem('fw_cookie_consent')).toBe('granted');
    });

    it('hides itself and records the decline when Decline is clicked', async () => {
        const CookieConsentBanner = await loadBanner('G-TEST123');
        renderBanner(CookieConsentBanner);

        await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
        expect(localStorage.getItem('fw_cookie_consent')).toBe('declined');
    });
});
