import { describe, it, expect, vi } from 'vitest';

// vi.mock is hoisted above this file's own const declarations, so the mock
// fn has to be created inside vi.hoisted to exist by the time it runs.
const { present, registerPlugin } = vi.hoisted(() => {
    const present = vi.fn().mockResolvedValue(undefined);
    return { present, registerPlugin: vi.fn(() => ({ present })) };
});
vi.mock('@capacitor/core', () => ({ registerPlugin }));

import { presentNativeQuickLook } from './nativeQuickLook';

describe('presentNativeQuickLook', () => {
    it('registers under the same name as the plugin\'s @objc class', () => {
        // Capacitor resolves an app-local plugin by NSClassFromString on this
        // exact string (see QuickLookPlugin.swift). A mismatch doesn't throw —
        // the bridge returns without settling the promise, so the AR button
        // just silently does nothing, which is how this shipped broken once.
        expect(registerPlugin).toHaveBeenCalledWith('FrameWorthyQuickLook');
    });

    it('calls the native plugin with the relayed url', async () => {
        await presentNativeQuickLook('https://frameworthyco-9c78c.web.app/api/ar-relay/abc.usdz');
        expect(present).toHaveBeenCalledWith({ url: 'https://frameworthyco-9c78c.web.app/api/ar-relay/abc.usdz' });
    });
});
