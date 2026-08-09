// Orchestrates the AR preview model: composite the front-face texture,
// then hand it to both the GLB builder (Android Scene Viewer / WebXR /
// desktop 3D fallback) and the USDZ builder (iOS Quick Look), producing a
// pair of blob: URLs a <model-viewer> element can use directly as
// `src` / `ios-src`.
import { renderArFrontFaceTexture, canvasToPngBytes, loadMouldingTile } from './arModelTexture';
import { buildFrameGlb } from './glbBoxBuilder';
import { buildFrameUsda, buildUsdzArchive } from './usdzBoxBuilder';

const CM_TO_M = 0.01;

// Real moulding depth isn't in the catalogue data (see CustomizeFramePage's
// own getFrameVisualProfile, which infers a *2D rendering* profile from a
// frame's name/description the same way) — independently estimated here
// from typical physical depths for each style, in centimetres, since an AR
// model needs an actual depth dimension a flat CSS rendering never did.
function estimateFrameDepthCm(frame) {
    const label = `${frame?.name || ''} ${frame?.desc || ''}`.toLowerCase();
    if (/floater|float frame/.test(label)) return 3.5; // gap behind canvas + moulding
    if (/deep|shadow/.test(label)) return 4.5;
    if (/scoop|reverse/.test(label)) return 3;
    if (/ornate|renaissance|embossed|carved/.test(label)) return 3;
    return 2; // flat/bevel/standard moulding
}

/**
 * @param {object} options
 * @param {object} options.frame - selectedFrame (baseColor, name, desc, widthCategory)
 * @param {number} options.widthIn
 * @param {number} options.heightIn
 * @param {number} options.matInches
 * @param {string} options.matColorHex
 * @param {string} options.artworkUrl
 * @returns {Promise<{ glbUrl: string, usdzUrl: string, revoke: () => void }>}
 */
export async function buildArPreviewModel({ frame, widthIn, heightIn, matInches, matColorHex, artworkUrl }) {
    // Same real photographed moulding sample feeds the front face's border
    // band AND the box's other five faces, so the AR model shows actual
    // captured wood grain / carving detail throughout rather than the flat
    // colour swatch a missing texture would fall back to.
    const mouldingTile = await loadMouldingTile(frame);
    const { canvas } = await renderArFrontFaceTexture({ frame, widthIn, heightIn, matInches, matColorHex, artworkUrl, mouldingTile });
    const pngBytes = await canvasToPngBytes(canvas);
    const mouldingTexturePng = mouldingTile ? await canvasToPngBytes(mouldingTile) : null;

    const widthM = widthIn * 0.0254;
    const heightM = heightIn * 0.0254;
    const depthM = estimateFrameDepthCm(frame) * CM_TO_M;
    const frameColorHex = frame?.baseColor || '#8b4513';

    const glbBytes = buildFrameGlb({ widthM, heightM, depthM, frontTexturePng: pngBytes, frameColorHex, mouldingTexturePng });

    const textureFileName = 'textures/front.png';
    const mouldingTextureFileName = mouldingTexturePng ? 'textures/moulding.png' : null;
    const usda = buildFrameUsda({ widthM, heightM, depthM, frameColorHex, textureFileName, mouldingTextureFileName });
    const usdzFiles = [
        { name: 'frame.usda', data: new TextEncoder().encode(usda) },
        { name: textureFileName, data: pngBytes },
    ];
    if (mouldingTexturePng) usdzFiles.push({ name: mouldingTextureFileName, data: mouldingTexturePng });
    const usdzBytes = buildUsdzArchive(usdzFiles);

    const glbBlob = new Blob([glbBytes], { type: 'model/gltf-binary' });
    const usdzBlob = new Blob([usdzBytes], { type: 'model/vnd.usdz+zip' });
    const glbUrl = URL.createObjectURL(glbBlob);
    const usdzUrl = URL.createObjectURL(usdzBlob);

    return {
        glbUrl,
        usdzUrl,
        revoke: () => {
            URL.revokeObjectURL(glbUrl);
            URL.revokeObjectURL(usdzUrl);
        },
    };
}
