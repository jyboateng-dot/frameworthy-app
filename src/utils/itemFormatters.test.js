import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/storage', () => ({
    getPrintQualityJpegUrl: vi.fn(() => 'https://res.cloudinary.com/demo/print.jpg'),
}));

import {
    generateItemDescription,
    getItemCustomizerSpecs,
    getItemTitle,
    getItemSubtitle,
    isCanvasProduct,
    formatDimensionWithOrientation,
    formatOrdersForSharing,
    formatOrderForClient,
    GLASS_LABELS,
    PRODIGI_GLAZE_LABELS,
    HARDWARE_LABELS,
    MAT_WIDTH_LABELS,
    matWidthLabel,
} from './itemFormatters';

describe('generateItemDescription', () => {
    it('defaults to "Custom Photo" with no distinguishing fields', () => {
        expect(generateItemDescription({})).toBe('Custom Photo');
    });

    it('uses the poster title for album/movie poster items', () => {
        expect(generateItemDescription({ isAlbumPoster: true, posterMeta: { title: 'Abbey Road' } }))
            .toBe('Abbey Road Poster');
        expect(generateItemDescription({ isMoviePosterPrint: true, posterMeta: { title: 'Inception' } }))
            .toBe('Inception Poster');
    });

    it('uses presetTitle when no poster metadata is present', () => {
        expect(generateItemDescription({ presetTitle: 'Sunset Canvas' })).toBe('Sunset Canvas');
    });

    it('appends frame, mat, glazing, and hardware specs in order', () => {
        const item = {
            presetTitle: 'Sunset Canvas',
            selectedFrame: { name: 'Oak' },
            matWidth: 'standard',
            matColor: { name: 'Polar White' },
            glassType: 'museum',
            hardwareType: 'wire',
        };
        expect(generateItemDescription(item)).toBe(
            'Sunset Canvas - Oak Frame, Standard Polar White Mat, Museum Glass Glazing, Wire Hanging Hardware'
        );
    });

    it('omits the mat spec entirely when matWidth is "none"', () => {
        const item = { presetTitle: 'X', matWidth: 'none', matColor: { name: 'Black' } };
        expect(generateItemDescription(item)).toBe('X');
    });

    it('falls back to a generic "{width} Mat" label without a mat color', () => {
        const item = { presetTitle: 'X', matWidth: 'wide' };
        expect(generateItemDescription(item)).toBe('X - Wide Mat');
    });

    it('falls back to the raw value for unknown glass/hardware/mat-width codes', () => {
        const item = { presetTitle: 'X', glassType: 'exotic-glass', hardwareType: 'exotic-hardware' };
        expect(generateItemDescription(item)).toBe('X - exotic-glass Glazing, exotic-hardware Hardware');
    });

    it('formats Prodigi mounted print descriptions with accurate mount and glazing', () => {
        const item = {
            presetTitle: 'Family Portrait',
            selectedFrame: { name: 'Classic Black' },
            prodigi: {
                sku: 'GLOBAL-CFPM-A5',
                productFamily: 'classic-mounted',
                mountWidthIn: 2,
                attributes: {
                    frame: 'Classic',
                    color: 'black',
                    mount: '2.4mm',
                    mountColor: 'Snow white',
                    glaze: 'Float glass',
                    paperType: 'EMA',
                },
                hangingHardware: { id: 'cobra-hook', label: 'Cobra hook', included: true },
            },
            hardwareType: 'cobra-hook',
        };
        expect(generateItemDescription(item)).toBe(
            'Family Portrait - Classic Black Frame, 2" Snow white Mount, Float Glass Glazing, Cobra Hook Hardware'
        );
    });

    it('formats Prodigi Acrylic / Perspex glaze as Shatterproof Perspex and NEVER Standard Acrylic', () => {
        const item = {
            presetTitle: 'Family Portrait',
            selectedFrame: { name: 'Classic Black' },
            prodigi: {
                sku: 'GLOBAL-CFP-8X10',
                attributes: {
                    frame: 'Classic',
                    color: 'black',
                    glaze: 'Acrylic / Perspex',
                },
            },
        };
        expect(generateItemDescription(item)).toBe(
            'Family Portrait - Classic Black Frame, Shatterproof Perspex Glazing'
        );
        expect(generateItemDescription(item)).not.toContain('Standard Acrylic');
    });

    it('formats Prodigi canvas with wrap and omits bogus glazing', () => {
        const item = {
            presetTitle: 'Abstract Landscape',
            selectedFrame: { name: 'Antique Gold Floater', prodigiProduct: 'canvas-float' },
            glassType: 'canvas-floater',
            prodigi: {
                sku: 'GLOBAL-FRA-CAN-8X8',
                productFamily: 'canvas-float',
                attributes: {
                    frame: 'Float frame, 38mm standard stretcher bar',
                    color: 'antique-gold',
                    wrap: 'ImageWrap',
                    paperType: 'Standard canvas (SC)',
                },
                hangingHardware: { id: 'sawtooth', label: 'Sawtooth hanger', included: true },
            },
            hardwareType: 'sawtooth',
        };
        expect(generateItemDescription(item)).toBe(
            'Abstract Landscape - Antique Gold Floater Frame, Image Wrap, Sawtooth Hanger Hardware'
        );
        expect(generateItemDescription(item)).not.toContain('Glazing');
    });
});

describe('getItemCustomizerSpecs', () => {
    it('returns empty array for empty item', () => {
        expect(getItemCustomizerSpecs(null)).toEqual([]);
        expect(getItemCustomizerSpecs({})).toEqual([]);
    });

    it('returns structured specs for a mounted Prodigi frame without repeating frame by default', () => {
        const item = {
            selectedFrame: { name: 'Classic Black' },
            prodigi: {
                sku: 'GLOBAL-CFPM-8X10',
                productFamily: 'classic-mounted',
                mountWidthIn: 2,
                attributes: {
                    frame: 'Classic',
                    color: 'black',
                    mount: '2.4mm',
                    mountColor: 'Snow white',
                    glaze: 'Motheye',
                    paperType: 'EMA',
                    substrateWeight: '200gsm',
                },
                hangingHardware: { label: 'Cobra hook', included: true },
            },
        };
        expect(getItemCustomizerSpecs(item)).toEqual([
            { label: 'Mount', value: '2" Snow white' },
            { label: 'Glazing', value: 'Moth-eye Anti-Reflective' },
            { label: 'Paper', value: 'Enhanced Matte Art Paper (200gsm)' },
            { label: 'Hardware', value: 'Cobra hook (included)' },
        ]);
    });

    it('includes frame when includeFrame: true is passed', () => {
        const item = {
            selectedFrame: { name: 'Classic Black' },
            prodigi: {
                sku: 'GLOBAL-CFPM-8X10',
                attributes: {
                    glaze: 'Acrylic / Perspex',
                },
            },
        };
        const specs = getItemCustomizerSpecs(item, { includeFrame: true });
        expect(specs[0]).toEqual({ label: 'Frame', value: 'Classic Black' });
        expect(specs.find(s => s.label === 'Glazing')?.value).toBe('Shatterproof Perspex');
    });

    it('returns structured specs for a Prodigi stretched canvas', () => {
        const item = {
            selectedFrame: { name: 'Stretched Canvas (38mm)', prodigiProduct: 'stretched-canvas' },
            prodigi: {
                sku: 'GLOBAL-CAN-12X12',
                productFamily: 'stretched-canvas',
                attributes: {
                    frame: '38mm standard stretcher bar',
                    wrap: 'Black',
                    paperType: 'Standard canvas (SC)',
                    substrateWeight: '400gsm',
                },
            },
        };
        expect(getItemCustomizerSpecs(item)).toEqual([
            { label: 'Edge Finish', value: 'Black Edge' },
            { label: 'Material', value: 'Standard Cotton Canvas (400gsm)' },
        ]);
        expect(getItemCustomizerSpecs(item).some(s => s.label === 'Glazing')).toBe(false);
    });
});

describe('isCanvasProduct, getItemTitle, and getItemSubtitle', () => {
    it('correctly identifies canvas products', () => {
        expect(isCanvasProduct({ selectedFrame: { id: 'frame-canvas' } })).toBe(true);
        expect(isCanvasProduct({ selectedFrame: { prodigiProduct: 'stretched-canvas' } })).toBe(true);
        expect(isCanvasProduct({ selectedFrame: { prodigiProduct: 'canvas-float' } })).toBe(true);
        expect(isCanvasProduct({ prodigi: { productFamily: 'canvas-float' } })).toBe(true);
        expect(isCanvasProduct({ selectedFrame: { name: 'Classic Black' } })).toBe(false);
    });

    it('produces clean titles and subtitles', () => {
        const framed = { selectedFrame: { name: 'Classic · Black' } };
        expect(getItemTitle(framed)).toBe('Custom Framed Print');
        expect(getItemSubtitle(framed)).toBe('Classic · Black');

        const floatCanvas = {
            selectedFrame: { name: 'Antique Gold Floater', prodigiProduct: 'canvas-float' },
        };
        expect(getItemTitle(floatCanvas)).toBe('Custom Floater Canvas');
        expect(getItemSubtitle(floatCanvas)).toBe('Antique Gold Floater');

        const stretched = {
            selectedFrame: { name: 'Stretched Canvas (38mm)', prodigiProduct: 'stretched-canvas' },
        };
        expect(getItemTitle(stretched)).toBe('Custom Canvas Print');
        expect(getItemSubtitle(stretched)).toBe('Stretched Canvas (38mm)');

        const poster = {
            isAlbumPoster: true,
            posterMeta: { title: 'Abbey Road' },
            selectedFrame: { name: 'Classic · Black' },
        };
        expect(getItemTitle(poster)).toBe('Abbey Road Poster');
        expect(getItemSubtitle(poster)).toBe('Classic · Black');
    });
});

describe('formatDimensionWithOrientation', () => {
    it('combines dimension text and capitalized orientation', () => {
        expect(formatDimensionWithOrientation('8x10', 'landscape')).toBe('8x10, Landscape');
    });

    it('correctly formats compound Prodigi labels in cm without confusing inches for cm', () => {
        expect(formatDimensionWithOrientation('11x14" · 28x35cm', 'landscape', 'cm')).toBe('35 × 28 cm, Landscape');
        expect(formatDimensionWithOrientation('11x14" · 28x35cm', 'portrait', 'cm')).toBe('28 × 35 cm, Portrait');
    });

    it('correctly formats compound Prodigi labels in inches', () => {
        expect(formatDimensionWithOrientation('11x14" · 28x35cm', 'landscape', 'in')).toBe('14 × 11 in, Landscape');
        expect(formatDimensionWithOrientation('11x14" · 28x35cm', 'portrait', 'in')).toBe('11 × 14 in, Portrait');
    });

    it('returns just the dimension when orientation is missing', () => {
        expect(formatDimensionWithOrientation('8x10', '')).toBe('8x10');
    });

    it('returns just the orientation when dimension text is missing', () => {
        expect(formatDimensionWithOrientation('', 'portrait')).toBe('Portrait');
    });

    it('returns an empty string when both are missing', () => {
        expect(formatDimensionWithOrientation('', '')).toBe('');
    });
});

describe('formatOrdersForSharing', () => {
    it('returns an empty string for no orders', () => {
        expect(formatOrdersForSharing([])).toBe('');
        expect(formatOrdersForSharing(null)).toBe('');
    });

    it('includes order id, customer email, and item quantity total', () => {
        const orders = [{
            id: 'abcdef1234567890',
            userEmail: 'buyer@example.com',
            createdAt: { seconds: 1700000000 },
            items: [
                { quantity: 2, presetTitle: 'A', selectedSize: { label: '8x10' }, image: 'x.jpg', matWidth: 'none' },
                { quantity: 1, presetTitle: 'B', selectedSize: { label: '5x7' }, image: 'y.jpg', matWidth: 'none' },
            ],
        }];
        const text = formatOrdersForSharing(orders);
        expect(text).toContain('Order ABCDEF12');
        expect(text).toContain('buyer@example.com');
        expect(text).toContain('ITEMS TO PRODUCE (3)');
    });

    it('defaults to a guest email when userEmail is absent', () => {
        const orders = [{ id: 'abcdef1234567890', createdAt: { seconds: 1700000000 }, items: [] }];
        expect(formatOrdersForSharing(orders)).toContain('guest@frameworthy.com');
    });
});

describe('formatOrderForClient', () => {
    it('returns an empty string for a missing order', () => {
        expect(formatOrderForClient(null)).toBe('');
    });

    it('formats a friendly customer-facing summary without production jargon', () => {
        const order = {
            id: 'abcdef1234567890',
            customerName: 'Ama',
            status: 'shipped',
            createdAt: { seconds: 1700000000 },
            items: [{ quantity: 1, presetTitle: 'Canvas Print', selectedSize: { label: '8x10' }, price: 150 }],
            totalPrice: 150,
        };
        const text = formatOrderForClient(order);
        expect(text).toContain('Hi Ama');
        expect(text).toContain('Status: Shipped');
        expect(text).toContain('1x Canvas Print (8x10) — GHS 150.00');
        expect(text).toContain('Total: GHS 150.00');
        expect(text).not.toContain('Glazing');
        expect(text).not.toContain('Print-Ready JPEG');
    });

    it('uses GBP for a GBP order summary', () => {
        const text = formatOrderForClient({
            id: 'abcdef1234567890', currency: 'GBP', items: [{ presetTitle: 'Classic Frame', price: 45.42 }], totalPrice: 45.42,
        });
        expect(text).toContain('£ 45.42');
        expect(text).not.toContain('GHS');
    });

    it('falls back to "there" and totals of 0 when name/price are missing', () => {
        const order = { id: 'abcdef1234567890', items: [] };
        const text = formatOrderForClient(order);
        expect(text).toContain('Hi there');
        expect(text).toContain('Total: GHS 0.00');
    });
});

describe('label maps stay in sync with the values used elsewhere in the app', () => {
    it('covers the expected glass, hardware, and mat-width codes', () => {
        expect(Object.keys(GLASS_LABELS)).toEqual(['standard', 'non-glare', 'museum', 'canvas-traditional', 'canvas-floater']);
        expect(Object.keys(HARDWARE_LABELS)).toEqual(['wire', 'sawtooth', 'cobra-hook', 'built-in-rear-hanger', 'french-cleat', 'easel']);
        expect(Object.keys(MAT_WIDTH_LABELS)).toEqual(['none', 'narrow', 'standard', 'wide']);
    });
});

describe('matWidthLabel', () => {
    it('labels "none" and a missing value both as "No Mat"', () => {
        expect(matWidthLabel('none')).toBe('No Mat');
        expect(matWidthLabel(null)).toBe('No Mat');
        expect(matWidthLabel(undefined)).toBe('No Mat');
    });

    it('still labels the three legacy presets from before the mat-width slider', () => {
        expect(matWidthLabel('narrow')).toBe('Narrow Mat');
        expect(matWidthLabel('standard')).toBe('Standard Mat');
        expect(matWidthLabel('wide')).toBe('Wide Mat');
    });

    it('labels a numeric width (the current, slider-set shape) with its inch value', () => {
        expect(matWidthLabel(2)).toBe('2" Mat');
        expect(matWidthLabel(2.5)).toBe('2.5" Mat');
    });

    it('labels a numeric-string width the same as a number (Firestore round-trips can store either)', () => {
        expect(matWidthLabel('2.5')).toBe('2.5" Mat');
    });
});
