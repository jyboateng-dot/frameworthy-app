import { describe, it, expect, beforeEach, vi } from 'vitest';
import admin from 'firebase-admin';
import { sendPasswordResetLink } from '../index.js';
import { clearFirestore, clearAuthUsers } from './helpers.js';

const originalFetch = global.fetch;

const mockEmailjsFetch = (respond) => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
        if (String(url).includes('api.emailjs.com')) return respond(url, opts);
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

    it('sends a reset email for an existing user via EmailJS', async () => {
        await admin.auth().createUser({ email: 'user@example.com', password: 'password123' });
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockEmailjsFetch(fetchSpy);

        const result = await sendPasswordResetLink.run({ data: { email: 'user@example.com' } });
        expect(result).toEqual({ success: true });
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const [, opts] = fetchSpy.mock.calls[0];
        const body = JSON.parse(opts.body);
        expect(body.template_params.to_email).toBe('user@example.com');
        expect(typeof body.template_params.reset_link).toBe('string');
        expect(body.accessToken).toBe('test-emailjs-private-key');
    });

    it('does not leak whether an email exists — returns success for an unknown address without sending', async () => {
        const fetchSpy = vi.fn();
        mockEmailjsFetch(fetchSpy);

        const result = await sendPasswordResetLink.run({ data: { email: 'nobody@example.com' } });
        expect(result).toEqual({ success: true });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throttles repeat requests for the same address within the cooldown window', async () => {
        await admin.auth().createUser({ email: 'user@example.com', password: 'password123' });
        const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => 'ok' }));
        mockEmailjsFetch(fetchSpy);

        await sendPasswordResetLink.run({ data: { email: 'user@example.com' } });
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const second = await sendPasswordResetLink.run({ data: { email: 'USER@example.com' } });
        expect(second).toEqual({ success: true });
        expect(fetchSpy).toHaveBeenCalledTimes(1); // still 1 — second call was throttled, no second send
    });

    it('surfaces an internal error when EmailJS rejects the send', async () => {
        await admin.auth().createUser({ email: 'user@example.com', password: 'password123' });
        mockEmailjsFetch(async () => ({ ok: false, status: 500, text: async () => 'boom' }));

        await expect(sendPasswordResetLink.run({ data: { email: 'user@example.com' } }))
            .rejects.toMatchObject({ code: 'internal' });
    });

    it('surfaces an unavailable error when EmailJS cannot be reached', async () => {
        await admin.auth().createUser({ email: 'user@example.com', password: 'password123' });
        vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
            if (String(url).includes('api.emailjs.com')) throw new Error('network down');
            return originalFetch(url, opts);
        });

        await expect(sendPasswordResetLink.run({ data: { email: 'user@example.com' } }))
            .rejects.toMatchObject({ code: 'unavailable' });
    });
});
