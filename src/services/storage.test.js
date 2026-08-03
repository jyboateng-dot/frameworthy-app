import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

    it('leaves non-Cloudinary URLs untouched', () => {
        const url = 'https://example.com/photo.jpg';
        expect(getThumbnailUrl(url)).toBe(url);
    });

    it('injects a width/quality transform into a Cloudinary upload URL', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        expect(getThumbnailUrl(url)).toBe(
            'https://res.cloudinary.com/demo/image/upload/w_400,c_limit,q_auto,f_auto/v1/photo.jpg'
        );
    });

    it('honors a custom width', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        expect(getThumbnailUrl(url, 800)).toContain('w_800,c_limit,q_auto,f_auto');
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
            'https://res.cloudinary.com/demo/image/upload/if_iw_lt_2000_and_ih_lt_2000/if_iw_lt_2400_or_ih_lt_3000/e_upscale/if_end/if_end/w_2400,h_3000,c_fill,g_auto,e_improve/f_jpg,q_100/v1/photo.jpg'
        );
    });

    it('swaps width/height for landscape orientation', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        const item = { selectedSize: { width: 8, height: 10 }, orientation: 'landscape' };
        expect(getPrintQualityJpegUrl(url, item)).toBe(
            'https://res.cloudinary.com/demo/image/upload/if_iw_lt_2000_and_ih_lt_2000/if_iw_lt_3000_or_ih_lt_2400/e_upscale/if_end/if_end/w_3000,h_2400,c_fill,g_auto,e_improve/f_jpg,q_100/v1/photo.jpg'
        );
    });

    it('scales dimensions down and drops quality when 300 DPI would exceed Cloudinary\'s 25MP output cap', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg';
        // 24in * 300dpi = 7200, 36in * 300dpi = 10800 -> 77.76MP, over the cap
        const item = { selectedSize: { width: 24, height: 36 }, orientation: 'portrait' };
        expect(getPrintQualityJpegUrl(url, item)).toBe(
            'https://res.cloudinary.com/demo/image/upload/if_iw_lt_2000_and_ih_lt_2000/if_iw_lt_4074_or_ih_lt_6111/e_upscale/if_end/if_end/w_4074,h_6111,c_fill,g_auto,e_improve/f_jpg,q_90/v1/photo.jpg'
        );
    });

    describe('non-Cloudinary URLs', () => {
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
