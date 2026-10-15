import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearImageCache, loadImageCached } from './imageCache';

let created;
let behaviour;

// jsdom never loads images, so stand in for Image and decide per-test whether
// a given src loads or errors.
class FakeImage {
    constructor() { created.push(this); }
    set src(value) {
        this._src = value;
        queueMicrotask(() => (behaviour(value) ? this.onload?.() : this.onerror?.(new Event('error'))));
    }
    get src() { return this._src; }
}

describe('loadImageCached', () => {
    beforeEach(() => {
        created = [];
        behaviour = () => true;
        clearImageCache();
        vi.stubGlobal('Image', FakeImage);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('loads an image once for repeated requests of the same source', async () => {
        const [a, b] = await Promise.all([loadImageCached('a.jpg'), loadImageCached('a.jpg')]);
        const c = await loadImageCached('a.jpg');
        expect(a).toBe(b);
        expect(a).toBe(c);
        expect(created).toHaveLength(1);
        expect(created[0].crossOrigin).toBe('anonymous');
    });

    it('keeps only the most recent source so large decoded images are not retained', async () => {
        await loadImageCached('a.jpg');
        await loadImageCached('b.jpg');
        await loadImageCached('a.jpg');
        expect(created).toHaveLength(3);
    });

    it('does not cache failures, so a retry loads again', async () => {
        behaviour = () => false;
        await expect(loadImageCached('bad.jpg')).rejects.toThrow('Could not load the original image');
        behaviour = () => true;
        await expect(loadImageCached('bad.jpg')).resolves.toBeInstanceOf(FakeImage);
        expect(created).toHaveLength(2);
    });
});
