import { describe, it, expect, beforeEach, vi } from 'vitest';
import { askSupportAgent } from '../index.js';
import { clearFirestore } from './helpers.js';

const originalFetch = global.fetch;

const mockGeminiFetch = (respond) => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
        if (String(url).includes('generativelanguage.googleapis.com')) return respond(url, opts);
        return originalFetch(url, opts);
    });
};

const geminiSuccess = (text = 'We deliver to all 16 regions in Ghana!') => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
});

const authedRequest = (data, uid = 'alice') => ({ data, auth: { uid, token: { uid } } });

beforeEach(async () => {
    await clearFirestore();
    vi.restoreAllMocks();
});

describe('askSupportAgent', () => {
    it('rejects an unauthenticated call', async () => {
        await expect(askSupportAgent.run({ data: { message: 'hi' } }))
            .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects a missing or empty message', async () => {
        await expect(askSupportAgent.run(authedRequest({})))
            .rejects.toMatchObject({ code: 'invalid-argument' });
        await expect(askSupportAgent.run(authedRequest({ message: '   ' })))
            .rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects a message over 2000 characters', async () => {
        await expect(askSupportAgent.run(authedRequest({ message: 'x'.repeat(2001) })))
            .rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('returns the Gemini reply on a successful call', async () => {
        mockGeminiFetch(async () => geminiSuccess());
        const res = await askSupportAgent.run(authedRequest({ message: 'do you deliver to Kumasi?' }));
        expect(res.text).toBe('We deliver to all 16 regions in Ghana!');
    });

    it('throttles a second call from the same user within the cooldown window', async () => {
        mockGeminiFetch(async () => geminiSuccess());
        await askSupportAgent.run(authedRequest({ message: 'first message' }));
        await expect(askSupportAgent.run(authedRequest({ message: 'second message right after' })))
            .rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('does not throttle a different user calling immediately after', async () => {
        mockGeminiFetch(async () => geminiSuccess());
        await askSupportAgent.run(authedRequest({ message: 'alice message' }, 'alice'));
        const res = await askSupportAgent.run(authedRequest({ message: 'bob message' }, 'bob'));
        expect(res.text).toBe('We deliver to all 16 regions in Ghana!');
    });

    it('falls through to unavailable when Gemini errors, rather than leaking a raw error', async () => {
        mockGeminiFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
        await expect(askSupportAgent.run(authedRequest({ message: 'hi' })))
            .rejects.toMatchObject({ code: 'unavailable' });
    });
});
