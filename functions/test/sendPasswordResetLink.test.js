import { describe, it, expect, beforeEach, vi } from 'vitest';
import admin from 'firebase-admin';
import { sendPasswordResetLink } from '../index.js';
import { clearFirestore, clearAuthUsers } from './helpers.js';

const originalFetch = global.fetch;

const mockResendFetch = (respond) => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
        if (String(url).includes('api.resend.com')) return respond(url, opts);
        return originalFetch(url, opts);
    });
};

beforeEach(async () => {
    await clearFirestore();
    await clearAuthUsers();
    vi.restoreAllMocks();
});

describe('sendPasswordResetLink', () => {
    it('rejects a call with no email', async () => {
        await expect(sendPasswordResetLink.run({ data: {} })).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('sends a reset email for an existing user via Resend', async () => {
        await admin.auth().createUser({ email: 'user@example.com', password: 'password123' });
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockResendFetch(fetchSpy);

        const result = await sendPasswordResetLink.run({ data: { email: 'user@example.com' } });
        expect(result).toEqual({ success: true });
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const [, opts] = fetchSpy.mock.calls[0];
        const body = JSON.parse(opts.body);
        expect(body.to).toEqual(['user@example.com']);
        expect(typeof body.text).toBe('string');
        // The Auth emulator intentionally returns a local HTTP action URL;
        // production Firebase returns an HTTPS reset URL.
        expect(body.text).toMatch(/https?:\/\//);
        expect(opts.headers.Authorization).toBe('Bearer test-resend-api-key');
    });

    it('does not leak whether an email exists — returns success for an unknown address without sending', async () => {
        const fetchSpy = vi.fn();
        mockResendFetch(fetchSpy);

        const result = await sendPasswordResetLink.run({ data: { email: 'nobody@example.com' } });
        expect(result).toEqual({ success: true });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throttles repeat requests for the same address within the cooldown window', async () => {
        await admin.auth().createUser({ email: 'user@example.com', password: 'password123' });
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockResendFetch(fetchSpy);

        await sendPasswordResetLink.run({ data: { email: 'user@example.com' } });
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const second = await sendPasswordResetLink.run({ data: { email: 'USER@example.com' } });
        expect(second).toEqual({ success: true });
        expect(fetchSpy).toHaveBeenCalledTimes(1); // still 1 — second call was throttled, no second send
    });

    it('surfaces an unavailable error when Resend rejects the send', async () => {
        await admin.auth().createUser({ email: 'user@example.com', password: 'password123' });
        mockResendFetch(async () => ({ ok: false, status: 500, text: async () => 'boom' }));

        await expect(sendPasswordResetLink.run({ data: { email: 'user@example.com' } }))
            .rejects.toMatchObject({ code: 'unavailable' });
    });

    it('surfaces an unavailable error when Resend cannot be reached', async () => {
        await admin.auth().createUser({ email: 'user@example.com', password: 'password123' });
        vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
            if (String(url).includes('api.resend.com')) throw new Error('network down');
            return originalFetch(url, opts);
        });

        await expect(sendPasswordResetLink.run({ data: { email: 'user@example.com' } }))
            .rejects.toMatchObject({ code: 'unavailable' });
    });
});
