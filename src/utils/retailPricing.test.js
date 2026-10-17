import { describe, expect, it } from 'vitest';
import { configuredItemRetailPrice, frameRetailPrice, FRAME_GROSS_MARGIN_PERCENT } from './retailPricing';

describe('frame retail pricing', () => {
    it('uses the shared 50% target gross margin', () => {
        expect(FRAME_GROSS_MARGIN_PERCENT).toBe(50);
        expect(frameRetailPrice(22)).toBe(44);
    });

    it('adds supplier-priced customizations after the marked-up base frame', () => {
        expect(configuredItemRetailPrice({ baseFrameCost: 22, configuredItemCost: 24 })).toBe(46);
    });

    it('rejects invalid margin inputs', () => {
        expect(frameRetailPrice(22, 100)).toBeNull();
        expect(configuredItemRetailPrice({ baseFrameCost: -1, configuredItemCost: 24 })).toBeNull();
    });
});
