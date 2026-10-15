import { getFrameRenderProfile } from './frameRenderProfile';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Turns the measured wall projection into consistent presentation cues for
 * flat UI surfaces. The 3D/AR mesh uses the same source measurement directly;
 * these values only help a straight-on image communicate that depth.
 */
export function getFrameDepthPresentation(frame) {
    const profile = getFrameRenderProfile(frame);
    const depthIn = Number.isFinite(profile.totalDepthIn)
        ? profile.totalDepthIn
        : Math.max(profile.rabbetDepthIn || 0, profile.canvasThicknessIn || 0);
    const depthMm = Math.max(0, depthIn * 25.4);
    // Current fulfilment products run from 19 mm aluminium to 53 mm float
    // frames. Keep fallbacks useful without letting an outlier dominate.
    const depthRatio = clamp((depthMm - 15) / 40, 0, 1);

    return {
        depthIn,
        depthMm,
        depthRatio,
        label: `${Math.round(depthMm)} mm depth`,
        profile: profile.profile,
    };
}

export function getFrameWallShadow(frame, emphasized = false) {
    const { depthRatio } = getFrameDepthPresentation(frame);
    const offsetY = emphasized ? 28 + depthRatio * 22 : 12 + depthRatio * 18;
    const blur = emphasized ? 60 + depthRatio * 40 : 24 + depthRatio * 28;
    const opacity = emphasized ? 0.42 + depthRatio * 0.1 : 0.22 + depthRatio * 0.1;
    return `0 ${offsetY.toFixed(1)}px ${blur.toFixed(1)}px rgba(0,0,0,${opacity.toFixed(3)})`;
}

export function getFrameInnerShadow(frame) {
    const { depthRatio } = getFrameDepthPresentation(frame);
    const offsetY = 2 + depthRatio * 3;
    const blur = 8 + depthRatio * 10;
    const opacity = 0.36 + depthRatio * 0.16;
    return `inset 0 ${offsetY.toFixed(1)}px ${blur.toFixed(1)}px rgba(0,0,0,${opacity.toFixed(3)})`;
}

export function getFrameCanvasShadow(frame, pixelsPerInch) {
    const { depthIn, depthRatio } = getFrameDepthPresentation(frame);
    const projectedDepthPx = depthIn * Math.max(1, pixelsPerInch);
    return {
        offsetY: clamp(projectedDepthPx * 0.28, 4, 24),
        blur: clamp(projectedDepthPx * 0.5, 8, 36),
        color: `rgba(0,0,0,${(0.2 + depthRatio * 0.1).toFixed(3)})`,
    };
}
