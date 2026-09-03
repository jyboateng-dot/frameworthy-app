/**
 * Writes a binary glTF (.glb) — the model Android's Scene Viewer and
 * WebXR both consume.
 *
 * Hand-written rather than pulled from a library because the exporters
 * that produce GLB all expect to serialise a scene graph from their own
 * renderer, which would mean building the frame twice: once as the
 * plain vertex arrays frameMesh already produces, and again as that
 * library's object model purely to hand it back. The format's binary
 * container is a header and two length-prefixed chunks, so the whole
 * cost of skipping that is the packing below.
 *
 * Spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
 */

const MAGIC = 0x46546c67;       // 'glTF'
const CHUNK_JSON = 0x4e4f534a;  // 'JSON'
const CHUNK_BIN = 0x004e4942;   // 'BIN\0'

const FLOAT = 5126;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const align4 = (n) => (n + 3) & ~3;

/**
 * Accumulates binary blocks and hands back the bufferView index for
 * each. Every block is 4-byte aligned because accessors address into
 * the buffer by absolute offset, and a float accessor landing on an
 * unaligned offset is invalid glTF even when a given viewer happens to
 * tolerate it.
 */
class BinaryPacker {
    constructor() {
        this.blocks = [];
        this.views = [];
        this.length = 0;
    }

    add(bytes, target = null) {
        const padding = align4(this.length) - this.length;
        if (padding > 0) {
            this.blocks.push(new Uint8Array(padding));
            this.length += padding;
        }

        const offset = this.length;
        this.blocks.push(bytes);
        this.length += bytes.byteLength;

        const view = { buffer: 0, byteOffset: offset, byteLength: bytes.byteLength };
        if (target !== null) view.target = target;
        this.views.push(view);
        return this.views.length - 1;
    }

    concat() {
        const out = new Uint8Array(align4(this.length));
        let cursor = 0;
        for (const block of this.blocks) {
            out.set(block, cursor);
            cursor += block.byteLength;
        }
        return out;
    }
}

const asBytes = (typedArray) => new Uint8Array(
    typedArray.buffer,
    typedArray.byteOffset,
    typedArray.byteLength
);

function boundsOf(positions) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
            const v = positions[i + axis];
            if (v < min[axis]) min[axis] = v;
            if (v > max[axis]) max[axis] = v;
        }
    }
    return { min, max };
}

/**
 * @param {object} model
 * @param {Array} model.parts      mesh parts from buildFrameMesh
 * @param {object} model.materials keyed by the part's `material` name;
 *                                 each `{ texture?: Uint8Array, baseColor: [r,g,b,a],
 *                                 metallic: number, roughness: number }`
 * @returns {Uint8Array} complete .glb file
 */
export function buildGlb({ parts, materials }) {
    const packer = new BinaryPacker();
    const accessors = [];
    const images = [];
    const textures = [];
    const gltfMaterials = [];
    const materialIndex = new Map();
    let hasUnlitMaterial = false;

    const packTexture = (bytes) => {
        const viewIndex = packer.add(bytes);
        images.push({ bufferView: viewIndex, mimeType: 'image/png' });
        textures.push({ source: images.length - 1, sampler: 0 });
        return textures.length - 1;
    };

    const pushAccessor = (accessor) => {
        accessors.push(accessor);
        return accessors.length - 1;
    };

    // Materials first: their textures share the same buffer as the
    // geometry, and packing them up front keeps every image block
    // contiguous rather than interleaved between vertex arrays.
    for (const [name, spec] of Object.entries(materials)) {
        const pbr = {
            baseColorFactor: spec.baseColor || [1, 1, 1, 1],
            metallicFactor: spec.metallic ?? 0,
            roughnessFactor: spec.roughness ?? 0.8,
        };

        if (spec.texture) {
            pbr.baseColorTexture = { index: packTexture(spec.texture) };
            // A texture supplies the colour; leaving a tint in the
            // factor would multiply against it and darken the
            // photography. Artwork can opt into a calibrated factor to
            // keep paper whites below clipping in bright AR probes.
            pbr.baseColorFactor = spec.textureFactor || [1, 1, 1, 1];
        }

        const material = {
            name,
            pbrMetallicRoughness: pbr,
            doubleSided: false,
        };
        if (spec.normalTexture) {
            material.normalTexture = {
                index: packTexture(spec.normalTexture),
                scale: spec.normalScale ?? 1,
            };
        }
        if (spec.unlit) {
            material.extensions = { KHR_materials_unlit: {} };
            hasUnlitMaterial = true;
        }
        gltfMaterials.push(material);
        materialIndex.set(name, gltfMaterials.length - 1);
    }

    const primitives = parts.map((part) => {
        const positions = new Float32Array(part.positions);
        const normals = new Float32Array(part.normals);
        const uvs = new Float32Array(part.uvs);
        const indices = new Uint32Array(part.indices);
        const { min, max } = boundsOf(positions);

        const positionView = packer.add(asBytes(positions), ARRAY_BUFFER);
        const normalView = packer.add(asBytes(normals), ARRAY_BUFFER);
        const uvView = packer.add(asBytes(uvs), ARRAY_BUFFER);
        const indexView = packer.add(asBytes(indices), ELEMENT_ARRAY_BUFFER);

        const attributes = {
            // POSITION is the one accessor the spec requires bounds on;
            // viewers use them for frustum culling and, in AR, for the
            // initial placement reticle's footprint.
            POSITION: pushAccessor({
                bufferView: positionView,
                componentType: FLOAT,
                count: positions.length / 3,
                type: 'VEC3',
                min,
                max,
            }),
            NORMAL: pushAccessor({
                bufferView: normalView,
                componentType: FLOAT,
                count: normals.length / 3,
                type: 'VEC3',
            }),
            TEXCOORD_0: pushAccessor({
                bufferView: uvView,
                componentType: FLOAT,
                count: uvs.length / 2,
                type: 'VEC2',
            }),
        };

        return {
            attributes,
            indices: pushAccessor({
                bufferView: indexView,
                componentType: UNSIGNED_INT,
                count: indices.length,
                type: 'SCALAR',
            }),
            material: materialIndex.get(part.material) ?? 0,
        };
    });

    const binary = packer.concat();

    const json = {
        asset: { version: '2.0', generator: 'FrameWorthy AR' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0, name: 'framed-piece' }],
        meshes: [{ name: 'framed-piece', primitives }],
        accessors,
        bufferViews: packer.views,
        buffers: [{ byteLength: binary.byteLength }],
        materials: gltfMaterials,
        // REPEAT on both axes is what lets the rail texture tile along a
        // moulding whose UVs run past 1.0 — the entire point of deriving
        // a repeat count from physical scale in frameMesh.
        samplers: [{ wrapS: 10497, wrapT: 10497 }],
    };
    if (images.length) {
        json.images = images;
        json.textures = textures;
    }
    if (hasUnlitMaterial) json.extensionsUsed = ['KHR_materials_unlit'];

    // JSON pads with spaces and BIN pads with zeroes; both are required
    // to be 4-byte aligned, and the padding byte for each is specified
    // rather than arbitrary.
    const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
    const jsonPadded = new Uint8Array(align4(jsonBytes.byteLength)).fill(0x20);
    jsonPadded.set(jsonBytes);

    const total = 12 + 8 + jsonPadded.byteLength + 8 + binary.byteLength;
    const glb = new ArrayBuffer(total);
    const view = new DataView(glb);
    const bytes = new Uint8Array(glb);

    view.setUint32(0, MAGIC, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);

    view.setUint32(12, jsonPadded.byteLength, true);
    view.setUint32(16, CHUNK_JSON, true);
    bytes.set(jsonPadded, 20);

    const binHeader = 20 + jsonPadded.byteLength;
    view.setUint32(binHeader, binary.byteLength, true);
    view.setUint32(binHeader + 4, CHUNK_BIN, true);
    bytes.set(binary, binHeader + 8);

    return bytes;
}
