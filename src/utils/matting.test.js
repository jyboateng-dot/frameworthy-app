import { describe, it, expect } from 'vitest';
import {
    getMatReveal,
    clampMatWidthIn,
    sliderIndexToMatWidth,
    matWidthToSliderIndex,
    MAT_WIDTH_MIN_IN,
    MAT_WIDTH_MAX_IN,
    MAT_WIDTH_MAX_INDEX,
} from './matting';

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

describe('sliderIndexToMatWidth', () => {
    it('maps index 0 to "none" (the leftmost/no-mat position)', () => {
        expect(sliderIndexToMatWidth(0)).toBe('none');
        expect(sliderIndexToMatWidth(-1)).toBe('none');
    });

    it('maps index 1 (the very first move off "no mat") to exactly 1 inch, not 0.25', () => {
        expect(sliderIndexToMatWidth(1)).toBe(1);
    });

    it('adds MAT_WIDTH_STEP_IN per index after that', () => {
        expect(sliderIndexToMatWidth(2)).toBe(1.25);
        expect(sliderIndexToMatWidth(3)).toBe(1.5);
    });

    it('reaches MAT_WIDTH_MAX_IN at the top index', () => {
        expect(sliderIndexToMatWidth(MAT_WIDTH_MAX_INDEX)).toBe(MAT_WIDTH_MAX_IN);
    });
});

describe('matWidthToSliderIndex', () => {
    it('maps "none" and a missing value both to index 0', () => {
        expect(matWidthToSliderIndex('none')).toBe(0);
        expect(matWidthToSliderIndex(null)).toBe(0);
        expect(matWidthToSliderIndex(undefined)).toBe(0);
    });

    it('maps 1 inch to index 1', () => {
        expect(matWidthToSliderIndex(1)).toBe(1);
    });

    it('maps MAT_WIDTH_MAX_IN to MAT_WIDTH_MAX_INDEX', () => {
        expect(matWidthToSliderIndex(MAT_WIDTH_MAX_IN)).toBe(MAT_WIDTH_MAX_INDEX);
    });

    it('falls back gracefully for a legacy preset string from before this change', () => {
        expect(matWidthToSliderIndex('narrow')).toBe(matWidthToSliderIndex(2)); // NaN -> MAT_WIDTH_DEFAULT_IN
    });

    it('round-trips with sliderIndexToMatWidth across the whole range', () => {
        for (let i = 0; i <= MAT_WIDTH_MAX_INDEX; i++) {
            const width = sliderIndexToMatWidth(i);
            expect(matWidthToSliderIndex(width)).toBe(i);
        }
    });
});
