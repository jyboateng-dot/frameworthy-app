import { describe, expect, it } from 'vitest';
import {
    detectBordersFromImageData,
    computeCleanArtworkBounds,
} from './artworkEdgeDetector';

describe('artworkEdgeDetector', () => {
    it('detects a dark perimeter border (e.g. black scanner border or dark frame slip)', () => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);

        // Fill entire image with white/bright painting content (e.g. RGB 200, 180, 150)
        for (let i = 0; i < width * height; i++) {
            data[i * 4] = 200;
            data[i * 4 + 1] = 180;
            data[i * 4 + 2] = 150;
            data[i * 4 + 3] = 255;
        }

        // Draw a 4px dark border on all 4 sides (RGB 0, 0, 0)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (y < 4 || y >= height - 4 || x < 4 || x >= width - 4) {
                    const idx = (y * width + x) * 4;
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 255;
                }
            }
        }

        const result = detectBordersFromImageData(data, width, height);

        expect(result.hasLeftoverFrame).toBe(true);
        // 4px / 100px + 0.002 buffer ≈ 0.042 (4.2%)
        expect(result.insets.top).toBeCloseTo(0.042, 2);
        expect(result.insets.bottom).toBeCloseTo(0.042, 2);
        expect(result.insets.left).toBeCloseTo(0.042, 2);
        expect(result.insets.right).toBeCloseTo(0.042, 2);
    });

    it('returns zero insets on a clean, full-bleed artwork with no borders', () => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);

        // Fill with varied, natural tones
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                data[idx] = (x * 2 + y) % 255;
                data[idx + 1] = (x + y * 2) % 255;
                data[idx + 2] = (x * y) % 255;
                data[idx + 3] = 255;
            }
        }

        const result = detectBordersFromImageData(data, width, height);

        expect(result.hasLeftoverFrame).toBe(false);
        expect(result.insets.top).toBe(0);
        expect(result.insets.bottom).toBe(0);
        expect(result.insets.left).toBe(0);
        expect(result.insets.right).toBe(0);
    });

    it('computes clean artwork pixel bounds correctly from insets', () => {
        const imageSize = { w: 3000, h: 2000 };
        const insets = { top: 0.02, bottom: 0.02, left: 0.03, right: 0.03 };

        const bounds = computeCleanArtworkBounds(imageSize, insets);

        expect(bounds).toEqual({
            x: 90,     // 0.03 * 3000
            y: 40,     // 0.02 * 2000
            w: 2820,   // 3000 - 90 - 90
            h: 1920,   // 2000 - 40 - 40
        });
    });

    it('returns full bounds when insets are zero', () => {
        const imageSize = { w: 3000, h: 2000 };
        const insets = { top: 0, bottom: 0, left: 0, right: 0 };

        const bounds = computeCleanArtworkBounds(imageSize, insets);

        expect(bounds).toEqual({ x: 0, y: 0, w: 3000, h: 2000 });
    });
});
