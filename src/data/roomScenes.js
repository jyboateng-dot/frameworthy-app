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
        // 279, not the 420x280 viewBox's midpoint-ish 245 you'd guess from the
        // wall span alone — the floor strip below it was trimmed from 35cm
        // (245) to 16cm (264) to 2cm (278) to a 1cm hairline (see
        // StudioLoftScene's FLOOR_Y comment) to hand the wall more of the
        // same canvas. Stays exact by construction: this MUST match the
        // component's own FLOOR_Y, and the drawn-geometry cross-check test
        // below catches it if they ever drift apart.
        floorLineCm: 279,
        // Height of the tallest thing standing directly under the hang point,
        // in the same centimetres. computeRoomPlacement raises a tall piece
        // until it clears this rather than drawing it over the furniture.
        // Read off the scene component: the sofa back tops out at 80cm.
        clearanceTopCm: 80,
        // Centre point of the hanging zone, as a % of the image box. Solved
        // for the same 140cm-above-floor gallery height as before, against
        // the new floorLineCm: (279-140)/280 = 49.64%.
        hang: { x: 50, y: 49.64 },
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
        // Was 255 (35cm floor), 274 (16cm), 288 (2cm) — now 289, a 1cm
        // hairline (see StudioLoftScene's FLOOR_Y comment). Must match the
        // component's own FLOOR_Y.
        floorLineCm: 289,
        // Table at 75cm, fruit bowl on it to 90cm.
        clearanceTopCm: 90,
        // Solved for the same 145cm-above-floor gallery height against the
        // new floorLineCm: (289-145)/290 = 49.66%.
        hang: { x: 50, y: 49.66 },
        floorHex: '#6f5238',
    },
    {
        id: 'bedroom',
        name: 'Bedroom',
        tintable: true,
        wallSpanCm: 400,
        sceneHeightCm: 280,
        // Was 245 (35cm floor), 264 (16cm), 278 (2cm) — now 279, a 1cm
        // hairline (see StudioLoftScene's FLOOR_Y comment). Must match the
        // component's own FLOOR_Y. The scene most likely to actually need
        // this: a tall piece over the bed is the case that comes closest to
        // not fitting the wall at all — the 100×150cm piece that used to
        // overlap the headboard by 19.4cm (then 7.4, then 4.6, then cleared
        // by 8.3 once the floor hit 2cm) now clears by even more. See
        // computeRoomPlacement's `tooTall` for the set of sizes still too
        // big for this wall.
        floorLineCm: 279,
        // The headboard — the reason this scene's default hang is already
        // higher than the others, and the thing a tall piece must clear.
        clearanceTopCm: 100,
        // The one scene that isn't at the 145cm gallery standard: solved for
        // the same 150cm-above-floor default as before, against the new
        // floorLineCm: (279-150)/280 = 46.07%. Above-the-bed pieces are hung
        // higher by convention because the headboard already owns the wall
        // to 100cm — see BedroomScene for the full note.
        hang: { x: 50, y: 46.07 },
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
        canvasInsetLeftCm: 40,
        sceneHeightCm: 260,
        // Was 230 (30cm floor), 246 (14cm), 258 (2cm) — now 259, a 1cm
        // hairline, same depth as every other scene despite this one
        // starting thinner (tile, not boards) — see StudioLoftScene's
        // FLOOR_Y comment. Must match the component's own FLOOR_Y. Worth the
        // most here: the narrowest wall on offer is the one most likely to
        // need every spare centimetre for a tall piece.
        floorLineCm: 259,
        // Frames hang over the console at the wall centre, so their obstacle
        // is the vase's true 129cm top — not the hook rail, which is confined
        // to the far-left 80cm of the wall. Treating that distant rack as a
        // centre-line obstacle lifted every small frame needlessly high above
        // the console. This matches EntrywayScene's vase top at y=130 against
        // a floor line of 259 (259 - 130 = 129cm).
        clearanceTopCm: 129,
        // The usable span between the hook rail and door casing centres at
        // 147cm (43.24% of this 340cm wall). It matches EntrywayScene's
        // console centre, keeping the frame and console/objects as one
        // composition rather than centring them on the whole wall.
        // y remains the same 145cm-above-floor gallery height:
        // (259-145)/260 = 43.85%.
        hang: { x: 40.29, y: 43.85 },
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
        // Was 225 (35cm floor), 244 (16cm), 258 (2cm) — now 259, a 1cm
        // hairline (see StudioLoftScene's FLOOR_Y comment). Must match the
        // component's own FLOOR_Y. Doesn't affect the floating shelf on the
        // right, which is positioned from the wall's own top rather than off
        // this line.
        floorLineCm: 259,
        // Desk at 75cm, chair back 91cm, laptop lid 98cm — the lid wins.
        clearanceTopCm: 98,
        // Solved for the same 145cm-above-floor gallery height against the
        // new floorLineCm: (259-145)/260 = 43.85%.
        hang: { x: 50, y: 43.85 },
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
    // The ceiling is the other end of the same squeeze — two candidate caps,
    // not one. CEILING_MARGIN_CM is cosmetic breathing room for the normal
    // case, where the piece clears the furniture with room to spare and a
    // flush-to-ceiling top would look cramped. `Absolute` is the true
    // physical limit: top flush with the ceiling, zero margin.
    //
    // A piece can need MORE lift than the polished cap allows — 150cm in a
    // 245cm-tall Bedroom wall over a 100cm headboard does, structurally,
    // regardless of margins. Holding the cosmetic margin there doesn't buy
    // any polish, because the piece is already overlapping the furniture; it
    // only wastes centimetres that would otherwise shrink that overlap. So
    // the margin is spent, not kept, once the polished cap can't clear the
    // furniture anyway — every last cm above goes toward the piece instead.
    const highestCentreCmPolished = scene.floorLineCm - CEILING_MARGIN_CM - heightCm / 2;
    const highestCentreCmAbsolute = scene.floorLineCm - heightCm / 2;
    const highestCentreCm =
        neededCentreCm > highestCentreCmPolished ? highestCentreCmAbsolute : highestCentreCmPolished;

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
        // Even raised flush against the ceiling — zero margin, the true
        // physical limit, not just the polished cap — it still can't clear
        // the furniture. The wall genuinely isn't tall enough for this piece
        // at any height; this is the honest floor for how much it overlaps.
        tooTall: neededCentreCm > highestCentreCmAbsolute,
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
