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

export const ROOM_SCENES = [
    {
        id: 'studio-loft',
        name: 'Studio Loft',
        // Drawn rather than photographed, so the wall repaints live with the
        // wall-colour picker instead of being locked to whatever colour the
        // photographer's wall happened to be. Photographic scenes get an
        // `image` URL instead of `tintable` — see the note at the bottom.
        tintable: true,
        // The scene's own geometry is authored directly in centimetres
        // (viewBox="0 0 420 280"), so this calibration is exact by
        // construction rather than measured off a reference object.
        wallSpanCm: 420,
        // Vertical span, same units. Only used to derive the scene's aspect
        // ratio for layout — the placement math itself is width-driven.
        sceneHeightCm: 280,
        // Centre point of the hanging zone, as a % of the image box. y=37.5%
        // of a 280cm-tall scene = 105cm from the top = 140cm above the floor
        // line at 245cm, i.e. gallery height, clearing the sofa back.
        hang: { x: 50, y: 37.5 },
        // The scene box is sized so its wall span exactly matches the
        // visualizer's width — which is what keeps the placement math a
        // direct ratio — so it won't always be tall enough to reach the
        // bottom of the panel. This is the colour the floor continues in
        // below the scene, matching the bottom of its floor gradient, so the
        // backdrop reads as full-bleed rather than a letterboxed picture.
        // (Above the scene, the panel's own wall colour already matches.)
        floorHex: '#6f5238',
    },
];

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
export const computeRoomPlacement = (scene, widthCm, heightCm) => {
    if (!scene || !Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
        return null;
    }

    const widthPct = (widthCm / scene.wallSpanCm) * 100;

    return {
        widthPct,
        leftPct: scene.hang.x,
        topPct: scene.hang.y,
        // A piece wider than the wall itself can't be hung there. Reported
        // rather than silently clamped: clamping would quietly re-introduce
        // exactly the "every size renders the same" dishonesty this whole
        // approach exists to avoid. The caller decides how to present it.
        overflows: widthPct > 100,
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
