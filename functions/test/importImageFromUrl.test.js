import { describe, it, expect, vi, afterEach } from 'vitest';
import { importImageFromUrl, isPrivateOrReservedIp } from '../index.js';

// index.js does `const dns = require('node:dns').promises` at module load
// (it's CommonJS) — vi.mock on a built-in module doesn't reliably intercept
// that from an ESM test file the way it does a project module. Rather than
// fight that, every test below reaches the handler's DNS-lookup branch
// using a bare IP-literal URL — isIP() short-circuits the lookup entirely
// for those (see the handler), so the full real code path still runs with
// no network access and no mocking needed. The address-safety check itself
// (isPrivateOrReservedIp) is unit-tested directly, covering the private-IP
// cases a hostname would also hit after resolving.

// Same minimal req/res shape as proxyArtworkImage.test.js.
const makeReq = (query = {}) => ({ query });
const makeRes = () => {
    const res = { statusCode: null, body: null, headers: {} };
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (body) => { res.body = body; res.statusCode = res.statusCode || 200; return res; };
    res.set = (key, value) => { res.headers[key] = value; return res; };
    return res;
};

// An arbitrary public-looking IP literal, so tests that don't care about
// the SSRF check can reach the fetch-mocking logic with no DNS involved.
const PUBLIC_IP = '93.184.216.34';

const originalFetch = global.fetch;
afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
});

// Body as an async-iterable of Buffer chunks, matching what `for await (const
// chunk of upstream.body)` reads from a real fetch() Response.
const bodyOf = (bytes) => ({
    async *[Symbol.asyncIterator]() {
        yield Buffer.from(bytes);
    },
});

describe('isPrivateOrReservedIp', () => {
    it.each([
        ['10.0.0.5', true],
        ['127.0.0.1', true],
        ['169.254.169.254', true], // cloud metadata endpoint — the one that matters most
        ['172.16.0.1', true],
        ['172.31.255.255', true],
        ['192.168.1.1', true],
        ['0.0.0.0', true],
        ['::1', true],
        ['fe80::1', true],
        ['fc00::1', true],
        ['fd12:3456::1', true],
        ['::ffff:127.0.0.1', true],
        [PUBLIC_IP, false],
        ['8.8.8.8', false],
        ['172.15.255.255', false], // just outside the 172.16-31 private range
        ['172.32.0.1', false], // just outside on the other side
        ['2606:4700:4700::1111', false],
    ])('%s -> private=%s', (address, expected) => {
        expect(isPrivateOrReservedIp(address)).toBe(expected);
    });
});

describe('importImageFromUrl', () => {
    it('rejects a request with no url parameter', async () => {
        const res = makeRes();
        await importImageFromUrl(makeReq({}), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects a malformed url', async () => {
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: 'not a url' }), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects a non-http(s) protocol', async () => {
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: 'file:///etc/passwd' }), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects localhost outright', async () => {
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: 'http://localhost:8080/x.jpg' }), res);
        expect(res.statusCode).toBe(403);
    });

    it('rejects a bare private IP literal (SSRF), with no fetch attempted', async () => {
        global.fetch = vi.fn();
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: 'http://127.0.0.1/x.jpg' }), res);
        expect(res.statusCode).toBe(403);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects the cloud metadata address specifically', async () => {
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: 'http://169.254.169.254/latest/meta-data/' }), res);
        expect(res.statusCode).toBe(403);
    });

    it('rejects a non-image content-type', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: { get: (h) => (h === 'content-type' ? 'text/html' : null) },
            body: bodyOf([]),
        });
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: `https://${PUBLIC_IP}/page.html` }), res);
        expect(res.statusCode).toBe(415);
    });

    it('rejects an image over the size cap via Content-Length', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: {
                get: (h) => ({ 'content-type': 'image/jpeg', 'content-length': String(50 * 1024 * 1024) }[h] || null),
            },
            body: bodyOf([]),
        });
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: `https://${PUBLIC_IP}/huge.jpg` }), res);
        expect(res.statusCode).toBe(413);
    });

    it('rejects an image over the size cap enforced mid-stream, even with no Content-Length', async () => {
        const bigChunk = Buffer.alloc(21 * 1024 * 1024, 1);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: { get: (h) => (h === 'content-type' ? 'image/jpeg' : null) },
            body: { async *[Symbol.asyncIterator]() { yield bigChunk; } },
        });
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: `https://${PUBLIC_IP}/huge.jpg` }), res);
        expect(res.statusCode).toBe(413);
    });

    it('passes through the upstream failure as a 502', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false });
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: `https://${PUBLIC_IP}/missing.jpg` }), res);
        expect(res.statusCode).toBe(502);
    });

    it('returns 502 when the upstream fetch itself throws', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: `https://${PUBLIC_IP}/x.jpg` }), res);
        expect(res.statusCode).toBe(502);
    });

    it('fetches and returns the image bytes for a legitimate public image url', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: {
                get: (h) => ({ 'content-type': 'image/png', 'content-length': String(bytes.length) }[h] || null),
            },
            body: bodyOf(bytes),
        });
        const res = makeRes();
        await importImageFromUrl(makeReq({ url: `https://${PUBLIC_IP}/photo.png` }), res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
        expect(res.headers['Content-Type']).toBe('image/png');
        expect(Buffer.compare(res.body, Buffer.from(bytes))).toBe(0);
    });
});
