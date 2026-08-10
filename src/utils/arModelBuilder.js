// Orchestrates the AR preview model: composite the front-face texture,
// then hand it to both the GLB builder (Android Scene Viewer / WebXR /
// desktop 3D fallback) and the USDZ builder (iOS Quick Look), producing a
// pair of blob: URLs a <model-viewer> element can use directly as
// `src` / `ios-src`.
import { renderArFrontFaceTexture, canvasToPngBytes, loadMouldingTile } from './arModelTexture';
import { buildFrameGlb } from './glbBoxBuilder';
import { buildFrameUsda, buildUsdzArchive } from './usdzBoxBuilder';
import { getFrameExteriorDimensions } from './frameRenderProfile';

// Real moulding depth isn't in the catalogue data (see CustomizeFramePage's
// own getFrameVisualProfile, which infers a *2D rendering* profile from a
// frame's name/description the same way) — independently estimated here
// from typical physical depths for each style, in centimetres, since an AR
// model needs an actual depth dimension a flat CSS rendering never did.
function getModelDepthIn(renderProfile) {
    const frontWallIn = {
        floater: 0.5,
        deep: 0.375,
        scoop: 0.3,
        raised: 0.3,
        bevel: 0.25,
        flat: 0.25,
    }[renderProfile.profile] ?? 0.25;
    return renderProfile.rabbetDepthIn + frontWallIn;
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
    // The straight-on rail is safe to repeat as material. Profile/corner
    // captures remain geometric references until the AR ring mesh consumes
    // their cross-section, rather than being incorrectly tiled as a surface.
    const frontMouldingTile = await loadMouldingTile(frame);
    const sideMouldingTile = frontMouldingTile;
    const { openingCanvas } = await renderArFrontFaceTexture({ frame, widthIn, heightIn, matInches, matColorHex, artworkUrl, mouldingTile: frontMouldingTile });
    const pngBytes = await canvasToPngBytes(openingCanvas);
    const mouldingTexturePng = sideMouldingTile ? await canvasToPngBytes(sideMouldingTile) : null;

    const geometry = getFrameExteriorDimensions(widthIn, heightIn, frame, matInches);
    const widthM = geometry.outerWidthIn * 0.0254;
    const heightM = geometry.outerHeightIn * 0.0254;
    const depthM = getModelDepthIn(geometry) * 0.0254;
    const railWidthM = geometry.mouldingWidthIn * 0.0254;
    // Position mat/artwork behind the front lip, bounded by the source
    // rabbet depth so the physical recess remains proportional per frame.
    const openingInsetM = Math.min(depthM * 0.65, Math.max(0.003, geometry.rabbetDepthIn * 0.0254 * 0.45));
    const frameColorHex = frame?.baseColor || '#8b4513';

    const glbBytes = buildFrameGlb({ widthM, heightM, depthM, railWidthM, openingInsetM, frontTexturePng: pngBytes, frameColorHex, mouldingTexturePng });

    const textureFileName = 'textures/front.png';
    const mouldingTextureFileName = mouldingTexturePng ? 'textures/moulding.png' : null;
    const usda = buildFrameUsda({ widthM, heightM, depthM, railWidthM, openingInsetM, frameColorHex, textureFileName, mouldingTextureFileName });
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
