import FRAME_RAILS from '../data/frameRails.json';
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
    return FRAME_RAILS.rails?.[frame?.id] || null;
}

/**
 * Tiles the rail along the side's length while its cross-profile fills the
 * moulding's rendered thickness. `auto 100%` / `100% auto` preserves the
 * strip's own aspect ratio on the repeating axis, so a frame tiles at the
 * same physical scale whatever size the preview is drawn at.
 *
 * Top and left are flipped so the cross-profile always runs outer-edge
 * first: the pre-rotated vertical strip and the shared horizontal strip
 * both start from one edge, but opposite sides of a frame face opposite
 * ways. Without this the bevel highlight lands on the wrong edge for two
 * of the four sides.
 */
export function getRailTextureStyle(side, rail) {
    if (!rail) return null;
    const horizontal = HORIZONTAL.has(side);
    const url = horizontal ? rail.h : rail.v;
    if (!url) return null;

    const flip = side === 'top' ? 'scaleY(-1)' : side === 'left' ? 'scaleX(-1)' : 'none';

    return {
        backgroundImage: `url(${url})`,
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
    const ramp = PROFILE_RAMP[profile.profile] || PROFILE_RAMP.flat;
    const direction = SHADE_DIRECTION[side];

    const sheen =
        profile.finish === 'metallic'
            ? `, linear-gradient(${direction}, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 26%, rgba(255,255,255,0.16) 54%, rgba(0,0,0,0.12) 100%)`
            : profile.finish === 'gloss'
              ? `, linear-gradient(${direction}, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 34%)`
              : '';

    return {
        backgroundImage: `linear-gradient(${direction}, ${ramp})${sheen}`,
        opacity: rail?.quality === 'scanned' ? 0.55 : 1,
        mixBlendMode: profile.finish === 'matte' ? 'overlay' : 'soft-light',
    };
}
