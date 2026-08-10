// Hand-written, dependency-free USDZ writer for the same simple shape the
// GLB builder produces (see glbBoxBuilder.js) — a real-world-scaled box
// with the framed artwork on its front face — because Safari's AR Quick
// Look only accepts USDZ, never glTF/GLB, so Android/WebXR's GLB can't be
// reused for iOS.
//
// A USDZ is two independent problems stacked on each other, solved
// separately below:
//   1. A valid minimal USD scene description in the plain-text .usda
//      form (авespecially readable/debuggable, and just as valid a USDZ
//      payload as the binary .usdc form) — two meshes (front face,
//      five-sided box) each bound to their own UsdPreviewSurface material,
//      the standard minimal material network every USD-consuming
//      renderer, including Quick Look, knows how to shade.
//   2. Apple's packaging rule on top of plain ZIP: STORE only (no
//      DEFLATE), and every entry's DATA must start at a 64-byte-aligned
//      offset from the start of the file, because Quick Look mmaps assets
//      directly out of the archive rather than decompressing them —
//      implemented here via the ZIP extra-field padding trick (a normal,
//      spec-legal but unrecognized extra-field record, sized so the
//      following data lands on the boundary).

function buildFrameRingMeshUsd({ widthM, heightM, depthM, railWidthM, openingInsetM = 0.004 }) {
    const hx = widthM / 2;
    const hy = heightM / 2;
    const hz = depthM / 2;
    const rail = Math.min(Math.max(railWidthM || Math.min(widthM, heightM) * 0.08, 0.001), Math.min(widthM, heightM) * 0.45);
    const innerHx = Math.max(0.001, hx - rail);
    const innerHy = Math.max(0.001, hy - rail);
    const repeatsFor = (meters) => Math.max(0.25, meters / MOULDING_TILE_METERS);
    const front = {
        points: [], faceVertexCounts: [], faceVertexIndices: [], normals: [], uvs: [],
    };
    const moulding = {
        points: [], faceVertexCounts: [], faceVertexIndices: [], normals: [], uvs: [],
    };
    const addFace = (target, corners, normal, faceUvs) => {
        const base = target.points.length;
        target.points.push(...corners);
        target.faceVertexCounts.push(4);
        target.faceVertexIndices.push(base, base + 1, base + 2, base + 3);
        target.normals.push(normal, normal, normal, normal);
        target.uvs.push(...faceUvs);
    };
    const sideNormal = (a, b) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const length = Math.hypot(dx, dy) || 1;
        return [dy / length, -dx / length, 0];
    };
    const addRail = (points) => {
        const frontFace = points.map(([x, y]) => [x, y, hz]);
        const backFace = points.map(([x, y]) => [x, y, -hz]);
        const perimeter = points.reduce((sum, point, index) => {
            const next = points[(index + 1) % points.length];
            return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
        }, 0);
        addFace(moulding, frontFace, [0, 0, 1], [[0, 0], [repeatsFor(perimeter / 4), 0], [repeatsFor(perimeter / 4), 1], [0, 1]]);
        addFace(moulding, [...backFace].reverse(), [0, 0, -1], [[0, 0], [repeatsFor(perimeter / 4), 0], [repeatsFor(perimeter / 4), 1], [0, 1]]);
        for (let index = 0; index < 4; index += 1) {
            const next = (index + 1) % 4;
            const edge = Math.hypot(points[next][0] - points[index][0], points[next][1] - points[index][1]);
            addFace(moulding, [frontFace[index], frontFace[next], backFace[next], backFace[index]], sideNormal(points[index], points[next]), [[0, 0], [repeatsFor(edge), 0], [repeatsFor(edge), repeatsFor(depthM)], [0, repeatsFor(depthM)]]);
        }
    };
    addRail([[-hx, hy], [-innerHx, innerHy], [innerHx, innerHy], [hx, hy]]);
    addRail([[-hx, -hy], [hx, -hy], [innerHx, -innerHy], [-innerHx, -innerHy]]);
    addRail([[-hx, -hy], [-innerHx, -innerHy], [-innerHx, innerHy], [-hx, hy]]);
    addRail([[innerHx, -innerHy], [hx, -hy], [hx, hy], [innerHx, innerHy]]);
    const openingZ = hz - Math.min(Math.max(openingInsetM, 0.001), depthM * 0.75);
    addFace(front,
        [[-innerHx, -innerHy, openingZ], [innerHx, -innerHy, openingZ], [innerHx, innerHy, openingZ], [-innerHx, innerHy, openingZ]],
        [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]],
    );
    return { front, box: moulding };
}

function buildBoxMeshUsd({ widthM, heightM, depthM }) {
    const hx = widthM / 2;
    const hy = heightM / 2;
    const hz = depthM / 2;

    // Front face: its own single-quad mesh so it can carry the artwork
    // material independently of the box. UV origin bottom-left, matching
    // the texture orientation the compositor draws (top of the artwork at
    // v=1), consistent with the GLB builder's own front-face UVs.
    const front = {
        points: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]],
        normal: [0, 0, 1],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        faceVertexCounts: [4],
        faceVertexIndices: [0, 1, 2, 3],
    };

    // uRepeat/vRepeat scale a face's UVs so a repeating moulding texture
    // tiles at roughly the same physical frequency regardless of which
    // face (and which physical dimension) it's mapped onto — mirrors the
    // GLB builder's own per-face UV scaling exactly, so both platforms
    // show the same tile frequency.
    const repeatsFor = (meters) => Math.max(0.25, meters / MOULDING_TILE_METERS);

    // The other five faces as one open (front-less) box, sharing one
    // material — same face/winding layout as the GLB builder, and each
    // face's own UV extent scaled to its physical size for a real material
    // texture (falls back to a flat frame-colour material when no
    // moulding photo is available; see buildFrameUsda).
    const boxFaces = [
        { corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], normal: [0, 0, -1], uv: [repeatsFor(widthM), repeatsFor(heightM)] }, // back
        { corners: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], normal: [1, 0, 0], uv: [repeatsFor(depthM), repeatsFor(heightM)] },      // right
        { corners: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], normal: [-1, 0, 0], uv: [repeatsFor(depthM), repeatsFor(heightM)] }, // left
        { corners: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], normal: [0, 1, 0], uv: [repeatsFor(widthM), repeatsFor(depthM)] },      // top
        { corners: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], normal: [0, -1, 0], uv: [repeatsFor(widthM), repeatsFor(depthM)] }, // bottom
    ];
    const box = { points: [], faceVertexCounts: [], faceVertexIndices: [], normals: [], uvs: [] };
    boxFaces.forEach((face, faceIdx) => {
        box.points.push(...face.corners);
        box.faceVertexCounts.push(4);
        const [uRepeat, vRepeat] = face.uv;
        const cornerUvs = [[0, 0], [uRepeat, 0], [uRepeat, vRepeat], [0, vRepeat]];
        for (let i = 0; i < 4; i++) {
            box.faceVertexIndices.push(faceIdx * 4 + i);
            box.normals.push(face.normal);
            box.uvs.push(cornerUvs[i]);
        }
    });

    return { front, box };
}

// A real moulding photo tiles once per this many metres of physical edge
// length — same reasoning and value as the GLB builder's constant of the
// same name, kept in sync so both platforms tile at the same frequency.
const MOULDING_TILE_METERS = 0.05;

const fmtNum = (n) => (Number.isInteger(n) ? n.toFixed(1) : n.toFixed(6));
const point3Arr = (pts) => `[${pts.map(([x, y, z]) => `(${fmtNum(x)}, ${fmtNum(y)}, ${fmtNum(z)})`).join(', ')}]`;
const float2Arr = (pts) => `[${pts.map(([u, v]) => `(${fmtNum(u)}, ${fmtNum(v)})`).join(', ')}]`;
const intArr = (arr) => `[${arr.join(', ')}]`;

/**
 * @param {object} options
 * @param {number} options.widthM
 * @param {number} options.heightM
 * @param {number} options.depthM
 * @param {string} options.frameColorHex - flat colour fallback for the box when no moulding photo is available
 * @param {string} options.textureFileName - relative path inside the archive, e.g. 'textures/front.png'
 * @param {string} [options.mouldingTextureFileName] - relative path to the real tiled moulding material; falls back to frameColorHex when omitted
 * @returns {string} a complete .usda text document
 */
export function buildFrameUsda({ widthM, heightM, depthM, railWidthM, openingInsetM, frameColorHex, textureFileName, mouldingTextureFileName }) {
    const { front, box } = buildFrameRingMeshUsd({ widthM, heightM, depthM, railWidthM, openingInsetM });
    const [r, g, b] = hexToRgbFloat(frameColorHex);

    // faceVarying normals/UVs need one entry per (face, corner) — flat
    // shading and per-face UV origin, same reasoning as the GLB builder's
    // 24-vertex (not 8-shared) layout.
    const frontNormals = Array.from({ length: front.faceVertexIndices.length }, () => front.normal);

    return `#usda 1.0
(
    defaultPrim = "Frame"
    upAxis = "Y"
    metersPerUnit = 1
)

def Xform "Frame" (
    kind = "component"
)
{
    def Mesh "FrontFace"
    {
        int[] faceVertexCounts = ${intArr(front.faceVertexCounts)}
        int[] faceVertexIndices = ${intArr(front.faceVertexIndices)}
        normal3f[] normals = ${point3Arr(frontNormals)} (
            interpolation = "faceVarying"
        )
        point3f[] points = ${point3Arr(front.points)}
        texCoord2f[] primvars:st = ${float2Arr(front.uvs)} (
            interpolation = "vertex"
        )
        uniform token subdivisionScheme = "none"
        rel material:binding = </Frame/Materials/FrontMaterial>
    }

    def Mesh "Box"
    {
        int[] faceVertexCounts = ${intArr(box.faceVertexCounts)}
        int[] faceVertexIndices = ${intArr(box.faceVertexIndices)}
        normal3f[] normals = ${point3Arr(box.normals)} (
            interpolation = "faceVarying"
        )
        point3f[] points = ${point3Arr(box.points)}
        texCoord2f[] primvars:st = ${float2Arr(box.uvs)} (
            interpolation = "faceVarying"
        )
        uniform token subdivisionScheme = "none"
        rel material:binding = </Frame/Materials/MouldingMaterial>
    }

    def Scope "Materials"
    {
        def Material "FrontMaterial"
        {
            token outputs:surface.connect = </Frame/Materials/FrontMaterial/PreviewSurface.outputs:surface>

            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = </Frame/Materials/FrontMaterial/DiffuseTexture.outputs:rgb>
                float inputs:roughness = 0.9
                float inputs:metallic = 0
                token outputs:surface
            }

            def Shader "DiffuseTexture"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @${textureFileName}@
                float2 inputs:st.connect = </Frame/Materials/FrontMaterial/stReader.outputs:result>
                token outputs:rgb
            }

            def Shader "stReader"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }
        }

        def Material "MouldingMaterial"
        {
            token outputs:surface.connect = </Frame/Materials/MouldingMaterial/PreviewSurface.outputs:surface>

            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
                ${mouldingTextureFileName
            ? 'color3f inputs:diffuseColor.connect = </Frame/Materials/MouldingMaterial/DiffuseTexture.outputs:rgb>'
            : `color3f inputs:diffuseColor = (${fmtNum(r)}, ${fmtNum(g)}, ${fmtNum(b)})`}
                float inputs:roughness = 0.8
                float inputs:metallic = 0
                token outputs:surface
            }
${mouldingTextureFileName ? `
            def Shader "DiffuseTexture"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @${mouldingTextureFileName}@
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float2 inputs:st.connect = </Frame/Materials/MouldingMaterial/stReader.outputs:result>
                token outputs:rgb
            }

            def Shader "stReader"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }
` : ''}        }
    }
}
`;
}

function hexToRgbFloat(hex) {
    const clean = (hex || '#8b4513').replace('#', '');
    return [
        parseInt(clean.slice(0, 2), 16) / 255,
        parseInt(clean.slice(2, 4), 16) / 255,
        parseInt(clean.slice(4, 6), 16) / 255,
    ];
}

// --- ZIP (STORE-only) with Apple's 64-byte data-alignment requirement ---

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
    // A fixed, valid DOS timestamp — the archive's contents are generated
    // fresh per request, so there's no meaningful "modified time" to record.
    return { time: 0, date: 0x21 }; // 1980-01-01
}

const ALIGNMENT = 64;

/**
 * @param {Array<{name: string, data: Uint8Array}>} files - first entry is treated as the root layer by convention
 * @returns {Uint8Array} a complete .usdz (ZIP, STORE-only, 64-byte-aligned) file
 */
export function buildUsdzArchive(files) {
    const chunks = [];
    const centralRecords = [];
    let offset = 0;
    const { time, date } = dosDateTime();

    for (const { name, data } of files) {
        const nameBytes = new TextEncoder().encode(name);
        const crc = crc32(data);

        // Local file header is fixed at 30 bytes + name + extra. Data starts
        // right after that. Pad the extra field so the data offset lands on
        // a 64-byte boundary, using a spec-legal "unknown extra field"
        // record (2-byte ID + 2-byte size + payload) rather than raw
        // padding a lenient-but-non-conforming reader might choke on.
        const fixedHeaderLen = 30 + nameBytes.length;
        const dataStartUnaligned = offset + fixedHeaderLen + 4; // +4 for the extra field's own ID+size header
        const aligned = Math.ceil(dataStartUnaligned / ALIGNMENT) * ALIGNMENT;
        const extraPaddingLen = aligned - dataStartUnaligned;
        const extraFieldLen = 4 + extraPaddingLen;

        const header = new Uint8Array(fixedHeaderLen + extraFieldLen);
        const hv = new DataView(header.buffer);
        hv.setUint32(0, 0x04034b50, true);   // local file header signature
        hv.setUint16(4, 20, true);           // version needed to extract
        hv.setUint16(6, 0, true);            // flags
        hv.setUint16(8, 0, true);            // compression = 0 (store)
        hv.setUint16(10, time, true);
        hv.setUint16(12, date, true);
        hv.setUint32(14, crc, true);
        hv.setUint32(18, data.length, true); // compressed size
        hv.setUint32(22, data.length, true); // uncompressed size
        hv.setUint16(26, nameBytes.length, true);
        hv.setUint16(28, extraFieldLen, true);
        header.set(nameBytes, 30);
        // Extra field: ID 0x1986 (unassigned/private-use range — any
        // conforming zip reader skips fields it doesn't recognize by ID,
        // using the declared size), then zero-filled padding of that size.
        const extraOffset = 30 + nameBytes.length;
        hv.setUint16(extraOffset, 0x1986, true);
        hv.setUint16(extraOffset + 2, extraPaddingLen, true);

        const localHeaderOffset = offset;
        chunks.push(header, data);
        offset += header.length + data.length;

        centralRecords.push({ name: nameBytes, crc, size: data.length, localHeaderOffset, time, date });
    }

    // Central directory
    const centralChunks = [];
    let centralSize = 0;
    for (const rec of centralRecords) {
        const cd = new Uint8Array(46 + rec.name.length);
        const cv = new DataView(cd.buffer);
        cv.setUint32(0, 0x02014b50, true);   // central directory header signature
        cv.setUint16(4, 20, true);           // version made by
        cv.setUint16(6, 20, true);           // version needed
        cv.setUint16(8, 0, true);            // flags
        cv.setUint16(10, 0, true);           // compression = 0
        cv.setUint16(12, rec.time, true);
        cv.setUint16(14, rec.date, true);
        cv.setUint32(16, rec.crc, true);
        cv.setUint32(20, rec.size, true);
        cv.setUint32(24, rec.size, true);
        cv.setUint16(28, rec.name.length, true);
        cv.setUint16(30, 0, true);           // extra field length (central dir copy can omit ours)
        cv.setUint16(32, 0, true);           // comment length
        cv.setUint16(34, 0, true);           // disk number start
        cv.setUint16(36, 0, true);           // internal attrs
        cv.setUint32(38, 0, true);           // external attrs
        cv.setUint32(42, rec.localHeaderOffset, true);
        cd.set(rec.name, 46);
        centralChunks.push(cd);
        centralSize += cd.length;
    }
    const centralOffset = offset;

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, centralRecords.length, true);
    ev.setUint16(10, centralRecords.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralOffset, true);
    ev.setUint16(20, 0, true);

    const all = [...chunks, ...centralChunks, eocd];
    const totalLen = all.reduce((sum, c) => sum + c.length, 0);
    const out = new Uint8Array(totalLen);
    let p = 0;
    for (const c of all) { out.set(c, p); p += c.length; }
    return out;
}
