import { describe, it, expect, vi, beforeEach } from 'vitest';

const logEventMock = vi.fn();
vi.mock('firebase/analytics', () => ({
    logEvent: (...args) => logEventMock(...args),
}));

// analyticsReady is read once, at import time, by analytics.js — so getting
// a fresh value per test (a fake instance, or null for "not configured")
// needs a fresh module instance each time via resetModules + a re-mock,
// not just changing a shared variable after the fact.
const loadWithAnalyticsReady = async (value) => {
    vi.resetModules();
    vi.doMock('./firebase', () => ({ analyticsReady: Promise.resolve(value) }));
    return import('./analytics');
};

describe('analytics', () => {
    beforeEach(() => {
        logEventMock.mockClear();
    });

    it('does nothing when analytics is not configured/supported (analyticsReady resolves null)', async () => {
        const { trackPageView, trackEvent } = await loadWithAnalyticsReady(null);

        await trackPageView('/inspiration', 'Inspiration | FrameWorthy');
        await trackEvent('add_to_cart', { value: 100 });

        expect(logEventMock).not.toHaveBeenCalled();
    });

    it('logs a page_view with path, title, and full URL when analytics is available', async () => {
        const fakeAnalytics = { fake: 'analytics-instance' };
        const { trackPageView } = await loadWithAnalyticsReady(fakeAnalytics);

        await trackPageView('/checkout', 'Checkout | FrameWorthy');

        expect(logEventMock).toHaveBeenCalledWith(
            fakeAnalytics,
            'page_view',
            expect.objectContaining({ page_path: '/checkout', page_title: 'Checkout | FrameWorthy' })
        );
    });

    it('logs a named event with whatever params are passed', async () => {
        const fakeAnalytics = { fake: 'analytics-instance' };
        const { trackEvent } = await loadWithAnalyticsReady(fakeAnalytics);

        await trackEvent('begin_checkout', { value: 250, currency: 'GHS' });

        expect(logEventMock).toHaveBeenCalledWith(fakeAnalytics, 'begin_checkout', { value: 250, currency: 'GHS' });
    });
});
