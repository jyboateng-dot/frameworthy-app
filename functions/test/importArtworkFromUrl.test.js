import { afterEach, describe, expect, it, vi } from 'vitest';
import { importArtworkFromUrl, isPrivateOrReservedIp } from '../index.js';

const PUBLIC_IP = '93.184.216.34';
const originalFetch = global.fetch;

const makeReq = ({ method = 'POST', body = {}, headers: reqHeaders = {} } = {}) => ({ method, body, headers: reqHeaders });
const makeRes = () => {
    const res = { statusCode: null, body: null, headers: {} };
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (body) => { res.body = body; res.statusCode ||= 200; return res; };
    res.set = (key, value) => { res.headers[key] = value; return res; };
    return res;
};
const bodyOf = (bytes) => ({
    async *[Symbol.asyncIterator]() { yield Buffer.from(bytes); },
});
const headers = (values) => ({ get: (name) => values[name.toLowerCase()] || null });

afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('isPrivateOrReservedIp', () => {
    it.each([
        ['10.0.0.5', true],
        ['100.64.0.1', true],
        ['127.0.0.1', true],
        ['169.254.169.254', true],
        ['172.16.0.1', true],
        ['192.168.1.1', true],
        ['224.0.0.1', true],
        ['::', true],
        ['::1', true],
        ['fe80::1', true],
        ['fd12:3456::1', true],
        [PUBLIC_IP, false],
        ['8.8.8.8', false],
    ])('%s private=%s', (address, expected) => {
        expect(isPrivateOrReservedIp(address)).toBe(expected);
    });
});

describe('importArtworkFromUrl', () => {
    it('accepts only POST requests', async () => {
        const res = makeRes();
        await importArtworkFromUrl(makeReq({ method: 'GET' }), res);
        expect(res.statusCode).toBe(405);
    });

    it('echoes back an allowed origin in Access-Control-Allow-Origin', async () => {
        const res = makeRes();
        await importArtworkFromUrl(makeReq({ method: 'OPTIONS', headers: { origin: 'https://frameworthyco.com' } }), res);
        expect(res.headers['Access-Control-Allow-Origin']).toBe('https://frameworthyco.com');
    });

    it('does not grant CORS access to a third-party origin', async () => {
        const res = makeRes();
        await importArtworkFromUrl(makeReq({ method: 'OPTIONS', headers: { origin: 'https://evil.example.com' } }), res);
        expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('sets no Access-Control-Allow-Origin header when the request carries no Origin (same-origin/server-to-server)', async () => {
        const res = makeRes();
        await importArtworkFromUrl(makeReq({ method: 'OPTIONS' }), res);
        expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('rejects missing, malformed, and private URLs', async () => {
        for (const url of [undefined, 'not-a-url', 'file:///tmp/image.jpg', 'http://127.0.0.1/image.jpg']) {
            const res = makeRes();
            await importArtworkFromUrl(makeReq({ body: { url } }), res);
            expect([400, 403]).toContain(res.statusCode);
        }
    });

    it('rejects a redirect to a private host before following it', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            status: 302,
            headers: headers({ location: 'http://169.254.169.254/latest/meta-data' }),
        });
        const res = makeRes();
        await importArtworkFromUrl(makeReq({ body: { url: `https://${PUBLIC_IP}/image` } }), res);
        expect(res.statusCode).toBe(403);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('rejects non-image and oversized responses', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, status: 200, headers: headers({ 'content-type': 'text/html' }), body: bodyOf([]) })
            .mockResolvedValueOnce({ ok: true, status: 200, headers: headers({ 'content-type': 'image/jpeg', 'content-length': String(21 * 1024 * 1024) }), body: bodyOf([]) });

        const first = makeRes();
        await importArtworkFromUrl(makeReq({ body: { url: `https://${PUBLIC_IP}/page` } }), first);
        expect(first.statusCode).toBe(415);

        const second = makeRes();
        await importArtworkFromUrl(makeReq({ body: { url: `https://${PUBLIC_IP}/large` } }), second);
        expect(second.statusCode).toBe(413);
    });

    it('returns image bytes and a safe filename', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: headers({ 'content-type': 'image/png', 'content-length': String(bytes.length) }),
            body: bodyOf(bytes),
        });
        const res = makeRes();
        await importArtworkFromUrl(makeReq({ body: { url: `https://${PUBLIC_IP}/my%20art.png` } }), res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['Content-Type']).toBe('image/png');
        expect(res.headers['X-Artwork-Filename']).toBe('my-art.png');
        expect(res.headers['Cache-Control']).toBe('no-store');
        expect(Buffer.compare(res.body, Buffer.from(bytes))).toBe(0);
    });
});
