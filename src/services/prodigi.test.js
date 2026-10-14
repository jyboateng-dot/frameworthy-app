import { describe, expect, it } from 'vitest';
import { prodigiAttributesForProduct } from './prodigi';

describe('prodigiAttributesForProduct', () => {
    it('maps catalogue fields to the attribute names accepted by Prodigi', () => {
        expect(prodigiAttributesForProduct({
            frame: 'Box',
            options: {
                color: 'black',
                glaze: 'Acrylic / Perspex',
                mount: 'No mount / Mat',
                mountColor: '',
                paper: 'EMA',
                substrateWeight: '200gsm',
                wrap: '',
            },
        })).toEqual({
            frame: 'Box',
            color: 'black',
            glaze: 'Acrylic / Perspex',
            mount: 'No mount / Mat',
            substrateWeight: '200gsm',
            paperType: 'EMA',
        });
    });

    it('passes the mounted frame colour through to quotes and orders', () => {
        expect(prodigiAttributesForProduct({
            options: { mount: '2.4mm', mountColor: 'Off-white' },
        })).toEqual({ mount: '2.4mm', mountColor: 'Off-white' });
    });
});
