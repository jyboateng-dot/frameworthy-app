const FALLBACK_FACE_WIDTH_IN = {
    narrow: 0.5,
    standard: 1,
    wide: 1.5,
};

const FALLBACK_RABBET_DEPTH_IN = {
    floater: 0.75,
    deep: 0.75,
    scoop: 0.5,
    raised: 0.5,
    bevel: 0.375,
    flat: 0.375,
};

function inferVisualProfile(frame) {
    const label = `${frame?.name || ''} ${frame?.desc || ''}`.toLowerCase();
    const profile = frame?.renderProfile || (
        /floater|float frame/.test(label) ? 'floater' :
        /scoop|reverse/.test(label) ? 'scoop' :
        /deep|shadow/.test(label) ? 'deep' :
        /bevel|angled|lip/.test(label) ? 'bevel' :
        /ornate|renaissance|embossed|carved|bamboo/.test(label) ? 'raised' :
        'flat'
    );
    const finish = /gold|silver|pewter|metallic|chrome|bronze|copper|rose gold/.test(label)
        ? 'metallic'
        : /glossy|lacquer/.test(label)
            ? 'gloss'
            : 'matte';
    return { profile, finish };
}

/**
 * The one render profile used by the live 2D preview and the 3D/AR model.
 * `mouldingWidthIn` changes the true exterior dimensions; `rabbetDepthIn`
 * establishes the physical recess/depth floor in the AR model. Values absent
 * from legacy source pages deliberately fall back to the previous catalogue
 * category estimate instead of pretending a measurement exists.
 */
export function getFrameRenderProfile(frame) {
    const catalog = null;
    const inferred = inferVisualProfile(frame);
    const profile = catalog?.profile || frame?.renderProfile || inferred.profile;
    const finish = catalog?.finish || frame?.finish || inferred.finish;
    const directMouldingWidth = frame?.mouldingWidthIn == null ? NaN : Number(frame.mouldingWidthIn);
    const directRabbetDepth = frame?.rabbetDepthIn == null ? NaN : Number(frame.rabbetDepthIn);
    const directTotalDepth = frame?.totalDepthIn == null ? NaN : Number(frame.totalDepthIn);
    const mouldingWidthIn = catalog?.mouldingWidthIn
        ?? (Number.isFinite(directMouldingWidth) ? directMouldingWidth : null)
        ?? FALLBACK_FACE_WIDTH_IN[frame?.widthCategory]
        ?? 1;
    const rabbetDepthIn = catalog?.rabbetDepthIn
        ?? (Number.isFinite(directRabbetDepth) ? directRabbetDepth : null)
        ?? FALLBACK_RABBET_DEPTH_IN[profile]
        ?? 0.375;
    const totalDepthIn = catalog?.totalDepthIn
        ?? (Number.isFinite(directTotalDepth) ? directTotalDepth : null);

    return {
        ...catalog,
        profile,
        finish,
        mouldingWidthIn,
        rabbetDepthIn,
        totalDepthIn,
        openingGapIn: Math.max(0, Number(frame?.canvasGapMm) || 0) / 25.4,
        canvasThicknessIn: Math.max(0, Number(frame?.canvasThicknessMm) || 0) / 25.4,
        isCanvasOnly: Boolean(frame?.canvasOnly),
        // Published wood/metal products have a square face, not the generic
        // decorative shadow-box step. Edge radii are conservative visual
        // approximations because supplier cross-sections omit those radii.
        crossSection: frame?.canvasGapMm && frame?.prodigiProduct ? [
            { s: 0, z: 0 },
            { s: 0, z: 0.98 },
            { s: 0.025, z: 1 },
            { s: 0.975, z: 1 },
            { s: 1, z: 0.98 },
            // Published 32mm base extends 20mm inward from the 12mm
            // front rim, beneath the 5mm gap and the canvas. Base height
            // follows the published 53mm total minus 40mm rebate.
            { s: 1, z: 13 / 53 },
            { s: 32 / 12, z: 13 / 53 },
            { s: 32 / 12, z: 0 },
        ] : frame?.prodigiProduct && mouldingWidthIn > 0 ? [
            { s: 0, z: 0 },
            { s: 0, z: 0.98 },
            { s: 0.025, z: 1 },
            { s: 0.975, z: 1 },
            { s: 1, z: 0.98 },
            { s: 1, z: 0 },
        ] : null,
        splitRailSurfaces: Boolean(frame?.prodigiProduct),
        matBoardIn: frame?.prodigiProduct ? 2.4 / 25.4 : null,
        isMeasured: Number.isFinite(catalog?.mouldingWidthIn) || Number.isFinite(directMouldingWidth),
    };
}

export function getFrameExteriorDimensions(openingWidthIn, openingHeightIn, frame, matInches = 0) {
    const renderProfile = getFrameRenderProfile(frame);
    const isCanvasOnly = frame?.canvasOnly || frame?.id === 'frame-canvas';
    const mouldingWidthIn = isCanvasOnly ? 0 : renderProfile.mouldingWidthIn;
    const mat = frame?.isCanvas || isCanvasOnly ? 0 : Math.max(0, Number(matInches) || 0);
    const openingGapIn = isCanvasOnly ? 0 : renderProfile.openingGapIn;
    const outerWidthIn = openingWidthIn + (mouldingWidthIn + openingGapIn + mat) * 2;
    const outerHeightIn = openingHeightIn + (mouldingWidthIn + openingGapIn + mat) * 2;
    return { ...renderProfile, mouldingWidthIn, outerWidthIn, outerHeightIn };
}
