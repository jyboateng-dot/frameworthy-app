import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocked at the top level, for every test in this file — imagekitUpload.js
// imports the shared src/services/firebase.js module, which calls
// initializeApp/initializeAppCheck as a side effect of being imported at
// all. That's fine in the real app (one-time, at startup) but wrong to run
// repeatedly inside a jsdom test environment, so storage.js's two provider
// imports are stubbed out here rather than let that chain execute.
vi.mock('./providers/cloudinaryUpload', () => ({ uploadToCloudinary: vi.fn() }));
vi.mock('./providers/imagekitUpload', () => ({ uploadToImageKit: vi.fn() }));

describe('getThumbnailUrl', () => {
    // Doesn't depend on Cloudinary env config, safe to import directly.
    let getThumbnailUrl;
    beforeEach(async () => {
        vi.resetModules();
        ({ getThumbnailUrl } = await import('./storage.js'));
    });

    it('returns non-string input unchanged', () => {
        expect(getThumbnailUrl(null)).toBeNull();
        expect(getThumbnailUrl(undefined)).toBeUndefined();
    });

    it('leaves unrecognized-host URLs untouched', () => {
        const url = 'https://example.com/photo.jpg';
        expect(getThumbnailUrl(url)).toBe(url);
    });

    it('injects a width/quality transform into a Cloudinary upload URL', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        expect(getThumbnailUrl(url)).toBe(
            'https://res.cloudinary.com/demo/image/upload/w_400,c_limit,q_auto,f_auto/v1/photo.jpg'
        );
    });

    it('honors a custom width on a Cloudinary URL', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        expect(getThumbnailUrl(url, 800)).toContain('w_800,c_limit,q_auto,f_auto');
    });

    it('inserts a width/crop transform into an ImageKit URL', () => {
        const url = 'https://ik.imagekit.io/frameworthy/movies/tt0055630.jpg';
        expect(getThumbnailUrl(url)).toBe(
            'https://ik.imagekit.io/frameworthy/tr:w-400,c-at_max,q-80/movies/tt0055630.jpg'
        );
    });

    it('honors a custom width on an ImageKit URL', () => {
        const url = 'https://ik.imagekit.io/frameworthy/movies/tt0055630.jpg';
        expect(getThumbnailUrl(url, 800)).toContain('tr:w-800,c-at_max,q-80');
    });

    it('is idempotent on an already-transformed ImageKit URL instead of stacking tr: segments', () => {
        // Several catalogue pages call getThumbnailUrl twice on the same
        // image (once building the product list, once again in the card
        // component) — harmless on Cloudinary, whose URLs tolerate a
        // redundant transform segment, but a real bug shipped here: two
        // stacked tr: segments produced a path ImageKit 404s on. Caught by
        // clicking through the live Inspiration categories after this
        // migration and finding every "BASE constant" category broken.
        const url = 'https://ik.imagekit.io/frameworthy/inspiration_canvas_art/CANVA-1.jpg';
        const once = getThumbnailUrl(url);
        expect(getThumbnailUrl(once)).toBe(once);
    });
});

describe('getPrintQualityJpegUrl', () => {
    let getPrintQualityJpegUrl;
    beforeEach(async () => {
        vi.resetModules();
        ({ getPrintQualityJpegUrl } = await import('./storage.js'));
    });

    it('returns falsy/blob/data URLs unchanged (nothing to transform)', () => {
        expect(getPrintQualityJpegUrl(null)).toBeNull();
        expect(getPrintQualityJpegUrl('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
        expect(getPrintQualityJpegUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    });

    it('rewrites a Cloudinary upload URL with jpg/quality transforms when no size is given', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        expect(getPrintQualityJpegUrl(url)).toBe(
            'https://res.cloudinary.com/demo/image/upload/f_jpg,q_100/v1/photo.jpg'
        );
    });

    it('computes portrait dimensions at 300 DPI (narrower side as width)', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        const item = { selectedSize: { width: 8, height: 10 }, orientation: 'portrait' };
        // 8in * 300dpi = 2400, 10in * 300dpi = 3000 -> portrait keeps width < height
        expect(getPrintQualityJpegUrl(url, item)).toBe(
            'https://res.cloudinary.com/demo/image/upload/w_2400,h_3000,c_fill,g_auto,e_improve,f_jpg,q_100/v1/photo.jpg'
        );
    });

    it('swaps width/height for landscape orientation', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        const item = { selectedSize: { width: 8, height: 10 }, orientation: 'landscape' };
        expect(getPrintQualityJpegUrl(url, item)).toBe(
            'https://res.cloudinary.com/demo/image/upload/w_3000,h_2400,c_fill,g_auto,e_improve,f_jpg,q_100/v1/photo.jpg'
        );
    });

    it('rewrites an ImageKit URL with jpg/quality transforms when no size is given', () => {
        const url = 'https://ik.imagekit.io/frameworthy/albums/123.jpg';
        expect(getPrintQualityJpegUrl(url)).toBe(
            'https://ik.imagekit.io/frameworthy/tr:f-jpg,q-100/albums/123.jpg'
        );
    });

    it('is idempotent on an already-transformed ImageKit URL', () => {
        const url = 'https://ik.imagekit.io/frameworthy/albums/123.jpg';
        const once = getPrintQualityJpegUrl(url);
        expect(getPrintQualityJpegUrl(once)).toBe(once);
    });

    it('computes 300 DPI dimensions with smart-focus crop on an ImageKit URL', () => {
        const url = 'https://ik.imagekit.io/frameworthy/albums/123.jpg';
        const item = { selectedSize: { width: 8, height: 10 }, orientation: 'portrait' };
        expect(getPrintQualityJpegUrl(url, item)).toBe(
            'https://ik.imagekit.io/frameworthy/tr:w-2400,h-3000,fo-auto,f-jpg,q-100/albums/123.jpg'
        );
    });

    describe('non-Cloudinary, non-ImageKit URLs', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('routes through the Cloudinary fetch API when a cloud name is configured', async () => {
            vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'demo-cloud');
            vi.resetModules();
            const { getPrintQualityJpegUrl: fn } = await import('./storage.js');
            const url = 'https://example.com/photo.jpg';
            expect(fn(url)).toBe(
                `https://res.cloudinary.com/demo-cloud/image/fetch/f_jpg,q_100/${encodeURIComponent(url)}`
            );
        });

        it('resolves a relative path to an absolute URL using window.location.origin', async () => {
            vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'demo-cloud');
            vi.resetModules();
            const { getPrintQualityJpegUrl: fn } = await import('./storage.js');
            const absolute = window.location.origin + '/presets/frame.jpg';
            expect(fn('/presets/frame.jpg')).toBe(
                `https://res.cloudinary.com/demo-cloud/image/fetch/f_jpg,q_100/${encodeURIComponent(absolute)}`
            );
        });

        it('returns the original URL unchanged when Cloudinary is not configured', async () => {
            vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', '');
            vi.resetModules();
            const { getPrintQualityJpegUrl: fn } = await import('./storage.js');
            const url = 'https://example.com/photo.jpg';
            expect(fn(url)).toBe(url);
        });
    });
});

describe('uploadImageToCloud', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('defaults to ImageKit when VITE_IMAGE_UPLOAD_PROVIDER is unset', async () => {
        vi.stubEnv('VITE_IMAGE_UPLOAD_PROVIDER', '');
        // resetModules() FIRST, then import the mocked providers and storage.js
        // together — so the reference captured here is the exact same module
        // instance storage.js resolves internally, not a stale one from a
        // pre-reset registry.
        vi.resetModules();
        const { uploadToImageKit } = await import('./providers/imagekitUpload');
        const { uploadToCloudinary } = await import('./providers/cloudinaryUpload');
        uploadToImageKit.mockReset().mockResolvedValue('https://ik.imagekit.io/frameworthy/x.jpg');
        uploadToCloudinary.mockReset();

        const { uploadImageToCloud } = await import('./storage.js');
        const file = new File(['x'], 'x.jpg');
        const url = await uploadImageToCloud(file);

        expect(uploadToImageKit).toHaveBeenCalledWith(file);
        expect(uploadToCloudinary).not.toHaveBeenCalled();
        expect(url).toBe('https://ik.imagekit.io/frameworthy/x.jpg');
    });

    it('routes to Cloudinary when VITE_IMAGE_UPLOAD_PROVIDER is "cloudinary"', async () => {
        vi.stubEnv('VITE_IMAGE_UPLOAD_PROVIDER', 'cloudinary');
        vi.resetModules();
        const { uploadToImageKit } = await import('./providers/imagekitUpload');
        const { uploadToCloudinary } = await import('./providers/cloudinaryUpload');
        uploadToImageKit.mockReset();
        uploadToCloudinary.mockReset().mockResolvedValue('https://res.cloudinary.com/demo/x.jpg');

        const { uploadImageToCloud } = await import('./storage.js');
        const file = new File(['x'], 'x.jpg');
        const url = await uploadImageToCloud(file);

        expect(uploadToCloudinary).toHaveBeenCalledWith(file);
        expect(uploadToImageKit).not.toHaveBeenCalled();
        expect(url).toBe('https://res.cloudinary.com/demo/x.jpg');
    });
});
