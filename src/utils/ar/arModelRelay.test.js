import { describe, it, expect, vi, afterEach } from 'vitest';
import { relayArModel } from './arModelRelay';

const originalFetch = global.fetch;
afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('relayArModel', () => {
    it('re-fetches the blob, POSTs its bytes with the kind header, and returns the relay URL', async () => {
        const blobBytes = new Uint8Array([1, 2, 3]).buffer;
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ arrayBuffer: async () => blobBytes })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://frameworthyco-9c78c.web.app/api/ar-relay/abc.usdz' }) });

        const url = await relayArModel('blob:https://frameworthyco.com/some-uuid', 'usdz');

        expect(url).toBe('https://frameworthyco-9c78c.web.app/api/ar-relay/abc.usdz');
        expect(global.fetch).toHaveBeenNthCalledWith(1, 'blob:https://frameworthyco.com/some-uuid');
        const [postUrl, postOpts] = global.fetch.mock.calls[1];
        expect(postUrl).toBe('/api/ar-relay');
        expect(postOpts.method).toBe('POST');
        expect(postOpts.headers['X-Relay-Kind']).toBe('usdz');
        expect(postOpts.body).toBe(blobBytes);
    });

    it('throws when the relay endpoint does not respond ok', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ arrayBuffer: async () => new ArrayBuffer(1) })
            .mockResolvedValueOnce({ ok: false, status: 502 });

        await expect(relayArModel('blob:https://frameworthyco.com/x', 'glb')).rejects.toThrow('502');
    });
});
