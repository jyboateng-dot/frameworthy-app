import { describe, it, expect, vi, afterEach } from 'vitest';
import { proxyArtworkImage } from '../index.js';

// proxyArtworkImage is a raw onRequest handler (req, res) => {} — not an
// onCall, so there's no .run() helper. Build the minimal req/res shape the
// handler actually reads, same pattern as paystackWebhook.test.js.
const makeReq = (query = {}) => ({ query });

const makeRes = () => {
    const res = { statusCode: null, body: null, headers: {} };
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (body) => { res.body = body; res.statusCode = res.statusCode || 200; return res; };
    res.set = (key, value) => { res.headers[key] = value; return res; };
    return res;
};

const originalFetch = global.fetch;
afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('proxyArtworkImage', () => {
    it('rejects a request with no url parameter', async () => {
        const res = makeRes();
        await proxyArtworkImage(makeReq({}), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects a malformed url', async () => {
        const res = makeRes();
        await proxyArtworkImage(makeReq({ url: 'not a url' }), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects a host that is not on the allowlist', async () => {
        const res = makeRes();
        await proxyArtworkImage(makeReq({ url: 'https://evil.example.com/x.jpg' }), res);
        expect(res.statusCode).toBe(403);
    });

    it('rejects a non-https url even for an allowlisted host', async () => {
        const res = makeRes();
        await proxyArtworkImage(makeReq({ url: 'http://bymuseum.com/x.jpg' }), res);
        expect(res.statusCode).toBe(403);
    });

    it('re-serves bytes from an allowlisted host with CORS enabled', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: (h) => (h === 'content-type' ? 'image/jpeg' : null) },
            arrayBuffer: async () => bytes.buffer,
        });

        const res = makeRes();
        await proxyArtworkImage(makeReq({ url: 'https://bymuseum.com/wp-content/uploads/x.jpg' }), res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
        expect(res.headers['Content-Type']).toBe('image/jpeg');
        expect(Buffer.compare(res.body, Buffer.from(bytes))).toBe(0);
    });

    it('passes through the upstream status when the fetch fails to succeed', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
        const res = makeRes();
        await proxyArtworkImage(makeReq({ url: 'https://bymuseum.com/missing.jpg' }), res);
        expect(res.statusCode).toBe(404);
    });

    it('returns 502 when the upstream fetch itself throws', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
        const res = makeRes();
        await proxyArtworkImage(makeReq({ url: 'https://bymuseum.com/x.jpg' }), res);
        expect(res.statusCode).toBe(502);
    });
});
