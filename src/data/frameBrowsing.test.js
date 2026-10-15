import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './constants';
import { activeFrameOrDefault, categoryForFrame, DEFAULT_PRODIGI_FRAME, framesForCategory, FEATURED_FRAME_IDS, prodigiPresentationForFrame, displayCategoryName, PRODIGI_FRAME_CATEGORIES, PRODIGI_FRAME_STYLES } from './frameBrowsing';

describe('frame catalogue browsing', () => {
    it('includes detailed options in all seven active frame categories', () => {
        const prodigiCategories = CATEGORIES.filter(category => category.startsWith('Prodigi '));
        expect(prodigiCategories).toEqual([
            'Prodigi Classic Frames', 'Prodigi Box Frames', 'Prodigi Aluminium Frames',
            'Prodigi Classic Framed Canvas', 'Prodigi Float Framed Canvas', 'Prodigi Eco Framed Canvas',
            'Prodigi Stretched Canvas',
        ]);
        for (const category of prodigiCategories) {
            const frames = framesForCategory(category);
            expect(frames.length).toBeGreaterThan(0);
            expect(frames.every(frame => frame.canvasOnly
                ? Boolean(frame.previewImg && frame.canvasThicknessMm)
                : Boolean(frame.borderImageSource && frame.mouldingWidthIn > 0))).toBe(true);
            expect(prodigiPresentationForFrame(frames[0])).toMatchObject({ page: expect.stringContaining('prodigi.com'), views: expect.any(Array), specs: expect.any(Array) });
        }
    });

    it('shows concise category names in the shared curated picker', () => {
        expect(displayCategoryName('Prodigi Classic Framed Canvas')).toBe('Classic Framed Canvas');
        expect(displayCategoryName('Wood Finishes')).toBe('Wood Finishes');
        expect(PRODIGI_FRAME_CATEGORIES).toHaveLength(7);
        expect(PRODIGI_FRAME_CATEGORIES.every(category => category.startsWith('Prodigi '))).toBe(true);
        expect(categoryForFrame({ id: 'frame-8446', category: 'Modern & Minimalist' })).toBe(PRODIGI_FRAME_CATEGORIES[0]);
    });

    it('uses the matching finish thumbnail for every classic framed canvas', () => {
        const frames = framesForCategory('Prodigi Classic Framed Canvas');

        expect(frames).toHaveLength(8);
        expect(new Set(frames.map(frame => frame.cornerImage))).toHaveLength(8);
        for (const frame of frames) {
            expect(frame.cornerImage).toBe(frame.borderImageSource);
            expect(frame.previewImg).toBe(frame.borderImageSource);
        }
    });

    it('uses the matching finish thumbnail for every float framed canvas', () => {
        const frames = framesForCategory('Prodigi Float Framed Canvas');

        expect(frames).toHaveLength(6);
        expect(new Set(frames.map(frame => frame.thumbnailImage))).toHaveLength(6);
        for (const frame of frames) {
            expect(frame.thumbnailImage).toMatch(/^\/prodigi\/views\/canvas-float-/);
            expect(frame.cornerImage).toBe(frame.borderImageSource);
            expect(frame.previewImg).toBe(frame.borderImageSource);
        }
        expect(frames.find(frame => frame.prodigiColor === 'silver')?.thumbnailCrop).toBeUndefined();
    });

    it('uses a canvas-in-frame thumbnail and matching finish texture for every eco framed canvas', () => {
        const frames = framesForCategory('Prodigi Eco Framed Canvas');

        expect(frames).toHaveLength(6);
        expect(new Set(frames.map(frame => frame.thumbnailImage))).toHaveLength(6);
        for (const frame of frames) {
            expect(frame.thumbnailImage).toMatch(/^\/prodigi\/views\/canvas-(eco|float)-/);
            expect(frame.cornerImage).toBe(frame.borderImageSource);
            expect(frame.previewImg).toBe(frame.borderImageSource);
        }
        expect(frames.find(frame => frame.prodigiColor === 'black')?.thumbnailImage).toBe('/prodigi/views/canvas-eco-black-corner.jpg');
        expect(frames.find(frame => frame.prodigiColor === 'white')?.thumbnailImage).toBe('/prodigi/views/canvas-eco-white-corner.jpg');
        expect(frames.every(frame => frame.thumbnailCrop === undefined)).toBe(true);
    });

    it('uses the approved product image wherever stretched canvas is shown as a thumbnail', () => {
        const frame = PRODIGI_FRAME_STYLES.find(({ prodigiProduct }) => prodigiProduct === 'stretched-canvas');

        expect(frame?.thumbnailImage).toBe('/prodigi/views/stretched-canvas-product.jpg');
        expect(frame?.previewImg).toBe('/prodigi/views/stretched-canvas-product.jpg');
    });

    it('places every active frame in exactly one nonempty fulfilment category', () => {
        const groups = PRODIGI_FRAME_CATEGORIES;
        const frames = groups.flatMap(category => {
            const entries = framesForCategory(category);
            expect(entries.length).toBeGreaterThan(0);
            return entries;
        });
        expect(frames).toHaveLength(PRODIGI_FRAME_STYLES.filter(frame => groups.includes(frame.category)).length);
        expect(new Set(frames.map(frame => frame.id)).size).toBe(frames.length);
    });

    it('uses the same valid featured selection for all entry points', () => {
        const featured = framesForCategory('Featured Frames');
        expect(featured.map(frame => frame.id)).toEqual(FEATURED_FRAME_IDS);
        expect(new Set(FEATURED_FRAME_IDS).size).toBe(FEATURED_FRAME_IDS.length);
        expect(FEATURED_FRAME_IDS[0]).toBe('prodigi-classic-black');
        expect(new Set(featured.map(frame => frame.category))).toEqual(
            new Set(PRODIGI_FRAME_CATEGORIES)
        );
    });

    it('parks legacy and stale frame selections behind the active default', () => {
        expect(framesForCategory('Modern & Minimalist')).toEqual([]);
        expect(categoryForFrame({ id: 'frame-8838', category: 'Natural Woods' })).toBe(PRODIGI_FRAME_CATEGORIES[0]);
        expect(categoryForFrame({ id: 'removed-frame' })).toBe(PRODIGI_FRAME_CATEGORIES[0]);
        expect(activeFrameOrDefault({ id: 'frame-8446' })).toBe(DEFAULT_PRODIGI_FRAME);
    });
});
