import { describe, it, expect } from 'vitest';
import { FRAME_SIZES, FRAME_STYLES } from './constants';
import { ROOM_SCENES, computeReferenceAnchoredTop, computeRoomLayout, computeRoomPlacement } from './roomScenes';

const railWidths = [...new Set(FRAME_STYLES.map(frame => {
    if (frame.id === 'frame-canvas') return 0;
    const measured = Number(frame.mouldingWidthIn);
    return measured > 0 ? measured : frame.widthCategory === 'wide' ? 1.25 : frame.widthCategory === 'narrow' ? 0.375 : 0.75;
}))];
const viewports = [[375, 380], [390, 400], [768, 420], [1400, 1000], [1800, 600]];

describe('complete catalogue against room scenes', () => {
    for (const room of ROOM_SCENES) {
        it(`${room.name}: every size, orientation, rail width and viewport`, () => {
            let fits = 0;
            let exceedsWall = 0;
            for (const size of FRAME_SIZES) {
                for (const orientation of ['portrait', 'landscape']) {
                    for (const railIn of railWidths) {
                        const width = ((orientation === 'portrait' ? size.width : size.height) + railIn * 2) * 2.54;
                        const height = ((orientation === 'portrait' ? size.height : size.width) + railIn * 2) * 2.54;
                        const label = `${room.id}/${size.id}/${orientation}/rail=${railIn}`;
                        const p = computeRoomPlacement(room, width, height);
                        const outsideVisibleWall = height + 12 > room.floorLineCm;
                        expect(p.tooTall, label).toBe(outsideVisibleWall);
                        expect(p.overflows, label).toBe(width > room.wallSpanCm);
                        if (p.tooTall || p.overflows) {
                            exceedsWall++;
                            continue;
                        }
                        fits++;
                        for (const [viewportWidth, viewportHeight] of viewports) {
                            const layout = computeRoomLayout(room, viewportWidth, viewportHeight);
                            const frameWidth = width * layout.scale;
                            const frameHeight = height * layout.scale;
                            const visualTop = computeReferenceAnchoredTop(room, layout, frameHeight, size.id, orientation, height);
                            const floorY = layout.top + room.floorLineCm / room.sceneHeightCm * layout.height;
                            const centerX = layout.left + p.leftPct / 100 * layout.width;
                            const centerY = layout.top + p.topPct / 100 * layout.height;
                            expect(centerX - frameWidth / 2, label).toBeGreaterThanOrEqual(-0.001);
                            expect(centerX + frameWidth / 2, label).toBeLessThanOrEqual(viewportWidth + 0.001);
                            expect(centerY - frameHeight / 2, label).toBeGreaterThanOrEqual(layout.top - 0.001);
                            expect(centerY + frameHeight / 2, label)
                                .toBeLessThanOrEqual(floorY + 0.001);
                            expect(layout.width, label).toBeLessThanOrEqual(viewportWidth + 0.001);
                            expect(layout.height, label).toBeLessThanOrEqual(viewportHeight + 0.001);
                            // Frame placement is scene-invariant. The room's own
                            // foreground composition changes around that origin.
                            const expectedTop = height >= 180
                                ? layout.top + 32
                                : Math.max(
                                    layout.top + 12,
                                    layout.top + 0.65 * layout.height - frameHeight
                                        - (size.id === '100x150cm' && orientation === 'portrait' ? 16 : 112),
                                );
                            expect(visualTop, label).toBeCloseTo(expectedTop, 8);
                        }
                    }
                }
            }
            console.info(JSON.stringify({room: room.name, sizes: FRAME_SIZES.length, railWidths, orientations: 2, viewports: viewports.length, fits, exceedsWall}));
        }, 15000);
    }

    it('reports the 180 × 180 cm custom size against each complete wall', () => {
        // Use the active Classic Black rail, as the customizer does on its
        // initial state. The artwork is 180cm square; its outer frame adds
        // the published moulding width on each edge.
        const defaultStyle = FRAME_STYLES.find((frame) => frame.id === 'prodigi-classic-black');
        const outerCm = 180 + defaultStyle.mouldingWidthIn * 2 * 2.54;
        const results = Object.fromEntries(ROOM_SCENES.map((room) => [
            room.id,
            computeRoomPlacement(room, outerCm, outerCm),
        ]));

        for (const [id, placement] of Object.entries(results)) {
            expect(placement.overflows, id).toBe(false);
        }
        // tooTall is a wall-height check now, not a furniture check (see
        // computeRoomPlacement) — every scene's wall clears a 180cm piece
        // with room to spare, entryway included.
        expect(results['studio-loft'].tooTall).toBe(false);
        expect(results['dining-room'].tooTall).toBe(false);
        expect(results.bedroom.tooTall).toBe(false);
        expect(results.entryway.tooTall).toBe(false);
        expect(results['home-office'].tooTall).toBe(false);
    });
});
