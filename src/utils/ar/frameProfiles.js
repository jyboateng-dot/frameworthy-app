/**
 * Moulding cross-sections for the AR model.
 *
 * A picture frame is one shape swept around a rectangle: cut a rail
 * anywhere along its length and you get the same silhouette. That
 * silhouette is what separates a scoop from a bevel from a shadow box,
 * so it's what this file describes — everything else in the AR pipeline
 * is that curve swept, textured, and packaged.
 *
 * Two normalized axes, so one description serves every frame size:
 *
 *   s  0 -> 1   across the moulding face, outer edge -> artwork
 *   z  0 -> 1   depth, wall/back -> the frontmost point of the face
 *
 * Real inches arrive later: `s` scales by the catalogue's
 * `mouldingWidthIn` and `z` by its `rabbetDepthIn` (both measured
 * per-frame for 322 of the 341 catalogue entries — see
 * data/frameRenderProfiles.json). So these curves carry the SHAPE and
 * the catalogue carries the SIZE, and a 0.75in narrow moulding and a
 * 4in gallery moulding of the same profile stay recognisably the same
 * family without either being hand-tuned.
 *
 * Only the front face is described here. The closed loop that gets
 * swept — outer wall up, face across, inner wall down, back — is
 * assembled by `buildCrossSection` below, because the walls and back
 * are the same for every profile and only the face actually differs.
 */

// Curved faces are sampled rather than hand-listed. 16 segments is past
// the point where the facets read as facets at the size a frame occupies
// on a wall, and the whole ring still lands around 1.4k triangles — far
// below anything Quick Look or Scene Viewer would struggle with.
const CURVE_STEPS = 16;

const sampleCurve = (fn, steps = CURVE_STEPS) => {
    const points = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        points.push({ s: t, z: fn(t) });
    }
    return points;
};

/**
 * Front-face silhouettes, outer edge to artwork.
 *
 * The five names are the catalogue's own `profile` classification
 * (frameRenderProfiles.json), which covers all 341 frames: flat 206,
 * scoop 44, raised 41, bevel 37, deep 13.
 */
const FACE_PROFILES = {
    // Planar face. The small chamfers at both edges aren't decoration —
    // a face that meets its walls at a hard 90 degrees renders as a
    // black seam under AR lighting, because no light direction can
    // catch a zero-width edge. Cutting the corner gives that edge a
    // surface to be lit.
    flat: () => [
        { s: 0.00, z: 0.86 },
        { s: 0.06, z: 1.00 },
        { s: 0.94, z: 1.00 },
        { s: 1.00, z: 0.88 },
    ],

    // One angled plane falling toward the artwork — the classic bevel
    // that throws the eye inward. Holds a short flat land at the outer
    // lip so the slope starts from a defined edge rather than a point.
    bevel: () => [
        { s: 0.00, z: 0.97 },
        { s: 0.09, z: 1.00 },
        { s: 1.00, z: 0.52 },
    ],

    // Concave cove. Two things happen at once: a dip that bottoms out
    // near mid-face (the sin term) and an overall fall toward the
    // artwork (the tilt term). Multiplying rather than adding them
    // keeps the outer lip at a true 1.0 while still landing the inner
    // edge below it, which is what makes a scoop read as scooped
    // instead of as a symmetrical gutter.
    scoop: () => sampleCurve((t) => (1 - 0.42 * Math.sin(Math.PI * t)) * (1 - 0.18 * t)),

    // Convex dome for ornate/carved/embossed mouldings. Same structure
    // as the scoop with the dip inverted, and the same slight tilt so
    // the crown sits a touch outboard of centre rather than dead
    // middle, which is how cast ornament actually sits.
    raised: () => sampleCurve((t) => (0.63 + 0.37 * Math.sin(Math.PI * t)) * (1 - 0.09 * t)),

    // Shadow box. A tall outer land, one sharp step down, then a long
    // shallow run to the artwork — the step is the whole point, since
    // it's what casts the shadow the style is named for. Left as
    // explicit points rather than a curve because the sharpness of that
    // step is the feature; sampling would round it off.
    deep: () => [
        { s: 0.00, z: 1.00 },
        { s: 0.17, z: 1.00 },
        { s: 0.29, z: 0.44 },
        { s: 1.00, z: 0.36 },
    ],

    // Prodigi's float-frame section is an L: a narrow front face and a
    // long inner wall that drops toward the 32 mm base behind the canvas.
    // The 5 mm shadow gap is handled as opening geometry by frameMesh;
    // it is deliberately not baked into this reusable rail profile.
    floater: () => [
        { s: 0.00, z: 0.92 },
        { s: 0.10, z: 1.00 },
        { s: 0.90, z: 1.00 },
        { s: 1.00, z: 0.92 },
        { s: 1.00, z: 0.24 },
    ],
};

export const SUPPORTED_PROFILES = Object.keys(FACE_PROFILES);

/**
 * The closed silhouette that gets swept around the frame, as an ordered
 * loop of `{ s, z }` in the normalized space described at the top.
 *
 * Order matters: the sweep walks this list and emits a quad between
 * each consecutive pair, so the list has to trace the outline
 * continuously — back-outer, up the outer wall, across the face, down
 * the inner wall, and back along the underside to where it started.
 *
 * `profile` accepts anything; an unrecognised name falls back to flat
 * rather than throwing, since this sits between catalogue data and a
 * user-facing preview and a frame with an odd profile string should
 * still get a frame, not an error.
 */
export function buildCrossSection(profile) {
    const face = (FACE_PROFILES[profile] || FACE_PROFILES.flat)();

    return [
        // Back face, outer corner — the point resting against the wall.
        // The segment from here up to the face's own first point IS the
        // outer wall; every profile starts its face at s = 0, so adding
        // a separate vertex for the top of that wall would repeat a
        // point that already exists and sweep a zero-area quad off it.
        { s: 0, z: 0 },
        // The face itself.
        ...face,
        // Inner wall, dropping from the face to the rabbet floor. This
        // is the surface that reads as the frame's depth when you view
        // a hung piece from an angle, which in AR is most of the time.
        { s: 1, z: 0 },
    ];
}

/**
 * How far the face stands proud of the artwork, as a fraction of total
 * depth — the maximum `z` any point on this profile reaches.
 *
 * The mat and artwork panels are positioned against this rather than
 * against a fixed constant, so a shadow box recesses its artwork
 * visibly deeper than a flat moulding does instead of every profile
 * sitting the art at the same depth.
 */
export function getFaceRelief(profile) {
    const face = (FACE_PROFILES[profile] || FACE_PROFILES.flat)();
    return face.reduce((max, p) => Math.max(max, p.z), 0);
}
