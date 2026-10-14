import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import PageMeta from './PageMeta';

const getMeta = (selector) => document.querySelector(selector)?.getAttribute('content');

afterEach(() => {
    cleanup();
    // PageMeta writes directly to the shared document head — nothing else
    // resets that between tests the way React unmount resets component state.
    document.title = '';
    document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')
        .forEach((el) => el.remove());
});

describe('PageMeta', () => {
    it('sets a page-specific title suffixed with the site name', () => {
        render(<PageMeta title="Canvas Art" description="Browse canvas art." />);
        expect(document.title).toBe('Canvas Art | FrameWorthy');
    });

    it('falls back to the site default title when none is given', () => {
        render(<PageMeta />);
        expect(document.title).toBe('FrameWorthy — Made-to-Order Frames & Canvas');
    });

    it('writes the description to the meta tag, creating it if missing', () => {
        render(<PageMeta title="Help" description="Answers to common questions." />);
        expect(getMeta('meta[name="description"]')).toBe('Answers to common questions.');
    });

    it('keeps Open Graph and Twitter card tags in sync with the page title/description', () => {
        render(<PageMeta title="Inspiration" description="Browse curated art." />);
        expect(getMeta('meta[property="og:title"]')).toBe('Inspiration | FrameWorthy');
        expect(getMeta('meta[property="og:description"]')).toBe('Browse curated art.');
        expect(getMeta('meta[name="twitter:title"]')).toBe('Inspiration | FrameWorthy');
        expect(getMeta('meta[name="twitter:description"]')).toBe('Browse curated art.');
    });

    it('updates the title again when a later page mounts with different props (SPA navigation)', () => {
        const { rerender } = render(<PageMeta title="Canvas Art" description="Browse canvas art." />);
        expect(document.title).toBe('Canvas Art | FrameWorthy');

        rerender(<PageMeta title="Help" description="Answers to common questions." />);
        expect(document.title).toBe('Help | FrameWorthy');
    });
});
