import { describe, it, expect } from 'vitest';
import { validateAnchor, cssBackgroundWindow, isCropTwoToned, basenameOf } from './frameTexture';

// A 700x700 image with a centred apex — matches the real "symmetric" corner
// photo convention measured against actual catalogue assets (apex at ~50%
// width, arms at roughly ±45°).
const CENTERED = { apexX: 350, apexY: 349, w: 700, h: 700 };

describe('validateAnchor', () => {
    it('accepts a well-centred apex with a saturated material sample', () => {
        const result = validateAnchor({ ...CENTERED, sampleColor: [167, 168, 134] });
        expect(result).not.toBeNull();
        expect(result.xPct).toBeCloseTo(50, 0);
    });

    it('places the anchor below the apex, scaled by remaining height', () => {
        const result = validateAnchor({ ...CENTERED, sampleColor: [129, 119, 110] });
        // apexY=349, h=700 -> sampleY = 349 + (700-349)*0.25 = 436.75 -> 62.4%
        expect(result.yPct).toBeCloseTo(62.4, 0);
        expect(result.yPct).toBeGreaterThan((CENTERED.apexY / CENTERED.h) * 100);
    });

    it('rejects an apex within the edge margin — likely noise, not a real corner', () => {
        expect(validateAnchor({ apexX: 10, apexY: 349, w: 700, h: 700, sampleColor: [100, 80, 60] })).toBeNull();
        expect(validateAnchor({ apexX: 690, apexY: 349, w: 700, h: 700, sampleColor: [100, 80, 60] })).toBeNull();
        expect(validateAnchor({ apexX: 350, apexY: 10, w: 700, h: 700, sampleColor: [100, 80, 60] })).toBeNull();
    });

    it('rejects a sample that landed on white background', () => {
        const result = validateAnchor({ ...CENTERED, sampleColor: [250, 250, 250] });
        expect(result).toBeNull();
    });

    it('rejects a sample that landed on flat grey — same failure mode as white, no saturation to trust', () => {
        const result = validateAnchor({ ...CENTERED, sampleColor: [225, 224, 226] });
        expect(result).toBeNull();
    });

    it('accepts a dark, low-saturation but clearly non-white material (e.g. black/near-black moulding)', () => {
        // Real measured value from a near-black frame's material sample —
        // far from the white threshold even though the channels are close
        // to each other (low spread), so this must not be rejected on
        // spread alone; the near-white gate only applies when the channels
        // are ALSO bright.
        const result = validateAnchor({ ...CENTERED, sampleColor: [15, 12, 13] });
        expect(result).not.toBeNull();
    });

    it('rejects when no apex was found at all', () => {
        expect(validateAnchor({ apexX: -1, apexY: -1, w: 700, h: 700, sampleColor: [100, 80, 60] })).toBeNull();
    });

    it('rejects degenerate image dimensions', () => {
        expect(validateAnchor({ apexX: 350, apexY: 349, w: 0, h: 700, sampleColor: [100, 80, 60] })).toBeNull();
        expect(validateAnchor({ apexX: 350, apexY: 349, w: 700, h: 0, sampleColor: [100, 80, 60] })).toBeNull();
    });

    it('handles an off-centre apex (the "steep angle" composition seen in the catalogue)', () => {
        // Measured from a real asset: apex at 64% width, well within margins.
        const result = validateAnchor({ apexX: 447, apexY: 283, w: 700, h: 700, sampleColor: [15, 12, 13] });
        expect(result).not.toBeNull();
        expect(result.xPct).toBeCloseTo(63.9, 0);
    });
});

describe('cssBackgroundWindow', () => {
    it('reveals exactly 1/zoom of the source at a given zoom', () => {
        const w = cssBackgroundWindow(50, 700, 9);
        expect(w.size).toBeCloseTo(700 / 9, 5);
    });

    it('is centred only at 50% position — off-centre positions are not literally centred on the point', () => {
        // This is the CSS background-position formula, not a naive "centre on
        // the percent point" approximation: start = (1 - 1/zoom) * (pct/100)
        // * sourceSize. For pct=50.2857, size=700, zoom=9, that's
        // (1 - 1/9) * 0.502857 * 700 ≈ 312.9 — well off from a naive "centre
        // at pct" guess of ~316.

        const w = cssBackgroundWindow(50.2857, 700, 9);
        expect(w.start).toBeCloseTo(312.9, 0);
        expect(w.size).toBeCloseTo(77.8, 0);
    });

    it('starts at 0 when position is 0%', () => {
        const w = cssBackgroundWindow(0, 700, 9);
        expect(w.start).toBe(0);
    });

    it('ends at the source size when position is 100%', () => {
        const w = cssBackgroundWindow(100, 700, 9);
        expect(w.start + w.size).toBeCloseTo(700, 5);
    });

    it('shrinks the window as zoom increases', () => {
        const loose = cssBackgroundWindow(50, 700, 3.5);
        const tight = cssBackgroundWindow(50, 700, 9);
        expect(tight.size).toBeLessThan(loose.size);
    });
});

describe('isCropTwoToned', () => {
    // A flat run of brightness values with modest, grain-like jitter — one
    // material's natural variation. Should never be flagged regardless of
    // how noisy the jitter is within a realistic range.
    const uniformMaterial = (base, jitter, n = 400) =>
        Array.from({ length: n }, (_, i) => base + Math.sin(i * 0.7) * jitter);

    it('does not flag a single material with realistic grain noise', () => {
        expect(isCropTwoToned(uniformMaterial(60, 15))).toBe(false);
    });

    it('does not flag high-contrast carving/pinstripe detail within one material', () => {
        // Reproduces the real false-positive case found during the catalogue
        // audit (ornate carving, e.g. frame 10327): sharp local swings, but
        // both "sides" of the swing are close enough that no clean two-
        // material split explains the data better than one noisy material.
        expect(isCropTwoToned(uniformMaterial(90, 24))).toBe(false);
    });

    it('flags a genuine two-surface split — wood face vs. glossy-black side', () => {
        // Mirrors the real confirmed defect (frame 10512 at the original,
        // too-loose zoom): roughly half the crop is face material (~120),
        // half is the darker side band (~55) — stddev ~50, cluster gap ~67,
        // the exact reference values the threshold was calibrated against.
        const face = Array.from({ length: 200 }, (_, i) => 120 + Math.sin(i) * 10);
        const side = Array.from({ length: 200 }, (_, i) => 55 + Math.sin(i) * 8);
        expect(isCropTwoToned([...face, ...side])).toBe(true);
    });

    it('does not flag a big jump with only a handful of outlier pixels on one side', () => {
        // A tiny highlight speck or shadow fleck isn't a second surface — the
        // gap alone isn't enough without real population on both sides.
        const material = uniformMaterial(80, 10, 300);
        const speck = [5, 4, 6]; // 3 near-black outlier pixels out of 303
        expect(isCropTwoToned([...material, ...speck])).toBe(false);
    });

    it('matches the confirmed-safe reference crop (shipped fix, stddev ~13)', () => {
        expect(isCropTwoToned(uniformMaterial(65, 10))).toBe(false);
    });

    it('returns false for an empty crop rather than throwing', () => {
        expect(isCropTwoToned([])).toBe(false);
    });
});

describe('basenameOf', () => {
    // The manually-verified-single-surface override list is keyed by plain
    // filename, but real anchor detection runs against a full loaded-image
    // URL (dev server, CDN, or bundled asset path) — this is what bridges
    // the two, so a mismatch here would silently disable the whole list.
    it('strips a full dev-server path down to the filename', () => {
        expect(basenameOf('http://localhost:3000/assets/frames/10166_a_1.jpg')).toBe('10166_a_1.jpg');
    });

    it('strips a bare relative path', () => {
        expect(basenameOf('/assets/frames/84160_a_2.jpg')).toBe('84160_a_2.jpg');
    });

    it('drops a query string used for cache-busting', () => {
        expect(basenameOf('/assets/frames/9202_a.jpg?v=3')).toBe('9202_a.jpg');
    });

    it('drops a hash fragment', () => {
        expect(basenameOf('/assets/frames/9202_a.jpg#frag')).toBe('9202_a.jpg');
    });

    it('returns the input unchanged when there is no path separator', () => {
        expect(basenameOf('10166_a_1.jpg')).toBe('10166_a_1.jpg');
    });
});
