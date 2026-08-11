import React from 'react';
import SceneShell from './SceneShell';

/**
 * The "Bedroom" scene — above-the-bed hanging, with a queen bed as the scale
 * cue. See SceneShell for the centimetre rule every coordinate here obeys.
 *
 * A queen mattress is 152cm across, which is the single most widely known
 * furniture dimension there is — that's what makes it a good anchor here.
 *
 * This is the one scene whose hang centre isn't the 145cm gallery standard:
 * roomScenes.js puts it at 150cm, because the headboard already occupies the
 * wall to 100cm and above-bed pieces are conventionally hung higher than
 * gallery height for exactly that reason. At 150cm a piece up to 100cm tall
 * clears the headboard; taller than that and it genuinely doesn't fit over
 * this bed, which is the sort of thing the preview exists to show.
 */

const ID = 'fw-bedroom';
const W = 400;
const H = 280;
// Was 245 (35cm floor), 264 (16cm), 278 (2cm) — now 279, a 1cm hairline.
// See StudioLoftScene's FLOOR_Y comment for why trimming this is free wall
// height, not a fudge — the headboard's real 100cm doesn't move, only how
// much canvas is spent drawing floor below it. The extra room matters most
// here: this is the scene where a tall piece is most likely to need every
// centimetre it can get to clear the bed.
const FLOOR_Y = 279;
// Matches FLOOR_Y's 1cm floor budget exactly — see StudioLoftScene's SKIRT_H
// comment for why that's intentional at this depth, not a mismatch to fix.
const SKIRT_H = 1;

const BED_W = 152;                        // queen — the scene's scale anchor
const BED_X = (W - BED_W) / 2;            // 124
const HEADBOARD_TOP = FLOOR_Y - 100;      // 145
const MATTRESS_TOP = FLOOR_Y - 55;        // 190

export const GEOMETRY = { widthCm: W, heightCm: H, floorLineCm: FLOOR_Y };

// A 46cm nightstand with a table lamp, ~87cm to the top of the shade.
const Nightstand = ({ cx }) => (
    <g>
        <ellipse cx={cx} cy={FLOOR_Y + 4} rx="30" ry="5" fill={`url(#${ID}-contact)`} />
        <rect x={cx - 23} y={FLOOR_Y - 60} width="46" height="60" rx="3" fill="#7a6448" />
        <rect x={cx - 18} y={FLOOR_Y - 52} width="36" height="18" rx="2" fill="#8b7454" />
        <rect x={cx - 18} y={FLOOR_Y - 30} width="36" height="18" rx="2" fill="#8b7454" />
        <rect x={cx - 5} y={FLOOR_Y - 45} width="10" height="2.5" rx="1.2" fill="#5c4a35" />
        <rect x={cx - 5} y={FLOOR_Y - 23} width="10" height="2.5" rx="1.2" fill="#5c4a35" />
        {/* lamp */}
        <rect x={cx - 2} y={FLOOR_Y - 76} width="4" height="16" fill="#4a463f" />
        <path d={`M${cx - 15} ${FLOOR_Y - 87} L${cx + 15} ${FLOOR_Y - 87} L${cx + 11} ${FLOOR_Y - 74} L${cx - 11} ${FLOOR_Y - 74} Z`} fill="#e8e2d4" />
        <ellipse cx={cx} cy={FLOOR_Y - 74} rx="10" ry="2.5" fill="#f3e6c8" opacity="0.5" />
    </g>
);

const BedroomScene = ({ wallHex = '#f4f4f4', isDarkWall = false }) => (
    <SceneShell
        id={ID}
        widthCm={W}
        heightCm={H}
        floorLineCm={FLOOR_Y}
        skirtingCm={SKIRT_H}
        wallHex={wallHex}
        isDarkWall={isDarkWall}
    >
        {/* ── RUG ── */}
        <rect
            x="70"
            y={FLOOR_Y + SKIRT_H + 5}
            width="260"
            height="17"
            rx="2"
            fill={isDarkWall ? '#3a3733' : '#c9c0b2'}
            opacity="0.85"
        />

        <Nightstand cx={89} />
        <Nightstand cx={311} />

        {/* ── BED (152cm queen — the scene's scale anchor) ── */}
        <ellipse cx={W / 2} cy={FLOOR_Y + 5} rx="105" ry="7" fill={`url(#${ID}-contact)`} />
        {/* headboard, 100cm tall */}
        <rect x={BED_X} y={HEADBOARD_TOP} width={BED_W} height="72" rx="6" fill="#6f6a5f" />
        <rect x={BED_X + 8} y={HEADBOARD_TOP + 7} width={BED_W - 16} height="26" rx="4" fill="#7d786c" />
        <rect x={BED_X + 8} y={HEADBOARD_TOP + 38} width={BED_W - 16} height="26" rx="4" fill="#7d786c" />
        {/* base + legs */}
        <rect x={BED_X - 4} y={FLOOR_Y - 33} width={BED_W + 8} height="25" rx="3" fill="#5f5a51" />
        <rect x={BED_X + 2} y={FLOOR_Y - 9} width="6" height="9" fill="#3d3a34" />
        <rect x={BED_X + BED_W - 8} y={FLOOR_Y - 9} width="6" height="9" fill="#3d3a34" />
        {/* mattress at 55cm, then the duvet folded back over it */}
        <rect x={BED_X - 4} y={MATTRESS_TOP} width={BED_W + 8} height="24" rx="4" fill="#efe9de" />
        <rect x={BED_X - 6} y={MATTRESS_TOP + 8} width={BED_W + 12} height="22" rx="5" fill="#d9d2c4" />
        <rect x={BED_X - 6} y={MATTRESS_TOP + 8} width={BED_W + 12} height="7" rx="3" fill="#f2ede3" />
        {/* pillows, propped against the headboard */}
        <rect x={BED_X + 14} y={MATTRESS_TOP - 22} width="56" height="24" rx="10" fill="#f7f3ea" transform={`rotate(-3 ${BED_X + 42} ${MATTRESS_TOP - 10})`} />
        <rect x={BED_X + 82} y={MATTRESS_TOP - 22} width="56" height="24" rx="10" fill="#f7f3ea" transform={`rotate(3 ${BED_X + 110} ${MATTRESS_TOP - 10})`} />
        <rect x={BED_X + 55} y={MATTRESS_TOP - 14} width="42" height="18" rx="7" fill="#b9a06a" opacity="0.85" />

        {/* ── THROW BLANKET over the foot of the bed ── */}
        <rect x={BED_X + 6} y={MATTRESS_TOP + 22} width={BED_W - 12} height="12" rx="3" fill="#8d9382" opacity="0.9" />
    </SceneShell>
);

export default BedroomScene;
