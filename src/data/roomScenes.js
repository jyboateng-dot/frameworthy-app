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

// The drawn scenes deliberately span a range of wall widths — 300-odd cm for
// the entryway up to 440 for the dining room — because that range is itself
// the point. The same 90cm print is a modest piece on the dining wall and a
// dominating one in the hall, and picking the room you're actually hanging in
// is what makes the preview answer the question the customer has.
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
        // Where the drawn floor sits, in the same centimetres. Not used by the
        // placement math — it's what lets the tests check `hang.y` against a
        // real hang height above the floor rather than trusting the number,
        // and it's asserted against the component's own GEOMETRY export.
        floorLineCm: 245,
        // Height of the tallest thing standing directly under the hang point,
        // in the same centimetres. computeRoomPlacement raises a tall piece
        // until it clears this rather than drawing it over the furniture.
        // Read off the scene component: the sofa back tops out at 80cm.
        clearanceTopCm: 80,
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
    {
        id: 'dining-room',
        name: 'Dining Room',
        tintable: true,
        // The widest wall on offer, and the reason it's here: a piece that
        // reads as large in the loft is merely proportionate over a 180cm
        // dining table, which is exactly the judgement this scene is for.
        wallSpanCm: 440,
        sceneHeightCm: 290,
        floorLineCm: 255,
        // Table at 75cm, fruit bowl on it to 90cm.
        clearanceTopCm: 90,
        // 37.93% of 290cm = 110cm from the top = 145cm above the floor.
        hang: { x: 50, y: 37.93 },
        floorHex: '#6f5238',
    },
    {
        id: 'bedroom',
        name: 'Bedroom',
        tintable: true,
        wallSpanCm: 400,
        sceneHeightCm: 280,
        floorLineCm: 245,
        // The headboard — the reason this scene's default hang is already
        // higher than the others, and the thing a tall piece must clear.
        clearanceTopCm: 100,
        // The one scene that isn't at the 145cm gallery standard: 33.93% of
        // 280cm = 95cm from the top = 150cm above the floor. Above-the-bed
        // pieces are hung higher by convention because the headboard already
        // owns the wall to 100cm — see BedroomScene for the full note.
        hang: { x: 50, y: 33.93 },
        floorHex: '#6f5238',
    },
    {
        id: 'entryway',
        name: 'Entryway',
        tintable: true,
        // The narrow wall, and the one that most earns its keep: with a door
        // casing eating the right 88cm, this is where the preview tells a
        // customer that the large canvas they're configuring will not fit.
        wallSpanCm: 340,
        sceneHeightCm: 260,
        floorLineCm: 230,
        // Console at 80cm, the short vase on it to 100cm.
        clearanceTopCm: 100,
        // 32.69% of 260cm = 85cm from the top = 145cm above the floor.
        hang: { x: 50, y: 32.69 },
        // Stone tile, not boards — matches the bottom of this scene's own
        // floor gradient, which is what this colour has to track.
        floorHex: '#a09889',
    },
    {
        id: 'home-office',
        name: 'Home Office',
        tintable: true,
        wallSpanCm: 360,
        sceneHeightCm: 260,
        floorLineCm: 225,
        // Desk at 75cm, chair back 91cm, laptop lid 98cm — the lid wins.
        clearanceTopCm: 98,
        // 30.77% of 260cm = 80cm from the top = 145cm above the floor.
        hang: { x: 50, y: 30.77 },
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
// How much air a real person leaves between the bottom of a frame and the
// furniture under it — roughly a hand's width. Below this it reads as resting
// on the furniture rather than hanging above it.
export const FURNITURE_GAP_CM = 15;

// Air kept above the piece so it never reads as jammed against the ceiling.
const CEILING_MARGIN_CM = 12;

export const computeRoomPlacement = (scene, widthCm, heightCm) => {
    if (!scene || !Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
        return null;
    }

    const widthPct = (widthCm / scene.wallSpanCm) * 100;

    // ── HANG HEIGHT ──
    // `hang.y` is where a normally-sized piece goes: gallery height. Holding a
    // tall piece to that same centre pushes its bottom edge down into whatever
    // stands below — a 150cm piece centred at 150cm reaches to 75cm off the
    // floor, which is inside a 100cm headboard. It rendered as artwork lying
    // over the bed while the wall above it sat empty.
    //
    // Nobody hangs like that. You raise the piece until it clears the
    // furniture, and that's all this does: keep the default unless the piece
    // is tall enough to need lifting, then lift it exactly as far as it takes.
    const defaultCentreCm = scene.floorLineCm - (scene.hang.y / 100) * scene.sceneHeightCm;
    const obstacleCm = scene.clearanceTopCm ?? 0;

    const neededCentreCm = obstacleCm + FURNITURE_GAP_CM + heightCm / 2;
    // The ceiling is the other end of the same squeeze.
    const highestCentreCm = scene.floorLineCm - CEILING_MARGIN_CM - heightCm / 2;

    const centreCm = Math.min(Math.max(defaultCentreCm, neededCentreCm), Math.max(defaultCentreCm, highestCentreCm));
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
        // Even raised as far as the ceiling allows, it still can't clear the
        // furniture — the wall genuinely isn't tall enough for this piece.
        tooTall: neededCentreCm > highestCentreCm,
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
