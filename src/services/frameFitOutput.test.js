import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./storage', () => ({ uploadImageToCloud: vi.fn() }));
vi.mock('../utils/imageCache', () => ({
    loadImageCached: vi.fn().mockResolvedValue({ naturalWidth: 4000, naturalHeight: 3000 }),
}));
vi.mock('../utils/frameFit', () => ({
    imageCrop: vi.fn(() => ({ x: 0, y: 0, w: 4000, h: 3000 })),
}));

import { prepareFrameOutput } from './frameFitOutput';
import { uploadImageToCloud } from './storage';
import { loadImageCached } from '../utils/imageCache';
import { imageCrop } from '../utils/frameFit';

const geometry = {
    width: 10, height: 8, mat: 1, rail: 0.5, outerWidth: 11, outerHeight: 9,
    apertureWidth: 8, apertureHeight: 6,
};
const run = (options) => prepareFrameOutput('art.jpg', geometry, { x: 0, y: 0 }, '#000', '#fff', options);

let encodings;

// jsdom has no canvas implementation, so stub just enough of one to observe
// what gets encoded and uploaded.
beforeEach(() => {
    encodings = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillRect: vi.fn(), drawImage: vi.fn(), set fillStyle(value) { this._fill = value; },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(callback, type, quality) {
        encodings.push({ type, quality, width: this.width, height: this.height });
        callback(new Blob(['x'], { type }));
    });
    uploadImageToCloud.mockReset();
    loadImageCached.mockResolvedValue({ naturalWidth: 4000, naturalHeight: 3000 });
    imageCrop.mockImplementation(() => ({ x: 0, y: 0, w: 4000, h: 3000 }));
});
afterEach(() => vi.restoreAllMocks());

describe('prepareFrameOutput', () => {
    it('starts both uploads before either finishes', async () => {
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        uploadImageToCloud.mockImplementation(async (file) => { await gate; return `https://cdn/${file.name}`; });

        const pending = run();
        await vi.waitFor(() => expect(uploadImageToCloud).toHaveBeenCalledTimes(2));
        release();
        const output = await pending;

        expect(output.productionImage).toBe('https://cdn/frame-print.jpg');
        expect(output.visualizerImage).toBe('https://cdn/frame-preview.jpg');
        expect(output.thumbnailUpload).toBeUndefined();
    });

    it('encodes the preview as a JPEG while leaving print quality unchanged', async () => {
        uploadImageToCloud.mockResolvedValue('https://cdn/x');
        await run();
        const print = encodings.find((e) => e.width !== 1200);
        const preview = encodings.find((e) => e.width === 1200);
        expect(print).toMatchObject({ type: 'image/jpeg', quality: 0.98 });
        expect(preview).toMatchObject({ type: 'image/jpeg', quality: 0.85 });
    });

    it('preserves >6000px 300 DPI print dimensions on desktop and permits a 150 DPI canvas under the mobile cap', async () => {
        uploadImageToCloud.mockResolvedValue('https://cdn/x');
        loadImageCached.mockResolvedValue({ naturalWidth: 9000, naturalHeight: 6000 });
        imageCrop.mockImplementation(() => ({ x: 0, y: 0, w: 9000, h: 6000 }));

        const largeGeometry = {
            width: 30, height: 20, mat: 0, rail: 0.8, outerWidth: 31.6, outerHeight: 21.6,
            apertureWidth: 30, apertureHeight: 20,
        };

        const desktopOut = await prepareFrameOutput('art.jpg', largeGeometry, { x: 0, y: 0 }, '#000', '#fff', { isMobile: false });
        expect(desktopOut.productionSpec.printWidthPx).toBe(9000);
        expect(desktopOut.productionSpec.printHeightPx).toBe(6000);

        const mobileOut = await prepareFrameOutput('art.jpg', largeGeometry, { x: 0, y: 0 }, '#000', '#fff', {
            isMobile: true,
            frame: { isCanvas: true },
            minimumDpi: 150,
        });
        expect(mobileOut.productionSpec.printWidthPx * mobileOut.productionSpec.printHeightPx).toBeLessThanOrEqual(16_010_000);
        expect(mobileOut.productionSpec.printWidthPx).toBeGreaterThan(4800);
    });

    it('rejects a mobile paper crop when the canvas cap would lower it below 240 DPI', async () => {
        loadImageCached.mockResolvedValue({ naturalWidth: 9000, naturalHeight: 6000 });
        imageCrop.mockImplementation(() => ({ x: 0, y: 0, w: 9000, h: 6000 }));
        const largeGeometry = {
            width: 30, height: 20, mat: 0, rail: 0.8, outerWidth: 31.6, outerHeight: 21.6,
            apertureWidth: 30, apertureHeight: 20,
        };
        await expect(prepareFrameOutput('art.jpg', largeGeometry, { x: 0, y: 0 }, '#000', '#fff', {
            isMobile: true,
            minimumDpi: 240,
        })).rejects.toThrow('adjusted crop');
        expect(uploadImageToCloud).not.toHaveBeenCalled();
    });

    it('with deferThumbnail resolves on the print upload alone and hands back the preview as a promise', async () => {
        let releaseThumb;
        const thumbGate = new Promise((resolve) => { releaseThumb = resolve; });
        uploadImageToCloud.mockImplementation(async (file) => {
            if (file.name === 'frame-preview.jpg') await thumbGate;
            return `https://cdn/${file.name}`;
        });

        const output = await run({ deferThumbnail: true });
        expect(output.productionImage).toBe('https://cdn/frame-print.jpg');
        expect(output.visualizerImage).toBeNull();
        expect(output.productionSpec).toMatchObject({ units: 'cm', printIsCropped: true });

        releaseThumb();
        await expect(output.thumbnailUpload).resolves.toBe('https://cdn/frame-preview.jpg');
    });

    it('treats a failed deferred preview as null rather than failing the add to cart', async () => {
        uploadImageToCloud.mockImplementation(async (file) => {
            if (file.name === 'frame-preview.jpg') throw new Error('image host down');
            return 'https://cdn/print.jpg';
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const output = await run({ deferThumbnail: true });
        expect(output.productionImage).toBe('https://cdn/print.jpg');
        await expect(output.thumbnailUpload).resolves.toBeNull();
    });

    it('still fails when the print upload fails, even with a deferred preview', async () => {
        uploadImageToCloud.mockImplementation(async (file) => {
            if (file.name === 'frame-print.jpg') throw new Error('print upload failed');
            return 'https://cdn/preview.jpg';
        });
        await expect(run({ deferThumbnail: true })).rejects.toThrow('print upload failed');
    });

    it('fails the whole output when either upload fails in the default mode', async () => {
        uploadImageToCloud.mockImplementation(async (file) => {
            if (file.name === 'frame-preview.jpg') throw new Error('preview failed');
            return 'https://cdn/print.jpg';
        });
        await expect(run()).rejects.toThrow('preview failed');
    });
});

