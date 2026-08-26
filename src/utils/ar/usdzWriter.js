/**
 * Writes a .usdz — the model iOS AR Quick Look consumes.
 *
 * USDZ is a ZIP with two rules Apple enforces and most ZIP writers
 * break: every entry must be STORED (never deflated), and every entry's
 * *data* must begin on a 64-byte boundary so the runtime can memory-map
 * textures straight out of the archive. A general-purpose zip library
 * gives you neither by default, so the container is written here
 * alongside the scene it holds.
 *
 * The scene itself is USDA — USD's text form. The binary form (.usdc)
 * is more compact, but Quick Look reads both, and text is the one that
 * can be diffed and eyeballed when a frame comes out wrong.
 */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
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

const fmt = (n) => {
    // USD's parser wants a decimal point on floats; an integer-looking
    // value in a float array is a parse error rather than a coercion.
    const v = Number.isFinite(n) ? n : 0;
    return Number.isInteger(v) ? `${v}` : v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '.0');
};

const vec3List = (arr) => {
    const out = [];
    for (let i = 0; i < arr.length; i += 3) {
        out.push(`(${fmt(arr[i])}, ${fmt(arr[i + 1])}, ${fmt(arr[i + 2])})`);
    }
    return out.join(', ');
};

const vec2ListFlipped = (arr) => {
    const out = [];
    for (let i = 0; i < arr.length; i += 2) {
        // glTF puts UV origin at the image's top-left, USD at its
        // bottom-left. Without this flip every texture in the model
        // arrives upside down — including the rail's cross-profile,
        // which would silently put the moulding's outer edge against
        // the artwork.
        out.push(`(${fmt(arr[i])}, ${fmt(1 - arr[i + 1])})`);
    }
    return out.join(', ');
};

function meshBlock(part, index) {
    const triangleCount = part.indices.length / 3;
    const counts = new Array(triangleCount).fill(3).join(', ');
    const extentMin = [Infinity, Infinity, Infinity];
    const extentMax = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < part.positions.length; i += 3) {
        for (let a = 0; a < 3; a++) {
            const v = part.positions[i + a];
            if (v < extentMin[a]) extentMin[a] = v;
            if (v > extentMax[a]) extentMax[a] = v;
        }
    }

    return `
    def Mesh "mesh_${index}"
    {
        float3[] extent = [(${fmt(extentMin[0])}, ${fmt(extentMin[1])}, ${fmt(extentMin[2])}), (${fmt(extentMax[0])}, ${fmt(extentMax[1])}, ${fmt(extentMax[2])})]
        int[] faceVertexCounts = [${counts}]
        int[] faceVertexIndices = [${part.indices.join(', ')}]
        point3f[] points = [${vec3List(part.positions)}]
        normal3f[] normals = [${vec3List(part.normals)}] (
            interpolation = "vertex"
        )
        texCoord2f[] primvars:st = [${vec2ListFlipped(part.uvs)}] (
            interpolation = "vertex"
        )
        rel material:binding = </Frame/Materials/${part.material}>
        uniform token subdivisionScheme = "none"
    }`;
}

function materialBlock(name, spec) {
    const path = `/Frame/Materials/${name}`;
    const [r, g, b] = spec.baseColor || [1, 1, 1, 1];

    const diffuse = spec.texture
        ? `color3f inputs:diffuseColor.connect = <${path}/Texture.outputs:rgb>`
        : `color3f inputs:diffuseColor = (${fmt(r)}, ${fmt(g)}, ${fmt(b)})`;

    const textureShaders = spec.texture
        ? `
        def Shader "uvReader"
        {
            uniform token info:id = "UsdPrimvarReader_float2"
            token inputs:varname = "st"
            float2 outputs:result
        }

        def Shader "Texture"
        {
            uniform token info:id = "UsdUVTexture"
            asset inputs:file = @textures/${name}.png@
            float2 inputs:st.connect = <${path}/uvReader.outputs:result>
            token inputs:wrapS = "repeat"
            token inputs:wrapT = "repeat"
            float3 outputs:rgb
        }`
        : '';

    return `
    def Material "${name}"
    {
        token outputs:surface.connect = <${path}/Shader.outputs:surface>

        def Shader "Shader"
        {
            uniform token info:id = "UsdPreviewSurface"
            ${diffuse}
            float inputs:metallic = ${fmt(spec.metallic ?? 0)}
            float inputs:roughness = ${fmt(spec.roughness ?? 0.8)}
            float inputs:opacity = 1
            token outputs:surface
        }${textureShaders}
    }`;
}

export function buildUsda({ parts, materials }) {
    const meshes = parts.map((part, i) => meshBlock(part, i)).join('\n');
    const mats = Object.entries(materials)
        .map(([name, spec]) => materialBlock(name, spec))
        .join('\n');

    // metersPerUnit = 1 with geometry already in metres is what makes
    // Quick Look place the piece at true size. upAxis Y matches the
    // mesh, which is built standing up in XY with Z out of the wall.
    return `#usda 1.0
(
    defaultPrim = "Frame"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Frame" (
    kind = "component"
    prepend apiSchemas = ["Preliminary_AnchoringAPI"]
)
{
    // Without this hint Quick Look falls back to its own shape heuristic
    // for floor vs. wall placement, which reads a frame as floor-able
    // furniture often enough to be the actual bug behind "AR doesn't
    // place on the wall" — a framed piece is never meant to stand on
    // the floor, so this is asserted rather than guessed at.
    uniform token preliminary:anchoring:type = "plane"
    uniform token preliminary:planeAnchoring:alignment = "vertical"

${meshes}

    def Scope "Materials"
    {
${mats}
    }
}
`;
}

/**
 * Packs entries into a USDZ archive.
 *
 * @param {Array<{name: string, bytes: Uint8Array}>} entries
 *        The .usda must come first — Quick Look treats the archive's
 *        first entry as the scene to open.
 */
export function packUsdz(entries) {
    const ALIGNMENT = 64;
    const localParts = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = new TextEncoder().encode(entry.name);
        const headerSize = 30 + nameBytes.length;

        // Pad via the extra field so the DATA lands on the boundary,
        // not the header. The extra field is the only slack the format
        // gives us here, and it has to absorb whatever the filename
        // length happens to leave over.
        let extraLen = (ALIGNMENT - ((offset + headerSize) % ALIGNMENT)) % ALIGNMENT;
        // An extra field carries its own 4-byte id/size preamble, so
        // anything shorter than that can't be expressed — borrow a full
        // extra block instead of trying to squeeze into the remainder.
        if (extraLen > 0 && extraLen < 4) extraLen += ALIGNMENT;

        const header = new Uint8Array(headerSize + extraLen);
        const view = new DataView(header.buffer);
        const crc = crc32(entry.bytes);

        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);          // version needed
        view.setUint16(6, 0, true);           // flags
        view.setUint16(8, 0, true);           // STORED
        view.setUint16(10, 0, true);          // mod time
        view.setUint16(12, 0, true);          // mod date
        view.setUint32(14, crc, true);
        view.setUint32(18, entry.bytes.length, true);
        view.setUint32(22, entry.bytes.length, true);
        view.setUint16(26, nameBytes.length, true);
        view.setUint16(28, extraLen, true);
        header.set(nameBytes, 30);

        if (extraLen >= 4) {
            // 0x0000 is an unused/padding header id; the length field
            // covers the remaining filler bytes, which stay zero.
            view.setUint16(headerSize, 0x0000, true);
            view.setUint16(headerSize + 2, extraLen - 4, true);
        }

        localParts.push(header, entry.bytes);

        const centralEntry = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(centralEntry.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);            // version made by
        cv.setUint16(6, 20, true);            // version needed
        cv.setUint16(8, 0, true);
        cv.setUint16(10, 0, true);            // STORED
        cv.setUint16(12, 0, true);
        cv.setUint16(14, 0, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, entry.bytes.length, true);
        cv.setUint32(24, entry.bytes.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);            // extra length
        cv.setUint16(32, 0, true);            // comment length
        cv.setUint16(34, 0, true);            // disk number
        cv.setUint16(36, 0, true);            // internal attrs
        cv.setUint32(38, 0, true);            // external attrs
        cv.setUint32(42, offset, true);       // local header offset
        centralEntry.set(nameBytes, 46);
        central.push(centralEntry);

        offset += header.length + entry.bytes.length;
    }

    const centralSize = central.reduce((sum, c) => sum + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const total = offset + centralSize + end.length;
    const out = new Uint8Array(total);
    let cursor = 0;
    for (const block of [...localParts, ...central, end]) {
        out.set(block, cursor);
        cursor += block.length;
    }
    return out;
}
