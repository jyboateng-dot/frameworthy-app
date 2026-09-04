import { buildCrossSection, getFaceRelief } from './frameProfiles';

/**
 * Turns a frame's catalogue measurements into the actual triangles the
 * AR model is made of.
 *
 * The whole frame is one operation: take the cross-section from
 * frameProfiles and sweep it around a rectangle. Mitres fall out of
 * that for free — at cross-section position `s` the sweep path is the
 * outer rectangle inset by `s * mouldingWidth`, so the four rails meet
 * along the 45-degree diagonals automatically rather than needing to be
 * cut and joined.
 *
 * Everything is emitted in metres, which is glTF's and USD's shared
 * convention and what makes `ar-scale="fixed"` mean true physical size:
 * a 60cm frame arrives on the wall 60cm wide with no scaling step
 * anywhere in between.
 */

const IN_TO_M = 0.0254;

// Backing board, hanging hardware, and the sliver of air behind the
// artwork. Real frames stand further off the wall than their rabbet
// alone accounts for, and without this the thinnest mouldings render as
// paper against a wall in AR — the one place the illusion is easiest to
// break, because a viewer sees the frame's edge from an angle almost
// immediately.
const BACKING_IN = 0.1875;

// Museum board is 4-ply, and a 45-degree window cut through it exposes
// exactly its own thickness as the white core line every framer knows.
// So one number sets both the mat's thickness and its bevel width.
const MAT_BOARD_IN = 0.0625;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (v) => {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
};

/**
 * One material's worth of geometry. Kept separate per material because
 * both glTF and USD want geometry grouped that way, and because it lets
 * the writers stay dumb — they serialise whatever parts they're handed
 * without knowing a rail from a mat.
 */
export class MeshPart {
    constructor(material) {
        this.material = material;
        this.positions = [];
        this.normals = [];
        this.uvs = [];
        this.indices = [];
    }

    /**
     * Adds a quad as two triangles, with `outward` deciding which face
     * is the front.
     *
     * Winding is corrected against that hint rather than trusted from
     * the caller's vertex order. Four rails, a mat ring, and a bevel
     * ring are each traversed in their own direction, and hand-deriving
     * the correct order for all of them is exactly the kind of thing
     * that produces one silently inside-out surface that only shows up
     * as an invisible rail once it's on someone's wall.
     */
    addQuad(p0, p1, p2, p3, uv0, uv1, uv2, uv3, outward) {
        let n = normalize(cross(sub(p1, p0), sub(p3, p0)));
        let verts = [p0, p1, p2, p3];
        let uvs = [uv0, uv1, uv2, uv3];

        if (dot(n, outward) < 0) {
            n = [-n[0], -n[1], -n[2]];
            verts = [p0, p3, p2, p1];
            uvs = [uv0, uv3, uv2, uv1];
        }

        const base = this.positions.length / 3;
        for (let i = 0; i < 4; i++) {
            this.positions.push(verts[i][0], verts[i][1], verts[i][2]);
            this.normals.push(n[0], n[1], n[2]);
            this.uvs.push(uvs[i][0], uvs[i][1]);
        }
        this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    get isEmpty() {
        return this.indices.length === 0;
    }
}

/**
 * A flat rectangular ring (rectangle with a rectangular hole) as four
 * trapezoids. Used for the mat's face; `z` is constant across it.
 *
 * `innerOffsetY` shifts the inner hole up/down relative to the outer
 * rectangle's centre, without moving the outer rectangle itself — how a
 * bottom-weighted mat is built: the sight opening (outer) stays centred
 * in the rabbet, but the window around the artwork (inner) sits closer
 * to the top, leaving the wider reveal at the bottom. 0 reproduces the
 * old centred ring exactly.
 */
function addFlatRing(part, outerW, outerH, innerW, innerH, z, uvScale = null, innerOffsetY = 0) {
    const ow = outerW / 2;
    const oh = outerH / 2;
    const iw = innerW / 2;
    const ihTop = innerH / 2 + innerOffsetY;
    const ihBottom = -innerH / 2 + innerOffsetY;
    const up = [0, 0, 1];

    // UVs only matter when the ring carries a texture rather than a
    // flat colour; a null scale means "solid material, park them at 0".
    const uv = uvScale
        ? (x, y) => [(x / outerW) + 0.5, 0.5 - (y / outerH)]
        : () => [0, 0];

    const corners = [
        // top strip
        [[-ow, oh], [ow, oh], [iw, ihTop], [-iw, ihTop]],
        // bottom strip
        [[-iw, ihBottom], [iw, ihBottom], [ow, -oh], [-ow, -oh]],
        // left strip
        [[-ow, -oh], [-iw, ihBottom], [-iw, ihTop], [-ow, oh]],
        // right strip
        [[ow, -oh], [ow, oh], [iw, ihTop], [iw, ihBottom]],
    ];

    for (const quad of corners) {
        const pts = quad.map(([x, y]) => [x, y, z]);
        part.addQuad(pts[0], pts[1], pts[2], pts[3], uv(quad[0][0], quad[0][1]), uv(quad[1][0], quad[1][1]), uv(quad[2][0], quad[2][1]), uv(quad[3][0], quad[3][1]), up);
    }
}

/**
 * The angled band of exposed board between a mat's face and the artwork
 * behind it — the white core line. `offsetY` shifts both the front and
 * back rectangles together (they stay concentric — the bevel is a
 * straight-through cut, uniformly wider at the front by the board's own
 * thickness), matching whatever offset addFlatRing's inner hole used for
 * the same mat, so the bevel lines up with the window it borders.
 */
function addBevelRing(part, frontW, frontH, frontZ, backW, backH, backZ, offsetY = 0) {
    const fw = frontW / 2;
    const fh = frontH / 2 + offsetY;
    const fh2 = -frontH / 2 + offsetY;
    const bw = backW / 2;
    const bh = backH / 2 + offsetY;
    const bh2 = -backH / 2 + offsetY;
    const uv = [0, 0];

    // Each band faces inward toward the artwork's centre line, which is
    // what makes it visible when looking at the piece straight on.
    const bands = [
        { front: [[-fw, fh], [fw, fh]], back: [[bw, bh], [-bw, bh]], out: [0, -1, 0.6] },
        { front: [[fw, fh2], [-fw, fh2]], back: [[-bw, bh2], [bw, bh2]], out: [0, 1, 0.6] },
        { front: [[-fw, fh2], [-fw, fh]], back: [[-bw, bh], [-bw, bh2]], out: [1, 0, 0.6] },
        { front: [[fw, fh], [fw, fh2]], back: [[bw, bh2], [bw, bh]], out: [-1, 0, 0.6] },
    ];

    for (const band of bands) {
        part.addQuad(
            [band.front[0][0], band.front[0][1], frontZ],
            [band.front[1][0], band.front[1][1], frontZ],
            [band.back[0][0], band.back[0][1], backZ],
            [band.back[1][0], band.back[1][1], backZ],
            uv, uv, uv, uv,
            normalize(band.out)
        );
    }
}

/**
 * Builds the complete frame model.
 *
 * @param {object} spec
 * @param {number} spec.artworkWidthIn   artwork's own width, before mat or moulding
 * @param {number} spec.artworkHeightIn
 * @param {number} spec.mouldingWidthIn  catalogue face width
 * @param {number} spec.rabbetDepthIn    catalogue rabbet depth
 * @param {string} spec.profile          one of frameProfiles' silhouettes
 * @param {{topIn: number, sideIn: number, bottomIn: number}} [spec.matReveal]
 *                                       mat reveal per edge, all 0 for no mat —
 *                                       the same shape matting.js's getMatReveal
 *                                       returns. left/right always use sideIn;
 *                                       top and bottom are independent so the
 *                                       standard bottom-weighted mat (bottom
 *                                       wider than top/sides) matches the 2D
 *                                       visualizer exactly instead of coming out
 *                                       symmetric here.
 * @param {number} spec.railTileAspect   rail texture's length/thickness ratio,
 *                                       used to tile it at true physical scale
 * @param {boolean} spec.hasCorner       real photographed mitre-corner texture
 *                                       is available for this frame — carves a
 *                                       one-moulding-width block at each of the
 *                                       4 corners onto its own material instead
 *                                       of tiling the rail strip through them
 * @returns {{parts: MeshPart[], outerWidthM: number, outerHeightM: number, depthM: number}}
 */
export function buildFrameMesh({
    artworkWidthIn,
    artworkHeightIn,
    mouldingWidthIn,
    rabbetDepthIn,
    profile,
    matReveal = { topIn: 0, sideIn: 0, bottomIn: 0 },
    railTileAspect = 4,
    hasCorner = false,
}) {
    const matTopIn = Math.max(0, Number(matReveal?.topIn) || 0);
    const matSideIn = Math.max(0, Number(matReveal?.sideIn) || 0);
    const matBottomIn = Math.max(0, Number(matReveal?.bottomIn) || 0);
    const hasMat = matTopIn > 0 || matSideIn > 0 || matBottomIn > 0;
    const sightWidthIn = artworkWidthIn + matSideIn * 2;
    const sightHeightIn = artworkHeightIn + matTopIn + matBottomIn;
    // How far the artwork+bevel window sits off-centre within the sight
    // opening: a wider bottom reveal than top pushes the window upward
    // (more room left below it), by half the difference between the two.
    const matOffsetInM = ((matBottomIn - matTopIn) / 2) * IN_TO_M;
    const outerWidthIn = sightWidthIn + mouldingWidthIn * 2;
    const outerHeightIn = sightHeightIn + mouldingWidthIn * 2;

    const totalDepthIn = rabbetDepthIn + BACKING_IN;
    const depthM = totalDepthIn * IN_TO_M;
    const railWidthM = mouldingWidthIn * IN_TO_M;
    const outerHalfW = (outerWidthIn * IN_TO_M) / 2;
    const outerHalfH = (outerHeightIn * IN_TO_M) / 2;

    const section = buildCrossSection(profile);

    // The rail texture tiles at the scale its own photograph implies:
    // the strip's short axis IS the moulding face, so one tile spans
    // (face width x length/thickness) inches of real rail. Deriving the
    // repeat from that instead of picking a constant means a 4in
    // gallery moulding shows its grain at 4in scale rather than at
    // whatever looked right on a 1in sample.
    const tileLengthM = mouldingWidthIn * railTileAspect * IN_TO_M;
    // Preserve the photographed strip's physical scale. Rounding to a
    // whole repeat stretched or compressed moulding details differently
    // at every frame size; fractional repeat is valid with REPEAT wrap.
    const repeatFor = (lengthM) => Math.max(0.01, lengthM / Math.max(tileLengthM, 1e-4));

    const railPart = new MeshPart('rail');
    const cornerPart = new MeshPart('railCorner');

    // A real photographed corner shot is one specific mitre, not a
    // repeating pattern, so it is draped once over a block this wide
    // measured back from each outer corner — the same "one moulding
    // width" a framer would think of as the corner of the stick — rather
    // than tiled like the straight run.
    const cornerLenM = railWidthM;

    // Each rail: which way `s` advances in world space, which axis the
    // rail runs along, and which side of the frame it sits on.
    // Everything else about the sweep is shared.
    const rails = [
        { lateral: [0, -1, 0], axis: 'x', sign: 1 },   // top
        { lateral: [0, 1, 0], axis: 'x', sign: -1 },   // bottom
        { lateral: [1, 0, 0], axis: 'y', sign: -1 },   // left
        { lateral: [-1, 0, 0], axis: 'y', sign: 1 },   // right
    ];

    for (const rail of rails) {
        const isHorizontal = rail.axis === 'x';
        const spanM = isHorizontal ? outerHalfW * 2 : outerHalfH * 2;
        const repeat = repeatFor(spanM);
        // Computed once per rail from its nominal (s=0) length, same as
        // `repeat` above, rather than refit per cross-section band — a
        // handful of bands tiling at a very slightly different scale
        // near the inner edge is not worth the added complexity.
        const middleRepeat = repeatFor(Math.max(spanM - cornerLenM * 2, tileLengthM));

        // Walks every consecutive pair including the wrap from the last
        // station back to the first, which closes the loop across the
        // rail's back — the surface you'd see looking at the wall from
        // the side of a hung piece.
        for (let j = 0; j < section.length; j++) {
            const a = section[j];
            const b = section[(j + 1) % section.length];

            // Two identical stations sweep a zero-area quad, whose
            // normal is a zero vector — which reads as an unlit black
            // band rather than as a missing surface, so it is worth
            // refusing here rather than finding it on a wall later.
            if (Math.abs(b.s - a.s) < 1e-9 && Math.abs(b.z - a.z) < 1e-9) continue;

            const insetA = a.s * railWidthM;
            const insetB = b.s * railWidthM;
            const zA = a.z * depthM;
            const zB = b.z * depthM;

            // Analytic outward direction for this segment — see addQuad
            // on why the winding is checked against it rather than
            // assumed.
            //
            // Derived by rotating the cross-section's own tangent a
            // quarter turn *within the cross-section plane* (the plane
            // spanned by this rail's lateral axis and Z), rather than by
            // crossing the tangent with the rail's length axis. Those
            // agree only when (lateral, along, Z) happens to be
            // right-handed, which holds for the top and left rails and
            // is mirrored for the bottom and right ones — so the cross
            // product silently returned inward normals for half the
            // frame, and backface culling rendered those two rails as
            // see-through.
            //
            // Rotating in-plane has no handedness to get wrong: the
            // tangent is lateral*(ds*W) + Z*(dz*D), so its perpendicular
            // is lateral*(-dz*D) + Z*(ds*W), which points out of the
            // solid for every rail. Sanity check on the front face
            // (ds > 0, dz = 0) it reduces to +Z on all four.
            const ds = b.s - a.s;
            const dz = b.z - a.z;
            const outward = normalize([
                -rail.lateral[0] * dz * depthM,
                -rail.lateral[1] * dz * depthM,
                ds * railWidthM,
            ]);

            // Unifies both axes: `length` is the coordinate that runs
            // along the rail (repeats/carries the corner blocks),
            // `lateral` is the one that's constant across this station's
            // whole quad. makePoint puts them back in (x, y, z) order
            // per axis, matching the two branches this replaced.
            const halfLenA = isHorizontal ? outerHalfW - insetA : outerHalfH - insetA;
            const halfLenB = isHorizontal ? outerHalfW - insetB : outerHalfH - insetB;
            const latA = isHorizontal ? rail.sign * (outerHalfH - insetA) : rail.sign * (outerHalfW - insetA);
            const latB = isHorizontal ? rail.sign * (outerHalfH - insetB) : rail.sign * (outerHalfW - insetB);
            const makePoint = isHorizontal
                ? (length, lat, z) => [length, lat, z]
                : (length, lat, z) => [lat, length, z];

            if (!hasCorner) {
                railPart.addQuad(
                    makePoint(-halfLenA, latA, zA), makePoint(halfLenA, latA, zA),
                    makePoint(halfLenB, latB, zB), makePoint(-halfLenB, latB, zB),
                    [0, a.s], [repeat, a.s], [repeat, b.s], [0, b.s],
                    outward
                );
                continue;
            }

            // Clamped per band so a narrow frame or an unusually wide
            // moulding — where one end's corner block would overlap the
            // other — degrades to "this whole band is corner" instead of
            // producing an inverted or negative-length middle segment.
            const cutA = Math.min(cornerLenM, halfLenA);
            const cutB = Math.min(cornerLenM, halfLenB);

            const segments = [
                { fromA: -halfLenA, toA: -halfLenA + cutA, fromB: -halfLenB, toB: -halfLenB + cutB, corner: true },
                { fromA: -halfLenA + cutA, toA: halfLenA - cutA, fromB: -halfLenB + cutB, toB: halfLenB - cutB, corner: false },
                { fromA: halfLenA - cutA, toA: halfLenA, fromB: halfLenB - cutB, toB: halfLenB, corner: true },
            ];

            for (const seg of segments) {
                if (seg.toA - seg.fromA < 1e-6 && seg.toB - seg.fromB < 1e-6) continue;

                const p0 = makePoint(seg.fromA, latA, zA);
                const p1 = makePoint(seg.toA, latA, zA);
                const p2 = makePoint(seg.toB, latB, zB);
                const p3 = makePoint(seg.fromB, latB, zB);

                // v runs across the moulding face either way, matching
                // the outer-edge-at-v=0 convention both texture builders
                // use. u repeats along the straight run; a corner block
                // gets the whole photographed tile once, uncropped.
                if (seg.corner) {
                    cornerPart.addQuad(p0, p1, p2, p3, [0, a.s], [1, a.s], [1, b.s], [0, b.s], outward);
                } else {
                    railPart.addQuad(p0, p1, p2, p3, [0, a.s], [middleRepeat, a.s], [middleRepeat, b.s], [0, b.s], outward);
                }
            }
        }
    }

    // The artwork sits just behind the profile's inner lip, so how
    // recessed it looks is a property of the moulding rather than a
    // fixed number: a shadow box drops its inner edge to a third of its
    // (already deep) section and reads as genuinely deep, while a flat
    // moulding holds its artwork close to the surface.
    const innerLip = section[section.length - 2]?.z ?? getFaceRelief(profile);
    const glazingZ = innerLip * depthM * 0.97;
    const matBoardM = MAT_BOARD_IN * IN_TO_M;

    const sightWidthM = sightWidthIn * IN_TO_M;
    const sightHeightM = sightHeightIn * IN_TO_M;
    const artWidthM = artworkWidthIn * IN_TO_M;
    const artHeightM = artworkHeightIn * IN_TO_M;

    const parts = [railPart, cornerPart];

    let artZ = glazingZ;

    if (hasMat) {
        const matPart = new MeshPart('mat');
        const bevelPart = new MeshPart('matBevel');

        // 45-degree cut: the window is one board thickness wider at the
        // face than where it meets the artwork.
        const windowFrontW = artWidthM + matBoardM * 2;
        const windowFrontH = artHeightM + matBoardM * 2;
        artZ = glazingZ - matBoardM;

        addFlatRing(matPart, sightWidthM, sightHeightM, windowFrontW, windowFrontH, glazingZ, null, matOffsetInM);
        addBevelRing(bevelPart, windowFrontW, windowFrontH, glazingZ, artWidthM, artHeightM, artZ, matOffsetInM);

        parts.push(matPart, bevelPart);
    }

    // Artwork panel. UVs are a plain 0-1 fit because the texture is
    // composited to this exact aspect ratio before it gets here. Offset
    // on Y the same way the mat's own window was, above — with no mat
    // the offset is 0 anyway (matTopIn/matBottomIn both 0), so this is a
    // no-op in that case.
    const artPart = new MeshPart('art');
    const aw = (hasMat ? artWidthM : sightWidthM) / 2;
    const ah = (hasMat ? artHeightM : sightHeightM) / 2;
    const ay = hasMat ? matOffsetInM : 0;
    artPart.addQuad(
        [-aw, -ah + ay, artZ], [aw, -ah + ay, artZ], [aw, ah + ay, artZ], [-aw, ah + ay, artZ],
        [0, 1], [1, 1], [1, 0], [0, 0],
        [0, 0, 1]
    );
    parts.push(artPart);

    // Backing board closing the opening. Without it the frame is a hole
    // when viewed from behind or steeply from the side, which AR makes
    // easy to do by simply walking past the wall.
    const backPart = new MeshPart('backing');
    const bw = sightWidthM / 2;
    const bh = sightHeightM / 2;
    backPart.addQuad(
        [-bw, -bh, 0], [bw, -bh, 0], [bw, bh, 0], [-bw, bh, 0],
        [0, 0], [0, 0], [0, 0], [0, 0],
        [0, 0, -1]
    );
    parts.push(backPart);

    return {
        parts: parts.filter((p) => !p.isEmpty),
        outerWidthM: outerHalfW * 2,
        outerHeightM: outerHalfH * 2,
        depthM,
    };
}
