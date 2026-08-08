const MAX_ARTWORK_BYTES = 5 * 1024 * 1024;
const ALLOWED_ARTWORK_HOSTS = new Set(['res.cloudinary.com', 'images.unsplash.com']);

const clamp = (value, min, max, field) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
        throw new Error(`Invalid ${field}`);
    }
    return number;
};

const normaliseHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// USDZ is a ZIP archive with stored entries whose payload begins on a 64-byte
// boundary. Keeping this tiny writer dependency-free makes it deployable in
// the existing Firebase Functions runtime.
function makeUsdz(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const { name, data } of entries) {
        const nameBuffer = Buffer.from(name);
        const payload = Buffer.from(data);
        const padding = (64 - ((offset + 30 + nameBuffer.length) % 64)) % 64;
        const extra = Buffer.alloc(padding);
        const checksum = crc32(payload);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(payload.length, 18);
        local.writeUInt32LE(payload.length, 22);
        local.writeUInt16LE(nameBuffer.length, 26);
        local.writeUInt16LE(extra.length, 28);
        localParts.push(local, nameBuffer, extra, payload);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(payload.length, 20);
        central.writeUInt32LE(payload.length, 24);
        central.writeUInt16LE(nameBuffer.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, nameBuffer);
        offset += local.length + nameBuffer.length + extra.length + payload.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...localParts, centralDirectory, end]);
}

function cube(name, width, height, depth, x, y, z, material) {
    return `\n    def Cube "${name}"\n    {\n        double size = 2\n        double3 xformOp:translate = (${x}, ${y}, ${z})\n        double3 xformOp:scale = (${width / 2}, ${height / 2}, ${depth / 2})\n        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]\n        rel material:binding = <${material}>\n    }`;
}

function makeScene(config, artworkName) {
    const openingWidth = config.openingWidthM;
    const openingHeight = config.openingHeightM;
    const face = config.frameFaceM;
    const depth = config.frameDepthM;
    const outerWidth = openingWidth + face * 2;
    const outerHeight = openingHeight + face * 2;
    const rails = [
        cube('Top', outerWidth, face, depth, 0, (openingHeight + face) / 2, 0, '/FrameMaterial'),
        cube('Bottom', outerWidth, face, depth, 0, -(openingHeight + face) / 2, 0, '/FrameMaterial'),
        cube('Left', face, openingHeight, depth, -(openingWidth + face) / 2, 0, 0, '/FrameMaterial'),
        cube('Right', face, openingHeight, depth, (openingWidth + face) / 2, 0, 0, '/FrameMaterial'),
        cube('Artwork', openingWidth, openingHeight, 0.006, 0, 0, depth / 2 + 0.004, '/ArtworkMaterial'),
    ].join('');

    return `#usda 1.0
(
    defaultPrim = "FrameWorthyFrame"
    metersPerUnit = 1
    upAxis = "Y"
)

def Material "FrameMaterial"
{
    token outputs:surface.connect = </FrameMaterial/Surface.outputs:surface>
    def Shader "Surface"
    {
        uniform token info:id = "UsdPreviewSurface"
        color3f inputs:diffuseColor = (${config.frameColor})
        float inputs:roughness = 0.42
        float inputs:metallic = ${config.isMetallic ? '0.45' : '0.0'}
        token outputs:surface
    }
}

def Material "ArtworkMaterial"
{
    token outputs:surface.connect = </ArtworkMaterial/Surface.outputs:surface>
    def Shader "Primvar"
    {
        uniform token info:id = "UsdPrimvarReader_float2"
        token inputs:varname = "st"
        float2 outputs:result
    }
    def Shader "ArtworkTexture"
    {
        uniform token info:id = "UsdUVTexture"
        asset inputs:file = @${artworkName}@
        token inputs:sourceColorSpace = "sRGB"
        float2 inputs:st.connect = </ArtworkMaterial/Primvar.outputs:result>
        float3 outputs:rgb
    }
    def Shader "Surface"
    {
        uniform token info:id = "UsdPreviewSurface"
        color3f inputs:diffuseColor.connect = </ArtworkMaterial/ArtworkTexture.outputs:rgb>
        float inputs:roughness = 0.7
        token outputs:surface
    }
}

def Xform "FrameWorthyFrame"
{${rails}
}
`;
}

function parsePreviewConfig(encoded) {
    if (typeof encoded !== 'string' || encoded.length > 4096) throw new Error('Invalid preview request');
    let data;
    try {
        data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
        throw new Error('Invalid preview request');
    }
    const artworkUrl = new URL(data.artworkUrl);
    if (artworkUrl.protocol !== 'https:' || !ALLOWED_ARTWORK_HOSTS.has(artworkUrl.hostname)) {
        throw new Error('Artwork source is not supported for AR preview');
    }
    const frameHex = normaliseHex(data.frameColor, '#342e2b');
    return {
        artworkUrl: artworkUrl.toString(),
        openingWidthM: clamp(data.openingWidthM, 0.1, 2.5, 'opening width'),
        openingHeightM: clamp(data.openingHeightM, 0.1, 2.5, 'opening height'),
        frameFaceM: clamp(data.frameFaceM, 0.015, 0.12, 'frame face'),
        frameDepthM: clamp(data.frameDepthM, 0.012, 0.12, 'frame depth'),
        frameColor: [
            parseInt(frameHex.slice(1, 3), 16) / 255,
            parseInt(frameHex.slice(3, 5), 16) / 255,
            parseInt(frameHex.slice(5, 7), 16) / 255,
        ].map((channel) => channel.toFixed(4)).join(', '),
        isMetallic: Boolean(data.isMetallic),
    };
}

async function fetchArtwork(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error('Could not load artwork for AR preview');
    const contentType = response.headers.get('content-type')?.split(';')[0]?.toLowerCase();
    if (!['image/jpeg', 'image/png'].includes(contentType)) throw new Error('Artwork format is not supported for AR preview');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_ARTWORK_BYTES) throw new Error('Artwork is too large for AR preview');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_ARTWORK_BYTES) throw new Error('Artwork is too large for AR preview');
    return { bytes, extension: contentType === 'image/png' ? 'png' : 'jpg' };
}

async function buildArPreviewUsdz(encoded) {
    const config = parsePreviewConfig(encoded);
    const artwork = await fetchArtwork(config.artworkUrl);
    const artworkName = `artwork.${artwork.extension}`;
    const scene = makeScene(config, artworkName);
    return makeUsdz([
        { name: 'frameworthy.usda', data: Buffer.from(scene, 'utf8') },
        { name: artworkName, data: artwork.bytes },
    ]);
}

// Scene Viewer accepts GLB, so Android can use the very same configuration
// and artwork that iPhone/iPad receive as USDZ. The model intentionally uses
// only core glTF 2.0 features (PBR materials, a texture, cubes) for the widest
// compatibility with ARCore and Android browsers.
function pad4(buffer, byte = 0x20) {
    const padding = (4 - (buffer.length % 4)) % 4;
    return padding ? Buffer.concat([buffer, Buffer.alloc(padding, byte)]) : buffer;
}

function makeGlb(config, artwork) {
    const positions = new Float32Array([
        -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
    ]);
    const normals = new Float32Array([
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
    const indices = new Uint16Array([
        0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6, 4, 0, 3, 4, 3, 7,
        1, 5, 6, 1, 6, 2, 3, 2, 6, 3, 6, 7, 4, 5, 1, 4, 1, 0,
    ]);
    const parts = [];
    let offset = 0;
    const append = (data) => {
        const padded = pad4(Buffer.from(data), 0);
        const view = { buffer: 0, byteOffset: offset, byteLength: data.byteLength || data.length };
        parts.push(padded);
        offset += padded.length;
        return view;
    };
    const positionView = append(Buffer.from(positions.buffer));
    const normalView = append(Buffer.from(normals.buffer));
    const uvView = append(Buffer.from(uvs.buffer));
    const indexView = append(Buffer.from(indices.buffer));
    const imageView = append(artwork.bytes);
    const openingWidth = config.openingWidthM;
    const openingHeight = config.openingHeightM;
    const face = config.frameFaceM;
    const depth = config.frameDepthM;
    const outerWidth = openingWidth + face * 2;
    const outerHeight = openingHeight + face * 2;
    const cubeNode = (name, scale, translation, material) => ({ name, mesh: material === 0 ? 0 : 1, scale, translation });
    const nodes = [
        cubeNode('Top rail', [outerWidth / 2, face / 2, depth / 2], [0, (openingHeight + face) / 2, 0], 0),
        cubeNode('Bottom rail', [outerWidth / 2, face / 2, depth / 2], [0, -(openingHeight + face) / 2, 0], 0),
        cubeNode('Left rail', [face / 2, openingHeight / 2, depth / 2], [-(openingWidth + face) / 2, 0, 0], 0),
        cubeNode('Right rail', [face / 2, openingHeight / 2, depth / 2], [(openingWidth + face) / 2, 0, 0], 0),
        cubeNode('Artwork', [openingWidth / 2, openingHeight / 2, 0.003], [0, 0, depth / 2 + 0.004], 1),
    ];
    const json = {
        asset: { version: '2.0', generator: 'FrameWorthy AR preview' },
        scene: 0,
        scenes: [{ nodes: nodes.map((_, index) => index) }],
        nodes,
        meshes: [
            { name: 'Frame rail', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] },
            { name: 'Artwork', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 1 }] },
        ],
        materials: [
            { name: 'Frame finish', pbrMetallicRoughness: { baseColorFactor: config.frameColor.split(', ').map(Number).concat(1), metallicFactor: config.isMetallic ? 0.45 : 0, roughnessFactor: 0.42 } },
            { name: 'Artwork', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.7 } },
        ],
        textures: [{ source: 0 }],
        images: [{ bufferView: 4, mimeType: artwork.extension === 'png' ? 'image/png' : 'image/jpeg' }],
        buffers: [{ byteLength: offset }],
        bufferViews: [positionView, normalView, uvView, { ...indexView, target: 34963 }, imageView],
        accessors: [
            { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-1, -1, -1], max: [1, 1, 1] },
            { bufferView: 1, componentType: 5126, count: 8, type: 'VEC3' },
            { bufferView: 2, componentType: 5126, count: 8, type: 'VEC2' },
            { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
        ],
    };
    const jsonChunk = pad4(Buffer.from(JSON.stringify(json), 'utf8'));
    const binaryChunk = Buffer.concat(parts);
    const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);
    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonChunk.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binaryChunk.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binaryChunk]);
}

async function buildArPreviewGlb(encoded) {
    const config = parsePreviewConfig(encoded);
    const artwork = await fetchArtwork(config.artworkUrl);
    return makeGlb(config, artwork);
}

module.exports = { buildArPreviewGlb, buildArPreviewUsdz, makeGlb, makeUsdz, parsePreviewConfig };
