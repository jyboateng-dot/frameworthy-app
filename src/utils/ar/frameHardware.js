import { MeshPart } from './frameMesh';

/**
 * Hanging hardware on the back of the frame.
 *
 * Worth modelling even though a hung piece hides all of it against the
 * wall: the orbit preview turns, and the back is the half of a framed
 * piece a customer never otherwise sees before it arrives. It's also
 * the only place the difference between the four options is visible at
 * all — they cost different amounts and behave differently on a wall,
 * but a front view of any of them is identical.
 *
 * Everything here is built in metres in the same space as the frame:
 * origin at the piece's centre, +Z out of the wall. Hardware therefore
 * lives at negative Z, sitting between the backing board and the wall,
 * which is where it physically goes.
 */

const IN_TO_M = 0.0254;

const HARDWARE_MATERIAL = 'hardware';

/**
 * Axis-aligned box, as six outward-facing quads.
 *
 * Hardware is all plates, bars, and brackets, so a box covers nearly
 * everything here and keeps the part counts low enough that adding
 * hardware doesn't meaningfully change the model's size.
 */
function addBox(part, cx, cy, cz, w, h, d) {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const y0 = cy - h / 2;
    const y1 = cy + h / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const uv = [0, 0];

    const faces = [
        { pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], n: [0, 0, 1] },
        { pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], n: [0, 0, -1] },
        { pts: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], n: [0, 1, 0] },
        { pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], n: [0, -1, 0] },
        { pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], n: [1, 0, 0] },
        { pts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], n: [-1, 0, 0] },
    ];

    for (const face of faces) {
        part.addQuad(face.pts[0], face.pts[1], face.pts[2], face.pts[3], uv, uv, uv, uv, face.n);
    }
}

/**
 * A square-section tube swept along a polyline — the picture wire.
 *
 * Square rather than round because at wire gauge the facets are far
 * below what any AR viewer resolves, and a round section would cost
 * several times the triangles to say the same thing.
 */
function addTube(part, points, radius) {
    const uv = [0, 0];
    for (let i = 0; i < points.length - 1; i++) {
        const [ax, ay, az] = points[i];
        const [bx, by, bz] = points[i + 1];

        // The wire runs left-to-right and sags in Y, so offsetting the
        // section in Y and Z is enough to give it body; a general frame
        // would be overkill for a line that never turns in plan.
        const corners = [
            [0, radius, radius],
            [0, -radius, radius],
            [0, -radius, -radius],
            [0, radius, -radius],
        ];

        for (let c = 0; c < 4; c++) {
            const p = corners[c];
            const q = corners[(c + 1) % 4];
            const normal = [0, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
            part.addQuad(
                [ax + p[0], ay + p[1], az + p[2]],
                [bx + p[0], by + p[1], bz + p[2]],
                [bx + q[0], by + q[1], bz + q[2]],
                [ax + q[0], ay + q[1], az + q[2]],
                uv, uv, uv, uv,
                normal
            );
        }
    }
}

/**
 * Builds the hardware for one configuration.
 *
 * @param {string} hardwareType  wire | sawtooth | french-cleat | easel
 * @param {object} frame         outer dimensions in metres, from buildFrameMesh
 * @returns {MeshPart[]} empty when the type is unrecognised
 */
export function buildHardwareParts(hardwareType, { outerWidthM, outerHeightM }) {
    const part = new MeshPart(HARDWARE_MATERIAL);
    const halfW = outerWidthM / 2;
    const halfH = outerHeightM / 2;

    // Hardware hangs off the back face, so it occupies negative Z. Kept
    // shallow — real fittings are a few millimetres, and anything
    // thicker would read as a spacer holding the piece off the wall.
    const plateD = 0.003;
    const backZ = -plateD / 2;

    switch (hardwareType) {
        case 'wire': {
            // D-rings sit about a third down from the top, which is
            // where they go on a real frame: high enough that the piece
            // hangs flat, low enough that the wire's peak stays behind
            // the moulding instead of showing above it.
            const ringY = halfH * 0.34;
            const inset = Math.min(halfW * 0.42, 0.05);
            const ringSize = Math.max(0.012, Math.min(0.02, outerWidthM * 0.05));

            for (const side of [-1, 1]) {
                const x = side * (halfW - inset);
                // Mounting plate.
                addBox(part, x, ringY, backZ, ringSize * 0.7, ringSize, plateD);
                // The D itself, standing proud of the plate.
                addBox(part, x, ringY + ringSize * 0.55, backZ - plateD, ringSize * 0.5, ringSize * 0.5, plateD * 1.5);
            }

            // Catenary between the two rings. A taut straight line reads
            // as a rod; the sag is what makes it read as wire.
            const left = -(halfW - inset);
            const right = halfW - inset;
            const sag = Math.min(halfH * 0.16, 0.035);
            const points = [];
            const STEPS = 14;
            for (let i = 0; i <= STEPS; i++) {
                const t = i / STEPS;
                const x = left + (right - left) * t;
                const y = ringY + ringSize * 0.55 - sag * Math.sin(Math.PI * t);
                points.push([x, y, backZ - plateD]);
            }
            addTube(part, points, 0.0009);
            break;
        }

        case 'sawtooth': {
            // A short toothed bar centred at the top — no wire, so it
            // sits much closer to the top edge than the D-rings do.
            const barY = halfH * 0.72;
            const barW = Math.max(0.03, Math.min(0.055, outerWidthM * 0.14));
            const barH = 0.008;
            addBox(part, 0, barY, backZ, barW, barH, plateD);

            // The teeth. Five is enough to read as a sawtooth at any
            // size this bar is drawn.
            const teeth = 5;
            const toothW = barW / (teeth * 2);
            for (let i = 0; i < teeth; i++) {
                const x = -barW / 2 + toothW * (i * 2 + 1);
                addBox(part, x, barY - barH * 0.75, backZ, toothW, barH * 0.5, plateD);
            }
            break;
        }

        case 'french-cleat': {
            // A full-width interlocking bar. This is the heavy-duty
            // option, and its whole visual identity is that it spans the
            // frame rather than being a fitting at a point.
            const cleatY = halfH * 0.55;
            const cleatW = outerWidthM * 0.62;
            const cleatH = Math.max(0.018, Math.min(0.032, outerHeightM * 0.05));
            const cleatD = 0.008;

            // The bevelled bar, approximated as two stacked plates: the
            // deeper lower plate and the shallower upper one give the
            // stepped silhouette a cleat reads by.
            addBox(part, 0, cleatY - cleatH * 0.25, backZ - cleatD / 2, cleatW, cleatH * 0.5, cleatD);
            addBox(part, 0, cleatY + cleatH * 0.25, backZ - cleatD * 0.25, cleatW, cleatH * 0.5, cleatD * 0.5);

            // Screw points, which is what tells you it's a mounted rail
            // rather than a moulding.
            for (const side of [-1, 1]) {
                addBox(part, side * cleatW * 0.35, cleatY, backZ - cleatD, 0.004, 0.004, plateD);
            }
            break;
        }

        case 'easel': {
            // A tabletop kickstand rather than wall hardware. Hinged at
            // the top and splayed back and down, so unlike the other
            // three this one changes how the piece stands rather than
            // how it attaches.
            const hingeY = halfH * 0.45;
            const legW = Math.max(0.014, Math.min(0.028, outerWidthM * 0.07));
            // Long enough that the foot lands past the frame's own
            // bottom edge. A strut that stops short of it isn't a stand
            // — the piece would tip straight onto its face, and the
            // render would be showing hardware that cannot work.
            const legLength = halfH * 1.6;
            const splay = legLength * 0.42;

            // Hinge plate.
            addBox(part, 0, hingeY, backZ, legW * 1.6, 0.01, plateD);

            // The leg, as short segments stepping back and down so it
            // reads as one angled strut without needing a rotation.
            const SEGMENTS = 8;
            for (let i = 0; i < SEGMENTS; i++) {
                const t = (i + 0.5) / SEGMENTS;
                const y = hingeY - legLength * t;
                const z = backZ - splay * t;
                addBox(part, 0, y, z, legW, legLength / SEGMENTS, 0.004);
            }
            break;
        }

        default:
            return [];
    }

    return part.isEmpty ? [] : [part];
}

/**
 * Whether this hardware pushes the piece off the wall rather than
 * against it — the easel stands on a surface, so a wall-anchored AR
 * placement would be the wrong presentation for it.
 */
export function isFreestandingHardware(hardwareType) {
    return hardwareType === 'easel';
}
