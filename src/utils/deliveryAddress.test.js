import { describe, expect, it } from 'vitest';
import { deliveryCountryName, isValidDeliveryPostalCode, normalizePostalCode } from './deliveryAddress';

describe('delivery address helpers', () => {
    it('normalizes UK and Jersey postcodes for order payloads', () => {
        expect(normalizePostalCode('  je1   1aa ')).toBe('JE1 1AA');
        expect(isValidDeliveryPostalCode('JE', 'je1 1aa')).toBe(true);
        expect(isValidDeliveryPostalCode('GB', 'SW1A 1AA')).toBe(true);
    });

    it('rejects malformed GB/Jersey postcodes while allowing other market postal codes', () => {
        expect(isValidDeliveryPostalCode('GB', 'London')).toBe(false);
        expect(isValidDeliveryPostalCode('JE', 'JE11')).toBe(false);
        expect(isValidDeliveryPostalCode('GH', '00233')).toBe(true);
    });

    it('uses customer-facing country names', () => {
        expect(deliveryCountryName('GB')).toBe('United Kingdom');
        expect(deliveryCountryName('JE')).toBe('Jersey');
    });
});
