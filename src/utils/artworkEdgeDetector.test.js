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

        // Bright artwork interior (RGB 200, 180, 150)
        for (let i = 0; i < width * height; i++) {
            data[i * 4] = 200;
            data[i * 4 + 1] = 180;
            data[i * 4 + 2] = 150;
            data[i * 4 + 3] = 255;
        }

        // 4px dark border on all 4 sides (RGB 0, 0, 0)
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
        expect(result.insets.top).toBeCloseTo(0.042, 2);
        expect(result.insets.bottom).toBeCloseTo(0.042, 2);
        expect(result.insets.left).toBeCloseTo(0.042, 2);
        expect(result.insets.right).toBeCloseTo(0.042, 2);
    });

    it('detects light, cream, or grey studio conservation margins', () => {
        const width = 100;
        const height = 100;
        const data = new Uint8ClampedArray(width * height * 4);

        // Dark painting interior (RGB 40, 30, 25)
        for (let i = 0; i < width * height; i++) {
            data[i * 4] = 40;
            data[i * 4 + 1] = 30;
            data[i * 4 + 2] = 25;
            data[i * 4 + 3] = 255;
        }

        // 6px light-grey museum mounting board (RGB 210, 210, 215)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (y < 6 || y >= height - 6 || x < 6 || x >= width - 6) {
                    const idx = (y * width + x) * 4;
                    data[idx] = 210;
                    data[idx + 1] = 210;
                    data[idx + 2] = 215;
                    data[idx + 3] = 255;
                }
            }
        }

        const result = detectBordersFromImageData(data, width, height);

        expect(result.hasLeftoverFrame).toBe(true);
        expect(result.insets.top).toBeCloseTo(0.062, 2);
        expect(result.insets.bottom).toBeCloseTo(0.062, 2);
        expect(result.insets.left).toBeCloseTo(0.062, 2);
        expect(result.insets.right).toBeCloseTo(0.062, 2);
    });

    it('detects full antique picture frame mouldings (wood/gold rails)', () => {
        const width = 120;
        const height = 120;
        const data = new Uint8ClampedArray(width * height * 4);

        // Complex artwork interior (RGB 50..180)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                data[idx] = 40 + ((x * 3 + y * 2) % 60);
                data[idx + 1] = 50 + ((x + y * 4) % 60);
                data[idx + 2] = 60 + ((x * y) % 60);
                data[idx + 3] = 255;
            }
        }

        // 12px antique gold/wood frame rails (RGB ~170, 120, 50) on all sides
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (y < 12 || y >= height - 12 || x < 12 || x >= width - 12) {
                    const idx = (y * width + x) * 4;
                    // Textured frame moulding with carved variations
                    const woodGrain = (x + y * 3) % 25;
                    data[idx] = 170 + woodGrain;
                    data[idx + 1] = 125 + woodGrain;
                    data[idx + 2] = 55 + Math.floor(woodGrain / 2);
                    data[idx + 3] = 255;
                }
            }
        }

        const result = detectBordersFromImageData(data, width, height);

        expect(result.hasLeftoverFrame).toBe(true);
        expect(result.insets.top).toBeGreaterThanOrEqual(0.09);
        expect(result.insets.bottom).toBeGreaterThanOrEqual(0.09);
        expect(result.insets.left).toBeGreaterThanOrEqual(0.09);
        expect(result.insets.right).toBeGreaterThanOrEqual(0.09);
    });

    it('detects and advances to the innermost sight-edge rebate on multi-beveled bronze frame slips', () => {
        const width = 200;
        const height = 200;
        const data = new Uint8ClampedArray(width * height * 4);

        // Artwork interior: pale parchment / Asian scroll silk
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                data[idx] = 235 + ((x + y) % 15);
                data[idx + 1] = 230 + ((x + y) % 15);
                data[idx + 2] = 210 + ((x + y) % 15);
                data[idx + 3] = 255;
            }
        }

        // Multi-layered bronze/brass liner:
        // Rows 0-1: outer bronze trim (RGB 170, 140, 50)
        // Rows 2-5: dark shadow bevel / filigree (RGB 90, 70, 20)
        // Row 6: inner sight-edge rebate meeting pale silk interior
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const topD = y;
                const btmD = height - 1 - y;
                const lftD = x;
                const rgtD = width - 1 - x;
                const edgeDist = Math.min(topD, btmD, lftD, rgtD);

                if (edgeDist < 6) {
                    const idx = (y * width + x) * 4;
                    if (edgeDist < 2) {
                        data[idx] = 170;
                        data[idx + 1] = 140;
                        data[idx + 2] = 50;
                    } else {
                        data[idx] = 90;
                        data[idx + 1] = 70;
                        data[idx + 2] = 20;
                    }
                    data[idx + 3] = 255;
                }
            }
        }

        const result = detectBordersFromImageData(data, width, height);

        expect(result.hasLeftoverFrame).toBe(true);
        // The detector must crop past the inner bevel (6px / 200px = 0.030 + buffer)
        expect(result.insets.top).toBeGreaterThanOrEqual(0.030);
        expect(result.insets.bottom).toBeGreaterThanOrEqual(0.030);
        expect(result.insets.left).toBeGreaterThanOrEqual(0.030);
        expect(result.insets.right).toBeGreaterThanOrEqual(0.030);
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
