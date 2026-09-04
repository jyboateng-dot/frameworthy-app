import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/storage', () => ({
    getPrintQualityJpegUrl: vi.fn(() => 'https://res.cloudinary.com/demo/print.jpg'),
}));

import {
    generateItemDescription,
    formatDimensionWithOrientation,
    formatOrdersForSharing,
    formatOrderForClient,
    GLASS_LABELS,
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
});

describe('formatDimensionWithOrientation', () => {
    it('combines dimension text and capitalized orientation', () => {
        expect(formatDimensionWithOrientation('8x10', 'landscape')).toBe('8x10, Landscape');
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
        expect(Object.keys(HARDWARE_LABELS)).toEqual(['wire', 'sawtooth', 'french-cleat', 'easel']);
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
