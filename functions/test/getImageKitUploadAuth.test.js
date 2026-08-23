import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { getImageKitUploadAuth } from '../index.js';

// process.env.IMAGEKIT_PRIVATE_KEY is set in test/setup.js, standing in for
// the real Secret Manager value defineSecret() reads at runtime.
const PRIVATE_KEY = 'test-imagekit-private-key';

describe('getImageKitUploadAuth', () => {
    it('returns a token, a near-future expire, and a matching signature', async () => {
        const before = Math.floor(Date.now() / 1000);
        const result = await getImageKitUploadAuth.run({ data: {} });
        const after = Math.floor(Date.now() / 1000);

        expect(typeof result.token).toBe('string');
        expect(result.token.length).toBeGreaterThan(0);
        expect(result.expire).toBeGreaterThanOrEqual(before + 60 * 5);
        expect(result.expire).toBeLessThanOrEqual(after + 60 * 5);

        const expectedSignature = crypto
            .createHmac('sha1', PRIVATE_KEY)
            .update(result.token + String(result.expire))
            .digest('hex');
        expect(result.signature).toBe(expectedSignature);
    });

    it('issues a fresh token on every call', async () => {
        const first = await getImageKitUploadAuth.run({ data: {} });
        const second = await getImageKitUploadAuth.run({ data: {} });
        expect(first.token).not.toBe(second.token);
    });
});
