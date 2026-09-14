import { describe, it, expect } from 'vitest';
import { ROOM_SCENES, computeReferenceAnchoredTop, computeRoomPlacement, computeRoomLayout } from './roomScenes';
import { FRAME_SIZES } from './constants';
import { ROOM_SCENE_COMPONENTS } from '../components/framing/roomSceneComponents';

// floorLineCm/sceneHeightCm are required now, not just wallSpanCm/hang — the
// hang-height lift in computeRoomPlacement (a tall piece gets raised to clear
// whatever's below it) needs them to find the floor and do the cm maths. No
// clearanceTopCm here on purpose: these tests are about the base centring/
// scaling behaviour, and an obstacle at floor level (the default when it's
// unset) never triggers a lift for any of the modest heights used below —
// see the dedicated hang-height tests further down for that behaviour.
const scene = { id: 'test', wallSpanCm: 400, sceneHeightCm: 280, floorLineCm: 245, hang: { x: 50, y: 40 } };

describe('computeRoomPlacement', () => {
    it('keeps normal portrait and landscape frames inside the full photographed wall', () => {
        for (const room of ROOM_SCENES) {
            for (const [width, height] of [[18, 24], [40, 60], [60, 40]]) {
                const placement = computeRoomPlacement(room, width, height);
                const top = placement.topPct / 100 * room.sceneHeightCm - height / 2;
                const bottom = placement.topPct / 100 * room.sceneHeightCm + height / 2;
                expect(top).toBeGreaterThanOrEqual(-0.001);
                expect(bottom).toBeLessThanOrEqual(room.floorLineCm + 0.001);
                expect(placement.tooTall).toBe(false);
            }
        }
    });

    it('fills the visualizer with the complete room composition', () => {
        for (const room of ROOM_SCENES) {
            for (const [width, height] of [[375, 380], [768, 420], [1400, 1000], [1800, 600]]) {
                const layout = computeRoomLayout(room, width, height);
                expect(layout.width).toBeCloseTo(width, 8);
                expect(layout.height).toBeCloseTo(height, 8);
                // Artwork uses the wall-width scale unless a shallow viewport
                // needs its height to cap it so the entire frame stays visible.
                const placement = computeRoomPlacement(room, 60, 90);
                expect(layout.scale).toBeLessThanOrEqual(width / room.wallSpanCm);
                expect(60 * layout.scale).toBeLessThanOrEqual(layout.width + 0.001);
            }
        }
        expect(computeRoomLayout(null, 375, 400)).toBeNull();
    });

    it('keeps a tall frame within the wall when gallery height would clip its top', () => {
        const bedroom = ROOM_SCENES.find(s => s.id === 'bedroom');
        const p = computeRoomPlacement(bedroom, 65, 95);
        const topCm = p.topPct / 100 * bedroom.sceneHeightCm - 95 / 2;
        // The bedroom photograph has 10cm of intentionally reserved ceiling
        // breathing room. A tall piece may use that limit when it has to.
        expect(topCm).toBeGreaterThanOrEqual(10 - 0.001);
        expect(p.tooTall).toBe(false);
    });

    it('reports only frames that exceed the complete wall instead of furniture clearance', () => {
        for (const room of ROOM_SCENES) {
            expect(computeRoomPlacement(room, 100, 150).tooTall).toBe(false);
        }
    });

    it('keeps a 180cm-tall Studio Loft frame inside the entire wall', () => {
        const studio = ROOM_SCENES.find(s => s.id === 'studio-loft');
        // 180cm print plus the catalogue's widest 4.0625in rail on both edges.
        const outerHeightCm = 180 + (4.0625 * 2 * 2.54);
        const placement = computeRoomPlacement(studio, 80, outerHeightCm);
        expect(placement.tooTall).toBe(false);
        const topCm = placement.topPct / 100 * studio.sceneHeightCm - outerHeightCm / 2;
        const bottomCm = placement.topPct / 100 * studio.sceneHeightCm + outerHeightCm / 2;
        expect(topCm).toBeGreaterThanOrEqual(-0.001);
        expect(bottomCm).toBeLessThanOrEqual(studio.floorLineCm + 0.001);
    });

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
            expect(s.referenceTopPct).toBeGreaterThan(0);
            expect(s.referenceTopPct).toBeLessThanOrEqual(100);
            // Either drawn (tintable) or photographic (image) — a scene with
            // neither would render as an empty box.
            expect(Boolean(s.tintable) || Boolean(s.image)).toBe(true);
        }
    });

    it('uses the Bedroom camera scale consistently across every room scene', () => {
        const bedroom = ROOM_SCENES.find((scene) => scene.id === 'bedroom');
        for (const room of ROOM_SCENES) {
            expect(room.wallSpanCm, room.id).toBe(bedroom.wallSpanCm);
            const layout = computeRoomLayout(room, 1380, 920);
            const bedroomLayout = computeRoomLayout(bedroom, 1380, 920);
            const frameWidthPx = 100 * layout.scale;
            const bedroomFrameWidthPx = 100 * bedroomLayout.scale;
            expect(frameWidthPx, room.id).toBeCloseTo(bedroomFrameWidthPx, 8);
        }
    });

    it('gives every 180cm-tall frame the Studio Loft ceiling clearance', () => {
        const layout = { top: 0, height: 900 };
        const tops = ROOM_SCENES.map((room) =>
            computeReferenceAnchoredTop(room, layout, 600, 'custom', 'portrait', 180)
        );
        expect(tops).toEqual(tops.map(() => 32));
    });

    it('keeps every normal frame size at the Studio Loft origin in every room', () => {
        const layout = { top: 0, height: 900 };
        for (const [sizeId, orientation, frameHeightPx, frameHeightCm] of [
            ['60x90cm', 'portrait', 360, 90],
            ['100x150cm', 'portrait', 600, 150],
            ['90x60cm', 'landscape', 240, 60],
        ]) {
            const tops = ROOM_SCENES.map((room) =>
                computeReferenceAnchoredTop(room, layout, frameHeightPx, sizeId, orientation, frameHeightCm)
            );
            expect(tops, `${sizeId}/${orientation}`).toEqual(tops.map(() => tops[0]));
        }
    });

    it('uses the Studio Loft → Dining placement for every catalogue size and room', () => {
        const layout = { top: 0, height: 900 };
        for (const size of FRAME_SIZES) {
            for (const orientation of ['portrait', 'landscape']) {
                const frameHeightCm = (orientation === 'portrait' ? size.height : size.width) * 2.54;
                const frameHeightPx = frameHeightCm * 4;
                const tops = ROOM_SCENES.map((room) =>
                    computeReferenceAnchoredTop(room, layout, frameHeightPx, size.id, orientation, frameHeightCm)
                );
                expect(tops, `${size.id}/${orientation}`).toEqual(tops.map(() => tops[0]));
            }
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

    it('centres each frame on its room’s main reference object', () => {
        expect(ROOM_SCENES.map((scene) => scene.hang.x)).toEqual([
            50, // Studio sofa
            50, // Dining table
            50, // Bed
            50, // Entryway shares the visualizer centre with every scene
            50, // Desk
        ]);
        expect(ROOM_SCENES.find((scene) => scene.id === 'entryway').compositionOffsetXPct).toBeGreaterThan(0);
        expect(ROOM_SCENES.find((scene) => scene.id === 'home-office').compositionOffsetXPct).toBe(0);
    });

    it('keeps photographic scene data at the image native aspect ratio', () => {
        // The visualizer lays image assets out at sceneWidth × sceneHeight.
        // These files are all 3:2, so retaining that ratio prevents the room
        // and its scale references from being subtly stretched.
        for (const s of ROOM_SCENES.filter((x) => x.image)) {
            const sceneCanvasWidthCm = s.wallSpanCm + (s.canvasInsetLeftCm || 0);
            expect(sceneCanvasWidthCm / s.sceneHeightCm).toBeCloseTo(1.5, 2);
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

    it('keeps scene differences in the room composition, not the camera zoom', () => {
        const spans = ROOM_SCENES.map((scene) => scene.wallSpanCm);
        expect(new Set(spans).size).toBe(1);
    });
});
