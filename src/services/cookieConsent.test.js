import { describe, it, expect, beforeEach } from 'vitest';
import { getConsentStatus, hasAnalyticsConsent, grantConsent, declineConsent } from './cookieConsent';

beforeEach(() => {
    localStorage.clear();
});

describe('cookieConsent', () => {
    it('has no status and no consent before any decision is made', () => {
        expect(getConsentStatus()).toBeNull();
        expect(hasAnalyticsConsent()).toBe(false);
    });

    it('records acceptance and reflects it as consent', () => {
        grantConsent();
        expect(getConsentStatus()).toBe('granted');
        expect(hasAnalyticsConsent()).toBe(true);
    });

    it('records a decline as a real status, distinct from "not yet decided"', () => {
        declineConsent();
        expect(getConsentStatus()).toBe('declined');
        expect(hasAnalyticsConsent()).toBe(false);
    });

    it('lets a later decision overwrite an earlier one', () => {
        declineConsent();
        expect(hasAnalyticsConsent()).toBe(false);
        grantConsent();
        expect(hasAnalyticsConsent()).toBe(true);
    });
});
