import { describe, it, expect, afterEach, vi } from 'vitest';
import { arRelay } from '../index.js';

// arRelay is a raw onRequest handler — same minimal req/res shape as
// proxyArtworkImage.test.js. Only the validation paths that return before
// ever touching admin.storage() are covered here; the actual Storage
// read/write round-trip has no local emulator configured for this project
// (see firebase.json's emulators block), so that leg is verified live
// against the deployed function instead.
const makeReq = ({ method = 'GET', path = '/api/ar-relay', headers = {}, rawBody = null } = {}) => ({
    method,
    path,
    rawBody,
    get: (name) => headers[name.toLowerCase()] ?? headers[name] ?? undefined,
});

const makeRes = () => {
    const res = { statusCode: null, body: null, headers: {} };
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (body) => { res.body = body; res.statusCode = res.statusCode || 200; return res; };
    res.set = (key, value) => { res.headers[key] = value; return res; };
    res.json = (body) => { res.body = body; res.statusCode = res.statusCode || 200; return res; };
    return res;
};

afterEach(() => vi.restoreAllMocks());

describe('arRelay', () => {
    it('answers CORS preflight without touching storage', async () => {
        const res = makeRes();
        await arRelay(makeReq({ method: 'OPTIONS' }), res);
        expect(res.statusCode).toBe(204);
        expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
    });

    it('rejects a GET whose path does not match an object id/kind', async () => {
        const res = makeRes();
        await arRelay(makeReq({ method: 'GET', path: '/api/ar-relay/not-a-valid-name' }), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects methods other than GET/POST/OPTIONS', async () => {
        const res = makeRes();
        await arRelay(makeReq({ method: 'DELETE' }), res);
        expect(res.statusCode).toBe(405);
    });

    it('rejects a POST with no X-Relay-Kind header', async () => {
        const res = makeRes();
        await arRelay(makeReq({ method: 'POST', rawBody: Buffer.from([1, 2, 3]) }), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects a POST with an unrecognised X-Relay-Kind', async () => {
        const res = makeRes();
        await arRelay(makeReq({
            method: 'POST',
            headers: { 'X-Relay-Kind': 'exe' },
            rawBody: Buffer.from([1, 2, 3]),
        }), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects a POST with an empty body', async () => {
        const res = makeRes();
        await arRelay(makeReq({
            method: 'POST',
            headers: { 'X-Relay-Kind': 'usdz' },
            rawBody: Buffer.alloc(0),
        }), res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects a POST body over the size cap', async () => {
        const res = makeRes();
        await arRelay(makeReq({
            method: 'POST',
            headers: { 'X-Relay-Kind': 'usdz' },
            rawBody: Buffer.alloc(21 * 1024 * 1024),
        }), res);
        expect(res.statusCode).toBe(413);
    });
});
