import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notifyAdminOfChatMessage } from '../index.js';
import { clearFirestore } from './helpers.js';

const originalFetch = global.fetch;

const mockEmailjsFetch = (respond) => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
        if (String(url).includes('api.emailjs.com')) return respond(url, opts);
        return originalFetch(url, opts);
    });
};

const authedRequest = (data, uid = 'alice', tokenOverrides = {}) => ({
    data,
    auth: { uid, token: { uid, name: 'Alice', email: 'alice@example.com', ...tokenOverrides } },
});

beforeEach(async () => {
    await clearFirestore();
    vi.restoreAllMocks();
});

describe('notifyAdminOfChatMessage', () => {
    it('rejects an unauthenticated call', async () => {
        await expect(notifyAdminOfChatMessage.run({ data: { text: 'hi' } }))
            .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects a missing text', async () => {
        await expect(notifyAdminOfChatMessage.run(authedRequest({})))
            .rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('sends the email via EmailJS using the caller\'s own auth token for name/email', async () => {
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockEmailjsFetch(fetchSpy);

        const result = await notifyAdminOfChatMessage.run(authedRequest({ text: 'do you deliver to Kumasi?' }));
        expect(result).toEqual({ sent: true });
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const [, opts] = fetchSpy.mock.calls[0];
        const body = JSON.parse(opts.body);
        expect(body.template_params.user_name).toBe('Alice');
        expect(body.template_params.user_email).toBe('alice@example.com');
        expect(body.template_params.message).toContain('do you deliver to Kumasi?');
        expect(body.accessToken).toBe('test-emailjs-private-key');
    });

    it('ignores client-supplied name/email — uses only the auth token', async () => {
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockEmailjsFetch(fetchSpy);

        await notifyAdminOfChatMessage.run(authedRequest({
            text: 'hi', userMeta: { displayName: 'Attacker', email: 'fake@evil.com' },
        }));
        const [, opts] = fetchSpy.mock.calls[0];
        const body = JSON.parse(opts.body);
        expect(body.template_params.user_name).toBe('Alice');
        expect(body.template_params.user_email).toBe('alice@example.com');
    });

    it('throttles a second call from the same user within the cooldown window', async () => {
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockEmailjsFetch(fetchSpy);

        await notifyAdminOfChatMessage.run(authedRequest({ text: 'first message' }));
        const second = await notifyAdminOfChatMessage.run(authedRequest({ text: 'second message right after' }));
        expect(second).toEqual({ sent: false });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does not throttle a different user calling immediately after', async () => {
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockEmailjsFetch(fetchSpy);

        await notifyAdminOfChatMessage.run(authedRequest({ text: 'alice message' }, 'alice'));
        const result = await notifyAdminOfChatMessage.run(authedRequest({ text: 'bob message' }, 'bob', { name: 'Bob', email: 'bob@example.com' }));
        expect(result).toEqual({ sent: true });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('bypasses the cooldown for an explicit human-handoff request', async () => {
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockEmailjsFetch(fetchSpy);

        await notifyAdminOfChatMessage.run(authedRequest({ text: 'first message' }));
        const result = await notifyAdminOfChatMessage.run(authedRequest({ text: 'need a human now', isHandoff: true }));
        expect(result).toEqual({ sent: true });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('does not throw when EmailJS fails — returns sent: false instead', async () => {
        mockEmailjsFetch(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
        const result = await notifyAdminOfChatMessage.run(authedRequest({ text: 'hi' }));
        expect(result).toEqual({ sent: false });
    });
});
