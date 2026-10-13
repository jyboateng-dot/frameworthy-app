import PRODIGI_RENDER_ASSETS from '../data/prodigiRenderAssets.json';
import { getFrameRenderProfile } from './frameRenderProfile';

/**
 * Texture + lighting for one side of a frame in the 2D visualizer.
 *
 * Replaces the previous two-tier strip/anchor-crop lookup. That path fell
 * back to a single static patch of a corner photo for most of the
 * catalogue, which could not tile and often sampled across the moulding's
 * face onto its side wall. Rails now come from
 * scripts/build-rail-textures.mjs, which guarantees one invariant per
 * strip: the SHORT axis is the cross-profile running outer edge -> inner
 * edge, and the long axis repeats. Everything below relies on that and on
 * nothing about which source image the strip came from.
 */

const HORIZONTAL = new Set(['top', 'bottom']);

export function getFrameRail(frame) {
    const prodigiRail = PRODIGI_RENDER_ASSETS.rails?.[frame?.id];
    if (prodigiRail) return { ...prodigiRail, version: PRODIGI_RENDER_ASSETS.version };
    // Prodigi mouldings use Prodigi's published actual chevron/corner photos
    // as their material source. The detailed visualizer still renders them
    // through the same tiled-rail renderer as our scanned frame catalogue.
    if (frame?.prodigiRail?.h && frame?.prodigiRail?.v) return frame.prodigiRail;
    return null;
}

/**
 * Tiles the rail along the side's length while its cross-profile fills the
 * moulding's rendered thickness. `auto 100%` / `100% auto` preserves the
 * strip's own aspect ratio on the repeating axis, so a frame tiles at the
 * same physical scale whatever size the preview is drawn at.
 *
 * Opposite sides of a frame face opposite ways, so two of the four are
 * flipped to keep the cross-profile running outer edge -> inner edge.
 * Which two is not symmetric between the axes, because the vertical strip
 * was rotated 90 degrees clockwise at build time: that maps the
 * horizontal strip's TOP row onto the vertical strip's RIGHT column.
 *
 *   h strip: outer edge is at the top
 *     top    outer is up    -> already correct, no flip
 *     bottom outer is down  -> flip
 *   v strip: outer edge is at the right, after the build-time rotation
 *     right  outer is right -> already correct, no flip
 *     left   outer is left  -> flip
 *
 * Getting this wrong swaps the inner and outer edges on one side of each
 * pair. It is invisible on a single-tone moulding and obvious on anything
 * with two tones or a contrasting lip.
 */
export function getRailTextureStyle(side, rail) {
    if (!rail) return null;
    const horizontal = HORIZONTAL.has(side);
    const url = horizontal ? rail.h : rail.v;
    if (!url) return null;
    const version = encodeURIComponent(rail.version || PRODIGI_RENDER_ASSETS.version || 'current');

    const flip = side === 'bottom' ? 'scaleY(-1)' : side === 'left' ? 'scaleX(-1)' : 'none';

    return {
        backgroundImage: `url(${url}?v=${version})`,
        backgroundRepeat: horizontal ? 'repeat-x' : 'repeat-y',
        backgroundSize: horizontal ? 'auto 100%' : '100% auto',
        backgroundPosition: 'center',
        transform: flip,
        transformOrigin: 'center',
    };
}

// Which way light falls across each side's cross-profile. The visualizer
// lights the frame from above-left, the convention product photography
// already uses, so the two sides facing the light read brighter.
const SHADE_DIRECTION = {
    top: 'to bottom',
    bottom: 'to top',
    left: 'to right',
    right: 'to left',
};

// Per-profile luminance ramps across the moulding face, as `overlay`
// gradients rather than baked colour — mid-grey is overlay's identity, so
// each ramp sweeps highlight -> no-op -> shadow over whatever the real
// photographed material is underneath.
const PROFILE_RAMP = {
    scoop: 'rgba(255,255,255,0.30) 0%, rgba(20,20,20,0.16) 30%, rgba(255,255,255,0.10) 58%, rgba(0,0,0,0.42) 100%',
    deep: 'rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.05) 36%, rgba(0,0,0,0.54) 100%',
    bevel: 'rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.03) 44%, rgba(0,0,0,0.40) 100%',
    raised: 'rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.28) 100%',
    floater: 'rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.34) 100%',
    flat: 'rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.22) 100%',
};

/**
 * A scanned rail already carries the moulding's own baked-in shading, so
 * the synthetic ramp is dialled back for those and leant on harder for
 * corner-derived strips, which are flatter and streakier. Passing the
 * strength out separately keeps that judgement in one place instead of
 * spread across the component.
 */
export function getRailShading(side, frame, rail) {
    const profile = getFrameRenderProfile(frame);
    const isWhiteDeep = frame?.id === 'frame-10728';
    const ramp = isWhiteDeep
        ? 'rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.14) 100%'
        : PROFILE_RAMP[profile.profile] || PROFILE_RAMP.flat;
    const direction = SHADE_DIRECTION[side];

    const sheen =
        profile.finish === 'metallic'
            ? `, linear-gradient(${direction}, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 26%, rgba(255,255,255,0.16) 54%, rgba(0,0,0,0.12) 100%)`
              : profile.finish === 'gloss'
              ? `, linear-gradient(${direction}, rgba(255,255,255,0) 0%, rgba(255,255,255,0.26) 18%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0) 52%)`
              : '';

    return {
        backgroundImage: `linear-gradient(${direction}, ${ramp})${sheen}`,
        opacity: isWhiteDeep ? 0.4 : rail?.quality === 'scanned' ? 0.55 : 1,
        mixBlendMode: isWhiteDeep
            ? 'multiply'
            : profile.finish === 'matte'
            ? 'overlay'
            : profile.finish === 'gloss' ? 'screen' : 'soft-light',
    };
}
