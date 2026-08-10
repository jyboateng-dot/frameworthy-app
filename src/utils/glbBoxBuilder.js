// Hand-written, dependency-free glTF 2.0 binary (.glb) writer for exactly
// one shape: a real-world-scaled box with the framed artwork mapped onto
// its front face and a plain frame-colour material on the other five —
// everything an AR "see this frame on your wall" preview actually needs,
// with no 3D-authoring library pulled in for it.
//
// Box layout: width along +X, height along +Y, depth along +Z, front face
// (the one the customer sees, and the one that should face away from the
// wall once model-viewer's `ar-placement="wall"` orients it) at +Z.
//
// 24 vertices (4 per face, not a shared 8) because each face needs its own
// flat normal and its own UV origin — a shared-vertex cube can't do either.

// A real moulding photo tiles once per this many metres of physical edge
// length — chosen to read as a plausible repeat frequency for typical frame
// sizes (a few repeats across a side), not calibrated to any one frame's
// actual captured tile width, since the source photo carries no real-world
// scale reference at all.
const MOULDING_TILE_METERS = 0.05;

// The original solid-box builder is retained below as a useful reference for
// the binary writer. The exported builder now uses the open ring geometry
// declared here: four mitred rail prisms and a separate recessed artwork
// panel. That gives AR a real opening instead of a flat frame image painted
// onto a block.
function buildFrameRingGeometry({ widthM, heightM, depthM, railWidthM, openingInsetM = 0.004 }) {
    const hx = widthM / 2;
    const hy = heightM / 2;
    const hz = depthM / 2;
    const rail = Math.min(Math.max(railWidthM || Math.min(widthM, heightM) * 0.08, 0.001), Math.min(widthM, heightM) * 0.45);
    const innerHx = Math.max(0.001, hx - rail);
    const innerHy = Math.max(0.001, hy - rail);
    const uv = (uRepeat, vRepeat) => [[0, vRepeat], [uRepeat, vRepeat], [uRepeat, 0], [0, 0]];
    const repeatsFor = (meters) => Math.max(0.25, meters / MOULDING_TILE_METERS);
    const positions = [];
    const normals = [];
    const uvs = [];
    const indicesByMaterial = [[], []];

    const addFace = (corners, normal, faceUvs, materialIndex) => {
        const base = positions.length / 3;
        corners.forEach((corner, index) => {
            positions.push(...corner);
            normals.push(...normal);
            uvs.push(...faceUvs[index]);
        });
        indicesByMaterial[materialIndex].push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const sideNormal = (a, b) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const length = Math.hypot(dx, dy) || 1;
        return [dy / length, -dx / length, 0];
    };
    const addRail = (points) => {
        const front = points.map(([x, y]) => [x, y, hz]);
        const back = points.map(([x, y]) => [x, y, -hz]);
        const perimeter = points.reduce((sum, point, index) => {
            const next = points[(index + 1) % points.length];
            return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
        }, 0);
        addFace(front, [0, 0, 1], uv(repeatsFor(perimeter / 4), 1), 1);
        addFace([...back].reverse(), [0, 0, -1], uv(repeatsFor(perimeter / 4), 1), 1);
        for (let index = 0; index < 4; index += 1) {
            const next = (index + 1) % 4;
            const edge = Math.hypot(points[next][0] - points[index][0], points[next][1] - points[index][1]);
            addFace([front[index], front[next], back[next], back[index]], sideNormal(points[index], points[next]), uv(repeatsFor(edge), repeatsFor(depthM)), 1);
        }
    };

    // Each polygon has diagonal inner ends, creating real 45-degree mitre
    // seams at the front face rather than overlapping rectangular bars.
    addRail([[-hx, hy], [-innerHx, innerHy], [innerHx, innerHy], [hx, hy]]);
    addRail([[-hx, -hy], [hx, -hy], [innerHx, -innerHy], [-innerHx, -innerHy]]);
    addRail([[-hx, -hy], [-innerHx, -innerHy], [-innerHx, innerHy], [-hx, hy]]);
    addRail([[innerHx, -innerHy], [hx, -hy], [hx, hy], [innerHx, innerHy]]);

    const openingZ = hz - Math.min(Math.max(openingInsetM, 0.001), depthM * 0.75);
    addFace(
        [[-innerHx, -innerHy, openingZ], [innerHx, -innerHy, openingZ], [innerHx, innerHy, openingZ], [-innerHx, innerHy, openingZ]],
        [0, 0, 1], [[0, 1], [1, 1], [1, 0], [0, 0]], 0,
    );
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indicesByMaterial: indicesByMaterial.map(items => new Uint16Array(items)),
    };
}

function buildBoxGeometry({ widthM, heightM, depthM }) {
    const hx = widthM / 2;
    const hy = heightM / 2;
    const hz = depthM / 2;

    // uRepeat/vRepeat scale a face's UVs so a repeating moulding texture
    // tiles at roughly the same physical frequency regardless of which
    // face (and which physical dimension) it's mapped onto — a flat 0..1
    // square would either stretch a wide face's texture paper-thin or
    // squash a thin depth face's texture to nothing.
    const uv = (uRepeat, vRepeat) => [[0, vRepeat], [uRepeat, vRepeat], [uRepeat, 0], [0, 0]];
    const repeatsFor = (meters) => Math.max(0.25, meters / MOULDING_TILE_METERS);

    // Each face: 4 corners (counter-clockwise as seen from outside, for
    // correct winding/back-face culling), a constant outward normal, and
    // UVs — the front face's own composited texture right-side-up as seen
    // from +Z looking in the -Z direction (the direction a viewer standing
    // in front of the hung frame actually looks), and the other five faces
    // scaled to their own physical extent for a consistent tile frequency.
    const faces = [
        // +Z front (artwork face)
        { corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], normal: [0, 0, 1], uvs: [[0, 1], [1, 1], [1, 0], [0, 0]], materialIndex: 0 },
        // -Z back (width x height)
        { corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], normal: [0, 0, -1], uvs: uv(repeatsFor(widthM), repeatsFor(heightM)), materialIndex: 1 },
        // +X right (depth x height)
        { corners: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], normal: [1, 0, 0], uvs: uv(repeatsFor(depthM), repeatsFor(heightM)), materialIndex: 1 },
        // -X left (depth x height)
        { corners: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], normal: [-1, 0, 0], uvs: uv(repeatsFor(depthM), repeatsFor(heightM)), materialIndex: 1 },
        // +Y top (width x depth)
        { corners: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], normal: [0, 1, 0], uvs: uv(repeatsFor(widthM), repeatsFor(depthM)), materialIndex: 1 },
        // -Y bottom (width x depth)
        { corners: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], normal: [0, -1, 0], uvs: uv(repeatsFor(widthM), repeatsFor(depthM)), materialIndex: 1 },
    ];

    const positions = [];
    const normals = [];
    const uvs = [];
    // One index list per material, so the mesh can have 2 primitives
    // (front-textured vs. plain-colour) each with correct local indices.
    const indicesByMaterial = [[], []];

    for (const face of faces) {
        const baseIndex = positions.length / 3;
        for (let i = 0; i < 4; i++) {
            positions.push(...face.corners[i]);
            normals.push(...face.normal);
            uvs.push(...face.uvs[i]);
        }
        const idx = indicesByMaterial[face.materialIndex];
        idx.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indicesByMaterial: indicesByMaterial.map((arr) => new Uint16Array(arr)),
    };
}

function align4(n) {
    return (n + 3) & ~3;
}

function concatBuffers(buffers) {
    const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const b of buffers) {
        out.set(new Uint8Array(b.buffer || b, b.byteOffset || 0, b.byteLength), offset);
        offset += b.byteLength;
    }
    return out;
}

/**
 * @param {object} options
 * @param {number} options.widthM
 * @param {number} options.heightM
 * @param {number} options.depthM
 * @param {Uint8Array} options.frontTexturePng - the composited front-face PNG bytes
 * @param {string} options.frameColorHex - e.g. '#8b4513' — flat colour fallback for the other five faces when no moulding photo is available
 * @param {Uint8Array} [options.mouldingTexturePng] - real tiled moulding material for the other five faces; falls back to frameColorHex when omitted
 * @returns {Uint8Array} a complete, spec-valid .glb file
 */
export function buildFrameGlb({ widthM, heightM, depthM, railWidthM, openingInsetM, frontTexturePng, frameColorHex, mouldingTexturePng }) {
    const geo = buildFrameRingGeometry({ widthM, heightM, depthM, railWidthM, openingInsetM });

    const bounds = (arr, stride, dim) => {
        const min = new Array(dim).fill(Infinity);
        const max = new Array(dim).fill(-Infinity);
        for (let i = 0; i < arr.length; i += stride) {
            for (let d = 0; d < dim; d++) {
                min[d] = Math.min(min[d], arr[i + d]);
                max[d] = Math.max(max[d], arr[i + d]);
            }
        }
        return { min, max };
    };
    const posBounds = bounds(geo.positions, 3, 3);

    // --- Assemble the binary buffer: positions, normals, uvs, two index
    // lists, then the PNG — each section aligned to 4 bytes as glTF
    // bufferViews require for non-byte component types.
    const sections = [];
    let cursor = 0;
    const addSection = (data, componentAlign) => {
        const padStart = componentAlign ? Math.ceil(cursor / componentAlign) * componentAlign : cursor;
        const padding = padStart - cursor;
        if (padding > 0) sections.push(new Uint8Array(padding));
        cursor = padStart;
        const byteOffset = cursor;
        sections.push(data);
        cursor += data.byteLength;
        return byteOffset;
    };

    const positionsOffset = addSection(geo.positions, 4);
    const normalsOffset = addSection(geo.normals, 4);
    const uvsOffset = addSection(geo.uvs, 4);
    const indices0Offset = addSection(geo.indicesByMaterial[0], 2);
    const indices1Offset = addSection(geo.indicesByMaterial[1], 2);
    const frontImageOffset = addSection(frontTexturePng, 4);
    const mouldingImageOffset = mouldingTexturePng ? addSection(mouldingTexturePng, 4) : null;
    const binaryTotalLength = cursor;
    const binaryBuffer = concatBuffers(sections);

    const vertexCount = geo.positions.length / 3;

    const bufferViews = [
        { buffer: 0, byteOffset: positionsOffset, byteLength: geo.positions.byteLength, target: 34962 },
        { buffer: 0, byteOffset: normalsOffset, byteLength: geo.normals.byteLength, target: 34962 },
        { buffer: 0, byteOffset: uvsOffset, byteLength: geo.uvs.byteLength, target: 34962 },
        { buffer: 0, byteOffset: indices0Offset, byteLength: geo.indicesByMaterial[0].byteLength, target: 34963 },
        { buffer: 0, byteOffset: indices1Offset, byteLength: geo.indicesByMaterial[1].byteLength, target: 34963 },
        { buffer: 0, byteOffset: frontImageOffset, byteLength: frontTexturePng.byteLength },
    ];
    const textures = [{ source: 0, sampler: 0 }];
    const images = [{ bufferView: 5, mimeType: 'image/png' }];
    // Sampler 0 (front face) clamps: it's a single non-repeating composite.
    // Sampler 1 (moulding), when present, repeats: the UVs above were
    // scaled per-face specifically so a repeating wrap tiles at a
    // consistent physical frequency across differently-sized faces.
    const samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
    const mouldingMaterial = mouldingTexturePng
        ? { name: 'moulding', pbrMetallicRoughness: { baseColorTexture: { index: 1 }, metallicFactor: 0, roughnessFactor: 0.8 } }
        : { name: 'moulding', pbrMetallicRoughness: { baseColorFactor: hexToRgbaFloat(frameColorHex), metallicFactor: 0, roughnessFactor: 0.7 } };

    if (mouldingTexturePng) {
        bufferViews.push({ buffer: 0, byteOffset: mouldingImageOffset, byteLength: mouldingTexturePng.byteLength });
        images.push({ bufferView: 6, mimeType: 'image/png' });
        samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
        textures.push({ source: 1, sampler: 1 });
    }

    const gltf = {
        asset: { version: '2.0', generator: 'FrameWorthy AR preview builder' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{
            primitives: [
                {
                    attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
                    indices: 3,
                    material: 0,
                },
                {
                    attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
                    indices: 4,
                    material: 1,
                },
            ],
        }],
        materials: [
            {
                name: 'front',
                pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.9 },
            },
            mouldingMaterial,
        ],
        textures,
        images,
        samplers,
        buffers: [{ byteLength: binaryTotalLength }],
        bufferViews,
        accessors: [
            { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min: posBounds.min, max: posBounds.max },
            { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },
            { bufferView: 2, componentType: 5126, count: vertexCount, type: 'VEC2' },
            { bufferView: 3, componentType: 5123, count: geo.indicesByMaterial[0].length, type: 'SCALAR' },
            { bufferView: 4, componentType: 5123, count: geo.indicesByMaterial[1].length, type: 'SCALAR' },
        ],
    };

    const jsonString = JSON.stringify(gltf);
    const jsonBytes = new TextEncoder().encode(jsonString);
    const jsonPadded = align4(jsonBytes.length);
    const jsonChunk = new Uint8Array(jsonPadded);
    jsonChunk.set(jsonBytes);
    jsonChunk.fill(0x20, jsonBytes.length); // glTF spec: pad JSON chunk with spaces (0x20)

    const binPadded = align4(binaryBuffer.length);
    const binChunk = new Uint8Array(binPadded);
    binChunk.set(binaryBuffer);
    // Padding bytes for the BIN chunk are conventionally zero, which
    // Uint8Array already initializes to.

    const totalLength = 12 + (8 + jsonChunk.length) + (8 + binChunk.length);
    const out = new Uint8Array(totalLength);
    const view = new DataView(out.buffer);
    let o = 0;
    view.setUint32(o, 0x46546c67, true); o += 4; // magic 'glTF'
    view.setUint32(o, 2, true); o += 4;          // version
    view.setUint32(o, totalLength, true); o += 4;

    view.setUint32(o, jsonChunk.length, true); o += 4;
    view.setUint32(o, 0x4e4f534a, true); o += 4; // 'JSON'
    out.set(jsonChunk, o); o += jsonChunk.length;

    view.setUint32(o, binChunk.length, true); o += 4;
    view.setUint32(o, 0x004e4942, true); o += 4; // 'BIN\0'
    out.set(binChunk, o); o += binChunk.length;

    return out;
}

function hexToRgbaFloat(hex) {
    const clean = (hex || '#8b4513').replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return [r, g, b, 1];
}
