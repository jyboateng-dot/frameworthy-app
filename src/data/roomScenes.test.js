import { describe, it, expect } from 'vitest';
import { ROOM_SCENES, computeRoomPlacement } from './roomScenes';
import { ROOM_SCENE_COMPONENTS } from '../components/framing/roomSceneComponents';
import { GEOMETRY as LOFT } from '../components/framing/StudioLoftScene';
import { GEOMETRY as DINING } from '../components/framing/DiningRoomScene';
import { GEOMETRY as BEDROOM } from '../components/framing/BedroomScene';
import { GEOMETRY as ENTRY } from '../components/framing/EntrywayScene';
import { GEOMETRY as OFFICE } from '../components/framing/HomeOfficeScene';

// The drawn geometry each scene id is calibrated against. Nothing renders
// here — these are the components' own viewBox constants, so the assertions
// below compare the data to the drawing rather than to a number retyped from
// memory, which is the failure mode that would silently un-honest the preview.
const DRAWN_GEOMETRY = {
    'studio-loft': LOFT,
    'dining-room': DINING,
    bedroom: BEDROOM,
    entryway: ENTRY,
    'home-office': OFFICE,
};

// floorLineCm/sceneHeightCm are required now, not just wallSpanCm/hang — the
// hang-height lift in computeRoomPlacement (a tall piece gets raised to clear
// whatever's below it) needs them to find the floor and do the cm maths. No
// clearanceTopCm here on purpose: these tests are about the base centring/
// scaling behaviour, and an obstacle at floor level (the default when it's
// unset) never triggers a lift for any of the modest heights used below —
// see the dedicated hang-height tests further down for that behaviour.
const scene = { id: 'test', wallSpanCm: 400, sceneHeightCm: 280, floorLineCm: 245, hang: { x: 50, y: 40 } };

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
        // Reads floorLineCm from the scene itself rather than a hardcoded
        // literal — that number moved once already (the floor strip's own
        // depth was trimmed to hand the wall more canvas), and a hardcoded
        // copy here silently kept asserting against the old value instead of
        // catching the drift.
        const hangFromTopCm = (loft.hang.y / 100) * loft.sceneHeightCm;
        const heightAboveFloorCm = loft.floorLineCm - hangFromTopCm;
        // 140cm above the floor — gallery height, clear of the 80cm-tall
        // sofa back below it.
        expect(heightAboveFloorCm).toBeCloseTo(140, 0);
    });

    it('every drawn scene has a component to draw it', () => {
        // A tintable scene with no component renders as an empty box rather
        // than throwing, so nothing else would catch this.
        for (const s of ROOM_SCENES.filter((x) => x.tintable)) {
            expect(ROOM_SCENE_COMPONENTS[s.id]).toBeTypeOf('function');
        }
    });

    it('calibrates each drawn scene to the geometry its component actually draws', () => {
        // wallSpanCm is only exact-by-construction while it equals the
        // component's viewBox width. If someone widens a scene's drawing and
        // forgets this entry, every preview in that room silently reports the
        // wrong physical size — which is the one thing this module exists to
        // get right.
        for (const [id, geometry] of Object.entries(DRAWN_GEOMETRY)) {
            const scene = ROOM_SCENES.find((s) => s.id === id);
            expect(scene, `no ROOM_SCENES entry for ${id}`).toBeTruthy();
            expect(scene.wallSpanCm).toBe(geometry.widthCm);
            expect(scene.sceneHeightCm).toBe(geometry.heightCm);
            expect(scene.floorLineCm).toBe(geometry.floorLineCm);
        }
    });

    it('hangs every scene at gallery height above its own floor line', () => {
        // 145cm to the centre of the piece is the gallery standard. The
        // bedroom is the deliberate exception at 150cm — above-bed pieces
        // clear the headboard — so the band is 140-150 rather than a point.
        for (const s of ROOM_SCENES) {
            const heightAboveFloorCm = s.floorLineCm - (s.hang.y / 100) * s.sceneHeightCm;
            expect(heightAboveFloorCm, `${s.id} hangs at ${heightAboveFloorCm}cm`).toBeGreaterThanOrEqual(139.5);
            expect(heightAboveFloorCm, `${s.id} hangs at ${heightAboveFloorCm}cm`).toBeLessThanOrEqual(150.5);
        }
    });

    it('spans a range of wall widths, so the scene choice actually changes the answer', () => {
        // Five rooms that all happened to be 420cm wide would be five
        // different pictures of one identical judgement.
        const spans = ROOM_SCENES.map((s) => s.wallSpanCm);
        expect(Math.max(...spans) - Math.min(...spans)).toBeGreaterThanOrEqual(50);
    });
});
