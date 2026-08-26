import { describe, it, expect, vi } from 'vitest';

// vi.mock is hoisted above this file's own const declarations, so the mock
// fn has to be created inside vi.hoisted to exist by the time it runs.
const { present } = vi.hoisted(() => ({ present: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@capacitor/core', () => ({
    registerPlugin: vi.fn(() => ({ present })),
}));

import { presentNativeQuickLook } from './nativeQuickLook';

describe('presentNativeQuickLook', () => {
    it('calls the native plugin with the relayed url', async () => {
        await presentNativeQuickLook('https://frameworthyco-9c78c.web.app/api/ar-relay/abc.usdz');
        expect(present).toHaveBeenCalledWith({ url: 'https://frameworthyco-9c78c.web.app/api/ar-relay/abc.usdz' });
    });
});
