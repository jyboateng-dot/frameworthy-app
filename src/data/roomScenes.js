// Room scenes for the Frame Studio visualizer.
//
// The visualizer's default backdrop is a flat wall colour with an SVG sofa
// as the only scale cue. A room scene swaps that for a full interior — the
// same trick every art retailer's "see it on your wall" preview uses.
//
// HOW THE PLACEMENT MATH WORKS
//
// The scene image is shot/drawn dead-on: the wall plane is parallel to the
// image plane, with no perspective skew across it. That single property is
// what makes this work at all — it means a plain axis-aligned rectangle
// pasted onto the wall is already geometrically correct, so no homography,
// corner-pinning, or 3D transform is needed. It also means an angled-wall
// photo can NOT be used here; it would need a real perspective transform.
//
// Each scene is calibrated with one number: `wallSpanCm`, the real-world
// horizontal distance the full image width covers on the wall plane. From
// that, artwork of a known physical width converts straight to a percentage:
//
//     widthPct = (artworkWidthCm / wallSpanCm) * 100
//
// This is deliberately different from how most competitors do it. The common
// approach hard-codes an authored `width` percentage per scene, so a 12in
// print and a 40in canvas render at the identical on-wall size — the preview
// looks convincing but tells the customer nothing true about scale. Because
// this app already tracks real physical dimensions end to end (FRAME_SIZES
// carries inches, and the existing sofa reference is a true 160cm), we can
// key off the actual size instead and have the preview be honest: a large
// canvas genuinely dwarfs the sofa, a small print genuinely looks small.

// Gallery-standard hang height — the centre of a hung piece sits ~145cm above
// the floor, which is why every scene's `hang.y` lands near that line rather
// than at an arbitrary eyeballed spot.
export const GALLERY_HANG_HEIGHT_CM = 145;

// Photo coordinates are measured against the 1536 × 1024 source images.
// Physical spans are approximate; the generated interiors are not surveys.
// floorLineCm follows the wall/floor junction, not the image's bottom edge.
// furnitureTopPct marks the highest obstacle across the intended hanging zone.
const photoScene = (id, name, wallSpanCm, floorPct, furnitureTopPct, x, hangHeight = 145, options = {}) => {
    const sceneHeightCm = wallSpanCm / 1.5;
    const floorLineCm = sceneHeightCm * floorPct / 100;
    return {
        id, name,
        image: options.image ?? `/rooms/${id}.png`,
        foregroundImage: options.foregroundImage,
        wallSpanCm, sceneHeightCm, floorLineCm, furnitureTopPct,
        referenceTopPct: options.referenceTopPct,
        reference: options.reference,
        referenceGapPx: options.referenceGapPx ?? 112,
        // The largest portrait preset already reaches into the upper wall, so
        // it keeps the original compact clearance rather than moving upward.
        largePortraitReferenceGapPx: options.largePortraitReferenceGapPx ?? 16,
        verticalNudgePx: options.verticalNudgePx ?? 0,
        sizeNudgesPx: options.sizeNudgesPx ?? {},
        // Moves the photographed room composition while the frame remains on
        // the shared visualizer centre. This is for calibrating an off-centre
        // sofa/table/console/desk, not for changing a frame's placement.
        compositionOffsetXPct: options.compositionOffsetXPct ?? 0,
        clearanceTopCm: floorLineCm - sceneHeightCm * furnitureTopPct / 100,
        furnitureGapCm: options.furnitureGapCm,
        tintable: options.tintable,
        hang: { x, y: (floorLineCm - hangHeight) / sceneHeightCm * 100 },
    };
};

export const ROOM_SCENES = [
    // The photograph keeps the original Studio Loft's calibrated composition:
    // a 420cm wall, sofa at 80cm high, and a near-bottom floor line.
    // The expanded Studio canvas leaves the sofa at the lower fifth of the
    // visualizer, so its usable wall extends to 80% of the scene height.
    // This keeps the 180cm custom-height option visible above the sofa.
    photoScene('studio-loft', 'Studio Loft', 461, 99.64, 80, 50, 140, {
        image: '/rooms/studio-loft-photoreal.png',
        foregroundImage: '/rooms/studio-loft-foreground.png?v=2',
        referenceTopPct: 65,
        reference: { name: 'sofa frame', widthCm: 220, widthPx: 1000 },
    }),
    photoScene('dining-room', 'Dining Room', 461, 85, 68, 50, 145, {
        image: '/rooms/dining-room-photoreal.png',
        foregroundImage: '/rooms/dining-room-foreground.png?v=1',
        referenceTopPct: 68,
        reference: { name: 'dining table top', widthCm: 180, widthPx: 900 },
        referenceGapPx: 168,
        largePortraitReferenceGapPx: 112,
    }),
    photoScene('bedroom', 'Bedroom', 461, 85, 60, 50, 150, {
        image: '/rooms/bedroom-photoreal.png',
        foregroundImage: '/rooms/bedroom-foreground.png?v=1',
        referenceTopPct: 60,
        reference: { name: 'bed frame', widthCm: 150, widthPx: 500 },
    }),
    // Keep the artwork fixed on the shared visualizer centre; the entryway
    // composition changes around it just like the other room scenes.
    photoScene('entryway', 'Entryway', 461, 80, 50, 50, 145, {
        image: '/rooms/entryway-photoreal.png?v=2',
        foregroundImage: '/rooms/entryway-foreground.png?v=3',
        referenceTopPct: 65,
        reference: { name: 'console top', widthCm: 120, widthPx: 465 },
        compositionOffsetXPct: 4.2,
    }),
    photoScene('home-office', 'Home Office', 461, 88, 62, 50, 145, {
        image: '/rooms/home-office-photoreal.png',
        foregroundImage: '/rooms/home-office-foreground.png?v=1',
        referenceTopPct: 65,
        reference: { name: 'desk top', widthCm: 160, widthPx: 680 },
        compositionOffsetXPct: 0,
    }),
];

// One transform drives BOTH the calibrated room composition and the artwork.
// The image fills the visualizer directly, keeping every edge cue visible and
// the photographed wall continuous across the whole canvas.
export const computeRoomLayout = (scene, width, height) => {
    if (!scene || width <= 0 || height <= 0) return null;
    const canvasWidth = scene.wallSpanCm + (scene.canvasInsetLeftCm || 0);
    // The image still fills the visualizer, while artwork uses the smaller
    // physical scale whenever a very wide, shallow viewport would otherwise
    // make it spill beyond the full wall.
    const scale = Math.min(width / canvasWidth, height / scene.sceneHeightCm);
    return {
        scale, width, height,
        left: 0, top: 0,
    };
};
/**
 * Convert a physical artwork size into CSS placement percentages for a scene.
 *
 * Returns percentages relative to the scene's own box. The caller positions
 * with `left`/`top` + `translate(-50%, -50%)` and lets `aspect-ratio` derive
 * the height — which is why no image aspect ratio is needed here, and why the
 * same numbers hold at any rendered size of the scene.
 *
 * @param {object}  scene       a ROOM_SCENES entry
 * @param {number}  widthCm     artwork's outer width, including moulding
 * @param {number}  heightCm    artwork's outer height, including moulding
 * @returns {{widthPct:number, leftPct:number, topPct:number, overflows:boolean}}
 */
// Air kept above the piece so it never reads as jammed against the ceiling.
const CEILING_MARGIN_CM = 12;

// Room references are visual anchors, so ordinary pieces sit close above
// the sofa, table, bed, console, or desk. Tall pieces retain the top-wall
// margin; their scene foreground is intentionally drawn over them where a
// reference object intersects.
export const computeReferenceAnchoredTop = (scene, layout, frameHeightPx, sizeId, orientation, frameHeightCm) => {
    if (!scene || !layout || !Number.isFinite(frameHeightPx) || frameHeightPx <= 0) return null;
    const topMargin = layout.top + 12;
    // Every room uses Studio Loft's frame origin. Switching rooms should only
    // change the surrounding reference artefacts — never move or resize the
    // selected frame itself.
    const referenceTop = layout.top + 0.65 * layout.height;
    const referenceGap = sizeId === '100x150cm' && orientation === 'portrait'
        ? 16
        : 112;
    const targetTop = referenceTop - frameHeightPx - referenceGap;
    // A 180cm-tall piece uses the full visualizer height. Keep its ceiling
    // clearance identical to Studio Loft in every scene rather than adding
    // scene-specific reference or alignment nudges.
    if (frameHeightCm >= 180) return topMargin + 20;
    return Math.max(topMargin, targetTop);
};

export const computeRoomPlacement = (scene, widthCm, heightCm) => {
    if (!scene || !Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
        return null;
    }

    const widthPct = (widthCm / scene.wallSpanCm) * 100;

    // ── HANG HEIGHT ──
    // The wall, not its furniture, is the artwork container. A tall piece can
    // cross a desk, bed, or sofa; the matching foreground band paints those
    // objects above the frame. Keep the configured gallery height where it
    // fits, then only move the piece enough to stay inside the full wall.
    const defaultCentreCm = scene.floorLineCm - (scene.hang.y / 100) * scene.sceneHeightCm;
    const lowestCentreCm = heightCm / 2;
    const highestCentreCm = scene.floorLineCm - CEILING_MARGIN_CM - heightCm / 2;
    const centreCm = Math.min(Math.max(defaultCentreCm, lowestCentreCm), highestCentreCm);
    const topPct = ((scene.floorLineCm - centreCm) / scene.sceneHeightCm) * 100;

    return {
        widthPct,
        leftPct: scene.hang.x,
        topPct,
        raisedCm: Math.max(0, Math.round(centreCm - defaultCentreCm)),
        // A piece wider than the wall itself can't be hung there. Reported
        // rather than silently clamped: clamping would quietly re-introduce
        // exactly the "every size renders the same" dishonesty this whole
        // approach exists to avoid. The caller decides how to present it.
        overflows: widthPct > 100,
        // This is now a true wall-size check, independent of the furniture.
        tooTall: heightCm + CEILING_MARGIN_CM > scene.floorLineCm,
    };
};

// ── Adding a photographic scene ──────────────────────────────────────────
//
// Photos drop in as a data entry, with no code change:
//
//   {
//       id: 'nordic-living',
//       name: 'Nordic Living Room',
//       image: '/rooms/nordic-living.webp',
//       wallSpanCm: 420,
//       sceneHeightCm: 280,     // = wallSpanCm / (imageWidthPx / imageHeightPx)
//       hang: { x: 50, y: 34 },
//       isDark: false,          // flips overlay text to light ink
//   }
//
// Requirements for the photo itself:
//   1. Shot square-on to the wall — see the note at the top of this file.
//   2. A blank stretch of wall at the hang point.
//   3. Something of known real size in frame (a sofa, a door, a standard
//      2.4m ceiling) to calibrate `wallSpanCm` against. Measure that object's
//      width in image pixels, then:
//         wallSpanCm = (objectWidthCm / objectWidthPx) * imageWidthPx






