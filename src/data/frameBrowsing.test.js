import { describe, expect, it } from 'vitest';
import { CATEGORIES, FRAME_STYLES } from './constants';
import { categoryForFrame, framesForCategory, FEATURED_FRAME_IDS, prodigiPresentationForFrame, displayCategoryName, PRODIGI_FRAME_CATEGORIES } from './frameBrowsing';

describe('frame catalogue browsing', () => {
    it('includes detailed Prodigi options in all six requested frame categories', () => {
        const prodigiCategories = CATEGORIES.filter(category => category.startsWith('Prodigi '));
        expect(prodigiCategories).toEqual([
            'Prodigi Classic Frames', 'Prodigi Box Frames', 'Prodigi Aluminium Frames',
            'Prodigi Classic Framed Canvas', 'Prodigi Float Framed Canvas', 'Prodigi Eco Framed Canvas',
        ]);
        for (const category of prodigiCategories) {
            const frames = framesForCategory(category);
            expect(frames.length).toBeGreaterThan(0);
            expect(frames.every(frame => frame.borderImageSource && frame.mouldingWidthIn > 0)).toBe(true);
            expect(prodigiPresentationForFrame(frames[0])).toMatchObject({ page: expect.stringContaining('prodigi.com'), views: expect.any(Array), specs: expect.any(Array) });
        }
    });

    it('shows concise category names in the shared curated picker', () => {
        expect(displayCategoryName('Prodigi Classic Framed Canvas')).toBe('Classic Framed Canvas');
        expect(displayCategoryName('Wood Finishes')).toBe('Wood Finishes');
        expect(PRODIGI_FRAME_CATEGORIES).toHaveLength(6);
        expect(PRODIGI_FRAME_CATEGORIES.every(category => category.startsWith('Prodigi '))).toBe(true);
        expect(categoryForFrame({ id: 'frame-8446', category: 'Modern & Minimalist' })).toBe('Featured Frames');
    });

    it('places every frame in exactly one nonempty category', () => {
        const groups = CATEGORIES.filter(category => category !== 'Featured Frames');
        const frames = groups.flatMap(category => {
            const entries = framesForCategory(category);
            expect(entries.length).toBeGreaterThan(0);
            return entries;
        });
        expect(frames).toHaveLength(FRAME_STYLES.length);
        expect(new Set(frames.map(frame => frame.id)).size).toBe(FRAME_STYLES.length);
    });

    it('uses the same valid featured selection for all entry points', () => {
        const featured = framesForCategory('Featured Frames');
        expect(featured.map(frame => frame.id)).toEqual(FEATURED_FRAME_IDS);
        expect(new Set(FEATURED_FRAME_IDS).size).toBe(FEATURED_FRAME_IDS.length);
        expect(FEATURED_FRAME_IDS[0]).toBe('frame-8446');
        expect(new Set(featured.map(frame => frame.category))).toEqual(
            new Set(CATEGORIES.filter(category => category !== 'Featured Frames'))
        );
    });

    it('resolves stale saved categories using the current frame ID', () => {
        expect(categoryForFrame({ id: 'frame-8838', category: 'Natural Woods' })).toBe('Featured Frames');
        expect(categoryForFrame({ id: 'frame-83735', category: 'Textured & Decorative' })).toBe('Glossy Finishes');
        expect(categoryForFrame({ id: 'removed-frame' })).toBe(CATEGORIES[0]);
    });
});
