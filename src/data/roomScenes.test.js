import { describe, it, expect } from 'vitest';
import { ROOM_SCENES, computeRoomPlacement } from './roomScenes';

const scene = { id: 'test', wallSpanCm: 400, hang: { x: 50, y: 40 } };

describe('computeRoomPlacement', () => {
    it('scales artwork width as a share of the wall span', () => {
        // 100cm of art on a 400cm wall = a quarter of the image width.
        const p = computeRoomPlacement(scene, 100, 70);
        expect(p.widthPct).toBe(25);
    });

    it('scales proportionally — double the art, double the on-wall width', () => {
        const small = computeRoomPlacement(scene, 50, 40);
        const large = computeRoomPlacement(scene, 100, 80);
        expect(large.widthPct).toBe(small.widthPct * 2);
    });

    it('places the artwork centred on the scene hang point', () => {
        const p = computeRoomPlacement(scene, 100, 70);
        // Returned raw; the caller centres with translate(-50%, -50%), which
        // is what lets height come from aspect-ratio instead of needing the
        // scene image's own aspect ratio here.
        expect(p.leftPct).toBe(50);
        expect(p.topPct).toBe(40);
    });

    it('reports overflow when the piece is wider than the wall', () => {
        expect(computeRoomPlacement(scene, 420, 300).overflows).toBe(true);
        expect(computeRoomPlacement(scene, 399, 300).overflows).toBe(false);
    });

    it('does not clamp an overflowing piece', () => {
        // Clamping would silently reintroduce the "every size looks the same"
        // problem this module exists to avoid — the caller decides instead.
        const p = computeRoomPlacement(scene, 800, 600);
        expect(p.widthPct).toBe(200);
    });

    it('returns null for missing or nonsensical input', () => {
        expect(computeRoomPlacement(null, 100, 70)).toBeNull();
        expect(computeRoomPlacement(scene, 0, 70)).toBeNull();
        expect(computeRoomPlacement(scene, -10, 70)).toBeNull();
        expect(computeRoomPlacement(scene, 100, NaN)).toBeNull();
        expect(computeRoomPlacement(scene, undefined, 70)).toBeNull();
    });

    it('is independent of the rendered size of the scene', () => {
        // Percentages only — nothing here depends on how large the scene is
        // drawn, which is what keeps it correct across mobile/desktop/full
        // screen without recomputation.
        const p = computeRoomPlacement(scene, 120, 90);
        expect(p.widthPct).toBeCloseTo(30, 10);
    });
});

describe('ROOM_SCENES data', () => {
    it('every scene carries the calibration the math depends on', () => {
        expect(ROOM_SCENES.length).toBeGreaterThan(0);
        for (const s of ROOM_SCENES) {
            expect(s.id).toBeTruthy();
            expect(s.name).toBeTruthy();
            expect(s.wallSpanCm).toBeGreaterThan(0);
            expect(s.hang.x).toBeGreaterThanOrEqual(0);
            expect(s.hang.x).toBeLessThanOrEqual(100);
            expect(s.hang.y).toBeGreaterThanOrEqual(0);
            expect(s.hang.y).toBeLessThanOrEqual(100);
            // Either drawn (tintable) or photographic (image) — a scene with
            // neither would render as an empty box.
            expect(Boolean(s.tintable) || Boolean(s.image)).toBe(true);
        }
    });

    it('scene ids are unique', () => {
        const ids = ROOM_SCENES.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('hangs a typical piece at a sensible height on the studio loft', () => {
        const loft = ROOM_SCENES.find((s) => s.id === 'studio-loft');
        // The scene is 420x280cm, so hang.y of 37.5% = 105cm from the top,
        // i.e. 140cm above the 245cm floor line — gallery height, and clear
        // of the 80cm-tall sofa back below it.
        const hangFromTopCm = (loft.hang.y / 100) * 280;
        const heightAboveFloorCm = 245 - hangFromTopCm;
        expect(heightAboveFloorCm).toBeCloseTo(140, 0);
    });
});
