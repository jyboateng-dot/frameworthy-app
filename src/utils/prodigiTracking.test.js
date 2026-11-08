import { describe, expect, it } from 'vitest';
import { getCustomerFulfilmentStatus, getProdigiTrackingLinks } from './prodigiTracking';

describe('prodigi tracking presentation', () => {
    it('normalizes Prodigi shipment tracking links', () => {
        expect(getProdigiTrackingLinks({
            prodigi: {
                shipments: [{
                    id: 'shp_1',
                    carrier: 'Courier',
                    tracking: { number: 'ABC123', url: 'https://courier.example/ABC123' },
                }],
            },
        })).toEqual([{
            id: 'shp_1',
            carrier: 'Courier',
            tracking: { number: 'ABC123', url: 'https://courier.example/ABC123' },
            trackingUrl: 'https://courier.example/ABC123',
            trackingNumber: 'ABC123',
        }]);
    });

    it('uses shipment and Prodigi stages ahead of the admin fallback status', () => {
        expect(getCustomerFulfilmentStatus({ status: 'pending', prodigi: { stage: 'InProgress' } })).toBe('processing');
        expect(getCustomerFulfilmentStatus({ status: 'processing', prodigi: { shipments: [{ status: 'Shipped' }] } })).toBe('shipped');
        expect(getCustomerFulfilmentStatus({ status: 'processing', prodigi: { stage: 'Complete' } })).toBe('delivered');
    });
});
