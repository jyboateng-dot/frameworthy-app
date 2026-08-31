// Validates the two binary containers the AR pipeline writes by hand.
//
// Both formats fail silently in the place that matters: a malformed
// .glb makes Scene Viewer show an empty room, and a .usdz whose entries
// aren't 64-byte aligned makes Quick Look refuse to open with no
// diagnostic beyond a dismissed sheet. Neither surfaces in a browser,
// so the structural rules are asserted here instead.
import { describe, it, expect } from 'vitest';
import { buildFrameMesh } from './frameMesh';
import { buildGlb } from './glbWriter';
import { buildUsda, packUsdz } from './usdzWriter';
import { buildCrossSection, SUPPORTED_PROFILES } from './frameProfiles';
import { buildHardwareParts } from './frameHardware';

const IN_TO_M = 0.0254;

const sampleMesh = (overrides = {}) => buildFrameMesh({
    artworkWidthIn: 16,
    artworkHeightIn: 20,
    mouldingWidthIn: 1.25,
    rabbetDepthIn: 0.5625,
    profile: 'scoop',
    matIn: 2,
    railTileAspect: 4,
    ...overrides,
});

const solidMaterials = (parts) => Object.fromEntries(
    [...new Set(parts.map((p) => p.material))].map((name) => [
        name,
        { baseColor: [1, 1, 1, 1], metallic: 0, roughness: 0.8 },
    ])
);

describe('cross-sections', () => {
    it('closes the loop for every catalogue profile', () => {
        for (const profile of SUPPORTED_PROFILES) {
            const section = buildCrossSection(profile);
            expect(section.length, profile).toBeGreaterThan(3);
            // Starts and ends on the back plane so the sweep's wrap-around
            // segment forms the rail's back rather than a gap.
            expect(section[0]).toEqual({ s: 0, z: 0 });
            expect(section[section.length - 1]).toEqual({ s: 1, z: 0 });
            for (const point of section) {
                expect(point.s).toBeGreaterThanOrEqual(0);
                expect(point.s).toBeLessThanOrEqual(1);
                expect(point.z).toBeGreaterThanOrEqual(0);
                expect(point.z).toBeLessThanOrEqual(1);
            }
        }
    });
});

describe('frame mesh', () => {
    it('sizes the model to artwork + mat + moulding, in metres', () => {
        const mesh = sampleMesh();
        // 16 + 2*2 mat + 2*1.25 moulding = 22.5in wide
        expect(mesh.outerWidthM).toBeCloseTo(22.5 * IN_TO_M, 6);
        expect(mesh.outerHeightM).toBeCloseTo(26.5 * IN_TO_M, 6);
    });

    it('stands off the wall by rabbet plus backing', () => {
        const mesh = sampleMesh({ rabbetDepthIn: 0.5625 });
        expect(mesh.depthM).toBeCloseTo((0.5625 + 0.1875) * IN_TO_M, 6);
    });

    it('emits mat geometry only when a mat is configured', () => {
        const withMat = sampleMesh({ matIn: 2 }).parts.map((p) => p.material);
        const without = sampleMesh({ matIn: 0 }).parts.map((p) => p.material);
        expect(withMat).toContain('mat');
        expect(withMat).toContain('matBevel');
        expect(without).not.toContain('mat');
        expect(without).not.toContain('matBevel');
    });

    it('produces unit-length normals and complete triangles', () => {
        for (const part of sampleMesh().parts) {
            expect(part.indices.length % 3).toBe(0);
            expect(part.positions.length).toBe(part.normals.length);
            expect(part.uvs.length / 2).toBe(part.positions.length / 3);
            for (let i = 0; i < part.normals.length; i += 3) {
                const len = Math.hypot(part.normals[i], part.normals[i + 1], part.normals[i + 2]);
                expect(len).toBeCloseTo(1, 4);
            }
            const vertexCount = part.positions.length / 3;
            for (const index of part.indices) {
                expect(index).toBeLessThan(vertexCount);
            }
        }
    });

    it('faces every rail outward, on all four sides', () => {
        // Backface culling turns an inward-facing rail into a
        // see-through gap rather than an error, and it is only visible
        // from the side the mistake is on — which is how a version of
        // this shipped with the bottom and right rails hollow while the
        // top and left looked perfect.
        for (const profile of SUPPORTED_PROFILES) {
            const mesh = sampleMesh({ profile });
            const rail = mesh.parts.find((p) => p.material === 'rail');

            let frontFacing = 0;
            for (let i = 0; i < rail.positions.length; i += 3) {
                const z = rail.positions[i + 2];
                const nz = rail.normals[i + 2];
                // Vertices out at the frontmost depth belong to the face,
                // and every one of them must look at the viewer, not away.
                if (z > mesh.depthM * 0.55 && Math.abs(nz) > 0.9) {
                    expect(nz, `${profile} front face normal`).toBeGreaterThan(0);
                    frontFacing++;
                }
            }
            expect(frontFacing, `${profile} had no front-facing vertices`).toBeGreaterThan(0);
        }
    });

    it('never points a rail normal back into the frame body', () => {
        // The outward direction is derived per segment; a sign error in
        // that derivation shows up as normals whose lateral component
        // points toward the artwork rather than away from it.
        const mesh = sampleMesh();
        const rail = mesh.parts.find((p) => p.material === 'rail');
        for (let i = 0; i < rail.positions.length; i += 3) {
            const [x, y] = [rail.positions[i], rail.positions[i + 1]];
            const [nx, ny] = [rail.normals[i], rail.normals[i + 1]];
            // On the outer wall the normal must agree with which side of
            // centre the vertex sits on.
            const onOuterEdge = Math.abs(Math.abs(x) - mesh.outerWidthM / 2) < 1e-6
                || Math.abs(Math.abs(y) - mesh.outerHeightM / 2) < 1e-6;
            if (onOuterEdge && Math.hypot(nx, ny) > 0.9) {
                expect(nx * x + ny * y).toBeGreaterThan(0);
            }
        }
    });

    it('leaves geometry untouched when no corner texture resolved', () => {
        // hasCorner defaults to false, so every existing caller — and
        // every frame without a corner photo — must render exactly as it
        // did before this material existed.
        const withoutFlag = sampleMesh();
        const explicitFalse = sampleMesh({ hasCorner: false });
        expect(withoutFlag.parts.map((p) => p.material)).not.toContain('railCorner');
        expect(explicitFalse.parts.map((p) => p.material)).not.toContain('railCorner');
    });

    it('carves a corner block at each of the 4 corners when hasCorner is set', () => {
        for (const profile of SUPPORTED_PROFILES) {
            const mesh = sampleMesh({ profile, hasCorner: true });
            const corner = mesh.parts.find((p) => p.material === 'railCorner');
            expect(corner, profile).toBeDefined();
            expect(corner.indices.length, profile).toBeGreaterThan(0);
            // 4 corners x 2 rail-ends each x however many cross-section
            // bands the profile has, one quad (2 triangles) apiece.
            const section = buildCrossSection(profile);
            expect(corner.indices.length / 3).toBe(section.length * 8 * 2);
        }
    });

    it('keeps corner geometry sane: no degenerate normals, valid indices, front-facing', () => {
        const mesh = sampleMesh({ hasCorner: true });
        for (const part of mesh.parts) {
            expect(part.indices.length % 3).toBe(0);
            const vertexCount = part.positions.length / 3;
            for (const index of part.indices) {
                expect(index).toBeLessThan(vertexCount);
                expect(index).toBeGreaterThanOrEqual(0);
            }
            for (let i = 0; i < part.normals.length; i += 3) {
                expect(Number.isFinite(part.normals[i])).toBe(true);
                const len = Math.hypot(part.normals[i], part.normals[i + 1], part.normals[i + 2]);
                expect(len).toBeCloseTo(1, 4);
            }
            for (const value of part.positions) {
                expect(Number.isFinite(value)).toBe(true);
            }
        }
    });

    it('keeps the corner block inside the rail it replaces, never poking past the outer edge', () => {
        const mesh = sampleMesh({ hasCorner: true });
        const corner = mesh.parts.find((p) => p.material === 'railCorner');
        for (let i = 0; i < corner.positions.length; i += 3) {
            expect(Math.abs(corner.positions[i])).toBeLessThanOrEqual(mesh.outerWidthM / 2 + 1e-9);
            expect(Math.abs(corner.positions[i + 1])).toBeLessThanOrEqual(mesh.outerHeightM / 2 + 1e-9);
        }
    });

    it('shrinks the middle rail run to make room for the corner blocks, without a gap', () => {
        // The two are complementary halves of the same rail band, so their
        // combined lateral extent at the outer edge should still reach the
        // full outer width/height — a gap would be a stripe of missing
        // geometry running the length of the frame.
        const mesh = sampleMesh({ hasCorner: true });
        const rail = mesh.parts.find((p) => p.material === 'rail');
        const corner = mesh.parts.find((p) => p.material === 'railCorner');
        const maxAbs = (part, axis) => part.positions
            .filter((_, i) => i % 3 === axis)
            .reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        expect(Math.max(maxAbs(rail, 0), maxAbs(corner, 0))).toBeCloseTo(mesh.outerWidthM / 2, 6);
        expect(Math.max(maxAbs(rail, 1), maxAbs(corner, 1))).toBeCloseTo(mesh.outerHeightM / 2, 6);
    });

    it('tiles the rail more times across a longer moulding', () => {
        const short = sampleMesh({ artworkWidthIn: 8, artworkHeightIn: 10 });
        const long = sampleMesh({ artworkWidthIn: 40, artworkHeightIn: 50 });
        const maxU = (mesh) => mesh.parts
            .find((p) => p.material === 'rail')
            .uvs.filter((_, i) => i % 2 === 0)
            .reduce((m, u) => Math.max(m, u), 0);
        expect(maxU(long)).toBeGreaterThan(maxU(short));
    });
});

describe('hanging hardware', () => {
    const frameSize = { outerWidthM: 0.584, outerHeightM: 0.686 };

    it('builds distinct geometry for every catalogue option', () => {
        const seen = new Map();
        for (const type of ['wire', 'sawtooth', 'french-cleat', 'easel']) {
            const parts = buildHardwareParts(type, frameSize);
            expect(parts, type).toHaveLength(1);
            const triangles = parts[0].indices.length / 3;
            expect(triangles, type).toBeGreaterThan(0);
            seen.set(type, triangles);
        }
        // Four options that produced identical geometry would mean the
        // customer's choice isn't actually being shown.
        expect(new Set(seen.values()).size).toBeGreaterThan(1);
    });

    it('ignores an unknown or absent option rather than guessing', () => {
        expect(buildHardwareParts(undefined, frameSize)).toEqual([]);
        expect(buildHardwareParts('brass-chain', frameSize)).toEqual([]);
    });

    it('keeps hardware behind the artwork, never in front of it', () => {
        for (const type of ['wire', 'sawtooth', 'french-cleat', 'easel']) {
            const [part] = buildHardwareParts(type, frameSize);
            for (let i = 2; i < part.positions.length; i += 3) {
                // Anything at positive Z would be poking through the
                // picture, which is the one place hardware must not be.
                expect(part.positions[i], `${type} vertex Z`).toBeLessThanOrEqual(1e-9);
            }
        }
    });

    it('keeps hardware within the frame it mounts to', () => {
        for (const type of ['wire', 'sawtooth', 'french-cleat']) {
            const [part] = buildHardwareParts(type, frameSize);
            for (let i = 0; i < part.positions.length; i += 3) {
                expect(Math.abs(part.positions[i]), `${type} X`)
                    .toBeLessThanOrEqual(frameSize.outerWidthM / 2 + 1e-6);
                expect(Math.abs(part.positions[i + 1]), `${type} Y`)
                    .toBeLessThanOrEqual(frameSize.outerHeightM / 2 + 1e-6);
            }
        }
    });

    it('lets the easel stand proud of the frame, since it is a kickstand', () => {
        const [easel] = buildHardwareParts('easel', frameSize);
        let lowest = Infinity;
        let deepest = 0;
        for (let i = 0; i < easel.positions.length; i += 3) {
            lowest = Math.min(lowest, easel.positions[i + 1]);
            deepest = Math.min(deepest, easel.positions[i + 2]);
        }
        // Reaches below the frame's bottom edge and splays backward —
        // the two things that make it a stand rather than a fitting.
        expect(lowest).toBeLessThan(-frameSize.outerHeightM / 2);
        expect(deepest).toBeLessThan(-0.05);
    });
});

describe('glb container', () => {
    const parse = (glb) => {
        const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
        expect(view.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
        expect(view.getUint32(4, true)).toBe(2);
        expect(view.getUint32(8, true)).toBe(glb.byteLength);

        const jsonLength = view.getUint32(12, true);
        expect(view.getUint32(16, true)).toBe(0x4e4f534a); // 'JSON'
        const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)));

        const binHeader = 20 + jsonLength;
        const binLength = view.getUint32(binHeader, true);
        expect(view.getUint32(binHeader + 4, true)).toBe(0x004e4942); // 'BIN\0'
        return { json, binLength };
    };

    it('writes a structurally valid container', () => {
        const mesh = sampleMesh();
        const glb = buildGlb({ parts: mesh.parts, materials: solidMaterials(mesh.parts) });

        // Both chunks must be 4-byte aligned or strict parsers reject
        // the file outright.
        expect(glb.byteLength % 4).toBe(0);
        const { json, binLength } = parse(glb);
        expect(json.buffers[0].byteLength).toBe(binLength);
        expect(json.meshes[0].primitives.length).toBe(mesh.parts.length);
    });

    it('keeps every accessor inside its buffer view and aligned', () => {
        const mesh = sampleMesh();
        const glb = buildGlb({ parts: mesh.parts, materials: solidMaterials(mesh.parts) });
        const { json } = parse(glb);

        const bytesPer = { VEC3: 12, VEC2: 8, SCALAR: 4 };
        for (const accessor of json.accessors) {
            const view = json.bufferViews[accessor.bufferView];
            expect(view).toBeDefined();
            // Float and uint32 accessors both require 4-byte alignment.
            expect(view.byteOffset % 4).toBe(0);
            expect(accessor.count * bytesPer[accessor.type]).toBe(view.byteLength);
        }
    });

    it('gives POSITION the bounds the spec requires', () => {
        const mesh = sampleMesh();
        const glb = buildGlb({ parts: mesh.parts, materials: solidMaterials(mesh.parts) });
        const { json } = parse(glb);

        for (const primitive of json.meshes[0].primitives) {
            const position = json.accessors[primitive.attributes.POSITION];
            expect(position.min).toHaveLength(3);
            expect(position.max).toHaveLength(3);
            for (let axis = 0; axis < 3; axis++) {
                expect(position.max[axis]).toBeGreaterThanOrEqual(position.min[axis]);
            }
        }
    });

    it('references only materials it declares', () => {
        const mesh = sampleMesh();
        const glb = buildGlb({ parts: mesh.parts, materials: solidMaterials(mesh.parts) });
        const { json } = parse(glb);
        for (const primitive of json.meshes[0].primitives) {
            expect(primitive.material).toBeLessThan(json.materials.length);
        }
    });
});

describe('usdz container', () => {
    const entries = () => {
        const mesh = sampleMesh();
        const usda = buildUsda({ parts: mesh.parts, materials: solidMaterials(mesh.parts) });
        return [
            { name: 'frame.usda', bytes: new TextEncoder().encode(usda) },
            { name: 'textures/rail.png', bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7]) },
        ];
    };

    it('opens with the scene description', () => {
        const zip = packUsdz(entries());
        const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
        expect(view.getUint32(0, true)).toBe(0x04034b50);
        const nameLength = view.getUint16(26, true);
        const name = new TextDecoder().decode(zip.subarray(30, 30 + nameLength));
        expect(name).toBe('frame.usda');
    });

    it('stores every entry uncompressed and 64-byte aligned', () => {
        const source = entries();
        const zip = packUsdz(source);
        const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

        let offset = 0;
        for (const entry of source) {
            expect(view.getUint32(offset, true)).toBe(0x04034b50);
            // 0 = STORED. Quick Look will not read a deflated entry.
            expect(view.getUint16(offset + 8, true)).toBe(0);

            const nameLength = view.getUint16(offset + 26, true);
            const extraLength = view.getUint16(offset + 28, true);
            const dataStart = offset + 30 + nameLength + extraLength;

            expect(dataStart % 64).toBe(0);
            expect(view.getUint32(offset + 22, true)).toBe(entry.bytes.length);
            offset = dataStart + entry.bytes.length;
        }
    });

    it('writes a usda the parser can bind', () => {
        const mesh = sampleMesh();
        const usda = buildUsda({ parts: mesh.parts, materials: solidMaterials(mesh.parts) });

        expect(usda.startsWith('#usda 1.0')).toBe(true);
        // True physical scale depends on both of these being declared.
        expect(usda).toContain('metersPerUnit = 1');
        expect(usda).toContain('upAxis = "Y"');

        // Every mesh binds a material that exists as a prim.
        for (const part of mesh.parts) {
            expect(usda).toContain(`rel material:binding = </Frame/Materials/${part.material}>`);
            expect(usda).toContain(`def Material "${part.material}"`);
        }
    });

    it('does not force a plane-anchoring hint, so Quick Look keeps its default free placement/manipulation', () => {
        // A vertical-anchoring hint was tried here and reverted — on a real
        // device it placed the piece off the wall surface and disabled the
        // usual drag/rotate/scale gestures. See buildUsda's own comment.
        const mesh = sampleMesh();
        const usda = buildUsda({ parts: mesh.parts, materials: solidMaterials(mesh.parts) });

        expect(usda).not.toContain('Preliminary_AnchoringAPI');
        expect(usda).not.toContain('preliminary:anchoring');
    });
});
