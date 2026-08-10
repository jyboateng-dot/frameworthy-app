import FRAME_RENDER_PROFILES from '../data/frameRenderProfiles.json';

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
    const catalog = FRAME_RENDER_PROFILES.profiles?.[frame?.id] || null;
    const inferred = inferVisualProfile(frame);
    const profile = catalog?.profile || inferred.profile;
    const finish = catalog?.finish || inferred.finish;
    const mouldingWidthIn = catalog?.mouldingWidthIn ?? FALLBACK_FACE_WIDTH_IN[frame?.widthCategory] ?? 1;
    const rabbetDepthIn = catalog?.rabbetDepthIn ?? FALLBACK_RABBET_DEPTH_IN[profile] ?? 0.375;

    return {
        ...catalog,
        profile,
        finish,
        mouldingWidthIn,
        rabbetDepthIn,
        isMeasured: Number.isFinite(catalog?.mouldingWidthIn),
    };
}

export function getFrameExteriorDimensions(openingWidthIn, openingHeightIn, frame, matInches = 0) {
    const renderProfile = getFrameRenderProfile(frame);
    const isCanvas = frame?.isCanvas || frame?.id === 'frame-canvas';
    const mouldingWidthIn = isCanvas ? 0 : renderProfile.mouldingWidthIn;
    const mat = isCanvas ? 0 : Math.max(0, Number(matInches) || 0);
    const outerWidthIn = openingWidthIn + (mouldingWidthIn + mat) * 2;
    const outerHeightIn = openingHeightIn + (mouldingWidthIn + mat) * 2;
    return { ...renderProfile, mouldingWidthIn, outerWidthIn, outerHeightIn };
}
