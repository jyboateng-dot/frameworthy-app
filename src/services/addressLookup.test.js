import { describe, expect, it, vi } from 'vitest';
import { lookupDeliveryAddresses } from './addressLookup';

describe('postcode address lookup', () => {
    it('preserves all PAF address lines and separates Jersey from GB results', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 2000, result: [
            { udprn: 1, line_1: 'Test House', line_2: 'Test Road', line_3: 'St Helier', post_town: 'JERSEY', postcode: 'je23aa' },
            { udprn: 2, line_1: 'Wrong country', post_town: 'LONDON', postcode: 'SW1A 1AA' },
        ] }) });
        const results = await lookupDeliveryAddresses('JE2 3AA', 'JE', { provider: 'ideal', apiKey: 'test-browser-key', fetchImpl });
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ line2: 'Test Road, St Helier', city: 'JERSEY', postalOrZipCode: 'JE2 3AA', countryCode: 'JE' });
        expect(fetchImpl.mock.calls[0][0]).not.toContain('test-browser-key');
    });
    it('does not call the provider for an invalid country/postcode combination', async () => {
        const fetchImpl = vi.fn();
        await expect(lookupDeliveryAddresses('JE2 3AA', 'GB', { provider: 'ideal', apiKey: 'test', fetchImpl })).rejects.toThrow('selected country');
        expect(fetchImpl).not.toHaveBeenCalled();
    });
    it('handles missing configuration and unavailable providers without fabricated addresses', async () => {
        await expect(lookupDeliveryAddresses('SW1A 1AA', 'GB', { provider: 'ideal', apiKey: '' })).rejects.toThrow('manually');
        await expect(lookupDeliveryAddresses('SW1A 1AA', 'GB', { provider: 'ideal', apiKey: 'test', fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 429 }) })).rejects.toThrow('manually');
    });
});

describe('Geoapify address search', () => {
    const lookup = (results, countryCode = 'JE') => lookupDeliveryAddresses('Test House', countryCode, {
        provider: 'geoapify', apiKey: 'fake-key',
        fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results }) }),
    });

    it('maps a Jersey house name and retains the country and postcode', async () => {
        const results = await lookup([{ country_code: 'je', result_type: 'building', name: 'Test House', address_line1: 'Test House, Test Road', formatted: 'Test House, Jersey, JE2 3AA', postcode: 'JE23AA', district: 'St Helier' }]);
        expect(results[0]).toMatchObject({ countryCode: 'JE', city: 'Jersey', postalOrZipCode: 'JE2 3AA', line1: 'Test House, Test Road', line2: '', requiresCompletion: false });
    });

    it('requires manual completion for street matches and missing postal details', async () => {
        const results = await lookup([{ country_code: 'gb', result_type: 'street', street: 'Test Street', address_line1: 'Test Street', city: 'London' }], 'GB');
        expect(results[0]).toMatchObject({ requiresCompletion: true, postalOrZipCode: '' });
    });

    it('uses the displayed postal locality without adding map neighbourhoods to the address', async () => {
        const results = await lookup([{ country_code: 'gb', result_type: 'building', housenumber: '10', address_line1: '10 Test Street', address_line2: 'London, SW1A 1AA, United Kingdom', city: 'City of Westminster', suburb: 'Map neighbourhood', postcode: 'SW1A 1AA' }], 'GB');
        expect(results[0]).toMatchObject({ city: 'London', line2: '' });
    });

    it('does not mistake broad area matches or another country for a delivery address', async () => {
        const results = await lookup([
            { country_code: 'gb', result_type: 'building', address_line1: 'Foreign House', postcode: 'SW1A 1AA' },
            { country_code: 'je', result_type: 'postcode', address_line1: 'JE2 3AA', postcode: 'JE2 3AA' },
            { country_code: 'je', result_type: 'building', address_line1: 'Wrong Postcode', postcode: 'SW1A 1AA' },
        ]);
        expect(results).toEqual([]);
    });

    it('filters the request to Jersey and forwards cancellation', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
        const signal = new AbortController().signal;
        await lookupDeliveryAddresses('10 Test Road', 'JE', { provider: 'geoapify', apiKey: 'fake-key', fetchImpl, signal });
        const url = new URL(fetchImpl.mock.calls[0][0]);
        expect(url.searchParams.get('filter')).toBe('countrycode:je');
        expect(url.searchParams.get('text')).toBe('10 Test Road');
        expect(fetchImpl.mock.calls[0][1].signal).toBe(signal);
    });

    it('does not silently call the paid provider when Geoapify fails', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
        await expect(lookupDeliveryAddresses('Test Road', 'GB', { provider: 'geoapify', apiKey: 'fake-key', fetchImpl })).rejects.toThrow('manually');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl.mock.calls[0][0]).toContain('api.geoapify.com');
    });
});
