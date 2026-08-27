import { describe, it, expect, vi, beforeEach } from 'vitest';

const { open } = vi.hoisted(() => ({ open: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@capacitor/browser', () => ({ Browser: { open } }));

import { openQuickLookViaSafari } from './nativeQuickLook';

describe('openQuickLookViaSafari', () => {
    beforeEach(() => open.mockClear());

    it('opens the launcher page with the model as a query parameter', async () => {
        await openQuickLookViaSafari('https://frameworthyco.com/api/ar-relay/abc.usdz');

        const opened = new URL(open.mock.calls[0][0].url);
        expect(opened.pathname).toBe('/ar-launch.html');
        expect(opened.searchParams.get('model')).toBe('https://frameworthyco.com/api/ar-relay/abc.usdz');
    });

    it('builds the launcher on the page\'s own origin', async () => {
        // ar-launch.html refuses any model that isn't same-origin, so pointing
        // at the wrong host would make it reject the real model — the launcher
        // and the model have to agree on origin.
        await openQuickLookViaSafari('https://frameworthyco.com/api/ar-relay/abc.usdz');

        expect(new URL(open.mock.calls[0][0].url).origin).toBe(window.location.origin);
    });
});
