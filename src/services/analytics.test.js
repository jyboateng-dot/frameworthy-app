import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackPageView, trackEvent } from './analytics';

const logEventMock = vi.fn();
vi.mock('firebase/analytics', () => ({
    logEvent: (...args) => logEventMock(...args),
}));

// getAnalyticsInstance() is called fresh on every trackPageView/trackEvent
// (see firebase.js's own comment on why it can't be a value read once at
// import time — consent is a decision made interactively, after load), so
// mockResolvedValueOnce per test is enough here; no module-reset gymnastics
// needed the way a module-level constant would require.
const getAnalyticsInstanceMock = vi.fn();
vi.mock('./firebase', () => ({
    getAnalyticsInstance: (...args) => getAnalyticsInstanceMock(...args),
}));

describe('analytics', () => {
    beforeEach(() => {
        logEventMock.mockClear();
        getAnalyticsInstanceMock.mockReset();
    });

    it('does nothing when analytics is not configured/supported/consented (resolves null)', async () => {
        getAnalyticsInstanceMock.mockResolvedValue(null);

        await trackPageView('/inspiration', 'Inspiration | FrameWorthy');
        await trackEvent('add_to_cart', { value: 100 });

        expect(logEventMock).not.toHaveBeenCalled();
    });

    it('logs a page_view with path, title, and full URL when analytics is available', async () => {
        const fakeAnalytics = { fake: 'analytics-instance' };
        getAnalyticsInstanceMock.mockResolvedValue(fakeAnalytics);

        await trackPageView('/checkout', 'Checkout | FrameWorthy');

        expect(logEventMock).toHaveBeenCalledWith(
            fakeAnalytics,
            'page_view',
            expect.objectContaining({ page_path: '/checkout', page_title: 'Checkout | FrameWorthy' })
        );
    });

    it('logs a named event with whatever params are passed', async () => {
        const fakeAnalytics = { fake: 'analytics-instance' };
        getAnalyticsInstanceMock.mockResolvedValue(fakeAnalytics);

        await trackEvent('begin_checkout', { value: 250, currency: 'GHS' });

        expect(logEventMock).toHaveBeenCalledWith(fakeAnalytics, 'begin_checkout', { value: 250, currency: 'GHS' });
    });

    it('re-checks on every call, so a visitor who accepts partway through starts being tracked without a reload', async () => {
        getAnalyticsInstanceMock.mockResolvedValueOnce(null);
        await trackPageView('/inspiration', 'Inspiration | FrameWorthy');
        expect(logEventMock).not.toHaveBeenCalled();

        const fakeAnalytics = { fake: 'analytics-instance' };
        getAnalyticsInstanceMock.mockResolvedValueOnce(fakeAnalytics);
        await trackPageView('/canvas-art', 'Canvas Art | FrameWorthy');
        expect(logEventMock).toHaveBeenCalledWith(fakeAnalytics, 'page_view', expect.anything());
    });
});
