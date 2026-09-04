import { describe, it, expect } from 'vitest';
import { getMatReveal, clampMatWidthIn, MAT_WIDTH_MIN_IN, MAT_WIDTH_MAX_IN } from './matting';

const SIZE = { width: 20, height: 24 };

describe('getMatReveal', () => {
    it('returns all zeros for "none"', () => {
        expect(getMatReveal('none', SIZE)).toEqual({ topIn: 0, sideIn: 0, bottomIn: 0 });
    });

    it('returns all zeros when there is no size to frame yet', () => {
        expect(getMatReveal(2, null)).toEqual({ topIn: 0, sideIn: 0, bottomIn: 0 });
    });

    it('returns all zeros for a non-finite or non-positive width', () => {
        expect(getMatReveal(0, SIZE)).toEqual({ topIn: 0, sideIn: 0, bottomIn: 0 });
        expect(getMatReveal(NaN, SIZE)).toEqual({ topIn: 0, sideIn: 0, bottomIn: 0 });
    });

    it('uses the given width directly for top/side, independent of print size', () => {
        expect(getMatReveal(2, SIZE)).toEqual({ topIn: 2, sideIn: 2, bottomIn: 2.25 });
        expect(getMatReveal(2, { width: 40, height: 60 })).toEqual({ topIn: 2, sideIn: 2, bottomIn: 2.25 });
    });

    it('widens the bottom edge by the standard weighting, rounded to the nearest 1/8"', () => {
        // 3 * 1.1 = 3.3 -> nearest eighth is 3.25
        expect(getMatReveal(3, SIZE).bottomIn).toBe(3.25);
        // 1.5 * 1.1 = 1.65 -> nearest eighth is 1.625
        expect(getMatReveal(1.5, SIZE).bottomIn).toBe(1.625);
    });

    it('accepts a numeric string the same as a number (form input values)', () => {
        expect(getMatReveal('2.5', SIZE)).toEqual({ topIn: 2.5, sideIn: 2.5, bottomIn: 2.75 });
    });
});

describe('clampMatWidthIn', () => {
    it('leaves an in-range value untouched', () => {
        expect(clampMatWidthIn(3)).toBe(3);
    });

    it('clamps below the minimum up to it', () => {
        expect(clampMatWidthIn(0)).toBe(MAT_WIDTH_MIN_IN);
    });

    it('clamps above the maximum down to it', () => {
        expect(clampMatWidthIn(99)).toBe(MAT_WIDTH_MAX_IN);
    });
});
