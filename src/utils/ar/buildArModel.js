import { getFrameRenderProfile } from '../frameRenderProfile';
import { buildFrameMesh } from './frameMesh';
import { buildHardwareParts } from './frameHardware';
import { buildGlb } from './glbWriter';
import { buildUsda, packUsdz } from './usdzWriter';
import { loadRailTexture, renderArtworkTexture, renderSolidTexture } from './arTextures';

/**
 * Builds the pair of models the AR viewer needs — .glb for Android and
 * WebXR, .usdz for iOS — from a live frame configuration.
 *
 * Both are produced from one mesh and one set of textures, so the two
 * platforms cannot drift apart: a change to the moulding profile or the
 * mat construction lands in both or neither.
 */

// Surface response per catalogue finish. Metallic mouldings need a real
// metallic factor or gilding reads as beige plastic under AR's
// environment lighting; matte wood needs the opposite or it reads as
// wet varnish.
const FINISH_SURFACE = {
    metallic: { metallic: 0.85, roughness: 0.32 },
    gloss: { metallic: 0.12, roughness: 0.16 },
    matte: { metallic: 0.0, roughness: 0.72 },
};

const hexToRgb = (hex) => {
    const clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return [1, 1, 1];
    const int = parseInt(clean, 16);
    if (!Number.isFinite(int)) return [1, 1, 1];
    // sRGB -> linear, because both glTF and USD take base colour in
    // linear space. Skipping it makes every mat noticeably paler than
    // the swatch the customer picked.
    return [
        ((int >> 16) & 255) / 255,
        ((int >> 8) & 255) / 255,
        (int & 255) / 255,
    ].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
};

// Rebuilding costs an image decode, a canvas composite, two PNG
// encodes, and two file writes — worth avoiding when a customer toggles
// AR off and straight back on, or flips between two sizes and returns.
// Six is enough to cover that kind of back-and-forth without holding
// many megabytes of blob alive.
const CACHE_LIMIT = 6;
const cache = new Map();

function releaseEntry(entry) {
    URL.revokeObjectURL(entry.glbUrl);
    URL.revokeObjectURL(entry.usdzUrl);
}

/**
 * Frees every cached model. Call when leaving the customizer — blob
 * URLs are owned by the document, so without this they outlive the
 * component that created them for as long as the tab is open.
 */
export function clearArModelCache() {
    for (const entry of cache.values()) releaseEntry(entry);
    cache.clear();
}

/**
 * @param {object} config
 * @param {object} config.frame       catalogue frame record
 * @param {number} config.widthIn     artwork width
 * @param {number} config.heightIn    artwork height
 * @param {number} config.matIn       mat reveal per side, 0 for none
 * @param {string} config.matColorHex
 * @param {string} config.artworkUrl
 * @returns {Promise<{glbUrl: string, usdzUrl: string, outerWidthM: number, outerHeightM: number, profile: string, isMeasured: boolean}>}
 */
export async function buildArModel({ frame, widthIn, heightIn, matIn, matColorHex, artworkUrl, hardwareType }) {
    const key = JSON.stringify([
        frame?.id, widthIn, heightIn, matIn, matColorHex, artworkUrl, hardwareType,
    ]);

    if (cache.has(key)) {
        // Re-inserting refreshes recency for the eviction order below.
        const hit = cache.get(key);
        cache.delete(key);
        cache.set(key, hit);
        return hit;
    }

    const renderProfile = getFrameRenderProfile(frame);
    const surface = FINISH_SURFACE[renderProfile.finish] || FINISH_SURFACE.matte;

    const [railTexture, artTexture] = await Promise.all([
        loadRailTexture(frame),
        renderArtworkTexture(artworkUrl, widthIn, heightIn),
    ]);

    const mesh = buildFrameMesh({
        artworkWidthIn: widthIn,
        artworkHeightIn: heightIn,
        mouldingWidthIn: renderProfile.mouldingWidthIn,
        rabbetDepthIn: renderProfile.rabbetDepthIn,
        profile: renderProfile.profile,
        matIn,
        // Falls back to a 4:1 strip when no rail photography resolved,
        // which only affects how often a texture that isn't there would
        // have repeated.
        railTileAspect: railTexture?.aspect || 4,
    });

    // Hanging hardware mounts to the back, so it needs the frame's
    // finished outer size rather than the artwork's — a D-ring sits a
    // third down the frame, not a third down the picture.
    mesh.parts.push(...buildHardwareParts(hardwareType, mesh));

    const materials = {
        rail: railTexture
            ? { texture: railTexture.bytes, ...surface }
            : { baseColor: [...hexToRgb(frame?.baseColor), 1], ...surface },
        art: { texture: artTexture, metallic: 0, roughness: 0.55 },
        // Mat board is uncoated stock — flat, and never shiny.
        mat: { baseColor: [...hexToRgb(matColorHex || '#ffffff'), 1], metallic: 0, roughness: 0.94 },
        // The bevel is the board's own cut core, which is near-white on
        // conservation stock whatever the surface colour is.
        matBevel: { baseColor: [...hexToRgb('#f7f4ee'), 1], metallic: 0, roughness: 0.88 },
        backing: { baseColor: [...hexToRgb('#2e2a26'), 1], metallic: 0, roughness: 1 },
        // Plated steel fittings — bright enough to separate from the
        // dark backing board behind them, but not mirror-polished.
        hardware: { baseColor: [...hexToRgb('#9a9ea3'), 1], metallic: 0.9, roughness: 0.34 },
    };

    // Only ship materials the mesh actually references — a matless
    // configuration has no mat or bevel geometry, and an unused
    // material is a validation warning in both formats.
    const used = new Set(mesh.parts.map((p) => p.material));
    const activeMaterials = Object.fromEntries(
        Object.entries(materials).filter(([name]) => used.has(name))
    );

    const glb = buildGlb({ parts: mesh.parts, materials: activeMaterials });

    const usda = buildUsda({ parts: mesh.parts, materials: activeMaterials });
    const usdzEntries = [
        { name: 'frame.usda', bytes: new TextEncoder().encode(usda) },
        ...Object.entries(activeMaterials)
            .filter(([, spec]) => spec.texture)
            .map(([name, spec]) => ({ name: `textures/${name}.png`, bytes: spec.texture })),
    ];
    const usdz = packUsdz(usdzEntries);

    const entry = {
        glbUrl: URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })),
        usdzUrl: URL.createObjectURL(new Blob([usdz], { type: 'model/vnd.usdz+zip' })),
        outerWidthM: mesh.outerWidthM,
        outerHeightM: mesh.outerHeightM,
        profile: renderProfile.profile,
        isMeasured: renderProfile.isMeasured,
    };

    cache.set(key, entry);
    if (cache.size > CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        releaseEntry(cache.get(oldestKey));
        cache.delete(oldestKey);
    }

    return entry;
}
