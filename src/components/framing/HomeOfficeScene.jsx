import React from 'react';
import SceneShell from './SceneShell';

/**
 * The "Home Office" scene — a desk wall, the usual home for smaller prints and
 * gallery groupings. See SceneShell for the centimetre rule every coordinate
 * here obeys.
 *
 * Scale cues are the 75cm desk and the task chair, whose back tops out at
 * 91cm. Both are standard, and between them they cover the size range this
 * scene is actually for: pieces in the 30–70cm band, where the loft's 160cm
 * sofa is too coarse a ruler to judge against.
 *
 * The desk carries a laptop rather than a monitor on purpose — a 27in monitor
 * reaches ~120cm off the floor, which at a 145cm hang centre would be
 * overlapped by anything over 50cm tall, i.e. by most of what this scene
 * exists to show.
 */

const ID = 'fw-office';
const W = 360;
const H = 260;
// Was 225 (35cm floor), 244 (16cm), 258 (2cm) — now 259, a 1cm hairline.
// See StudioLoftScene's FLOOR_Y comment for why trimming this is free wall
// height, not a fudge — the desk/chair's real heights don't move, only how
// much canvas is spent drawing floor below them. Doesn't touch the floating
// shelf on the right (positioned from the wall's own top, not FLOOR_Y, since
// it's mounted near the ceiling).
const FLOOR_Y = 259;
// Matches FLOOR_Y's 1cm floor budget exactly — see StudioLoftScene's SKIRT_H
// comment for why that's intentional at this depth, not a mismatch to fix.
const SKIRT_H = 1;

const DESK_W = 150;
const DESK_H = 75;                        // standard desk height — the scale anchor
const DESK_X = (W - DESK_W) / 2;          // 105
const DESK_TOP = FLOOR_Y - DESK_H;        // 150

const CHAIR_CX = 148;                     // set off-centre so it doesn't sit
                                          // directly behind the hang point

export const GEOMETRY = { widthCm: W, heightCm: H, floorLineCm: FLOOR_Y };

const HomeOfficeScene = ({ wallHex = '#f4f4f4', isDarkWall = false }) => (
    <SceneShell
        id={ID}
        widthCm={W}
        heightCm={H}
        floorLineCm={FLOOR_Y}
        skirtingCm={SKIRT_H}
        wallHex={wallHex}
        isDarkWall={isDarkWall}
    >
        <defs>
            <linearGradient id={`${ID}-desk`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9b7a52" />
                <stop offset="100%" stopColor="#84663f" />
            </linearGradient>
        </defs>

        <g transform="translate(-4 0)">

        {/* ── FLOATING SHELF (right) ── 137cm up, clear of a 160cm-wide piece */}
        <rect x="282" y="88" width="70" height="5" rx="1.5" fill="#84663f" />
        <rect x="282" y="93" width="70" height="3" fill="#000" opacity="0.15" />
        <rect x="290" y="66" width="7" height="22" rx="1" fill="#6d7469" />
        <rect x="298" y="70" width="6" height="18" rx="1" fill="#b9736f" />
        <rect x="305" y="63" width="8" height="25" rx="1" fill="#8d9382" />
        <rect x="314" y="72" width="5" height="16" rx="1" fill="#a8894f" />
        <path d="M330 88 L330 74 L344 74 L344 88 Z" fill="#9aa39b" />
        <path d="M337 74 C 329 66, 325 74, 333 78" fill="#557a4d" opacity="0.9" />

        {/* ── DESK (150cm × 75cm — the scene's scale anchor) ── */}
        <rect x={DESK_X + 5} y={DESK_TOP + 6} width="7" height={DESK_H - 6} fill="#6d5238" />
        <rect x={DESK_X + DESK_W - 12} y={DESK_TOP + 6} width="7" height={DESK_H - 6} fill="#6d5238" />
        {/* drawer unit under the right side */}
        <rect x={DESK_X + 96} y={DESK_TOP + 8} width="44" height="54" rx="2" fill="#7a6448" />
        <rect x={DESK_X + 101} y={DESK_TOP + 14} width="34" height="16" rx="2" fill="#8b7454" />
        <rect x={DESK_X + 101} y={DESK_TOP + 34} width="34" height="16" rx="2" fill="#8b7454" />
        <rect x={DESK_X} y={DESK_TOP} width={DESK_W} height="6" rx="2" fill={`url(#${ID}-desk)`} />
        <rect x={DESK_X + 3} y={DESK_TOP + 6} width={DESK_W - 6} height="3" fill="#000" opacity="0.16" />

        {/* ── LAPTOP ── lid tops out at 98cm, see the note above */}
        <rect x={DESK_X + 78} y={DESK_TOP - 3} width="36" height="3" rx="1" fill="#5c6068" />
        <rect x={DESK_X + 81} y={DESK_TOP - 23} width="30" height="20" rx="1.5" fill="#6b7079" />
        <rect x={DESK_X + 83} y={DESK_TOP - 21} width="26" height="16" rx="1" fill="#3f444b" />

        {/* ── TASK CHAIR ── back at 91cm, drawn after the desk so it reads as
            standing in front of it */}
        <rect x={CHAIR_CX - 25} y={FLOOR_Y - 91} width="50" height="40" rx="8" fill="#5b6068" />
        <rect x={CHAIR_CX - 18} y={FLOOR_Y - 84} width="36" height="12" rx="4" fill="#6b7079" />
        <rect x={CHAIR_CX - 3} y={FLOOR_Y - 53} width="6" height="12" fill="#43474d" />
        <rect x={CHAIR_CX - 30} y={FLOOR_Y - 45} width="60" height="8" rx="3" fill="#5b6068" />
        <rect x={CHAIR_CX - 2.5} y={FLOOR_Y - 37} width="5" height="24" fill="#43474d" />
        <rect x={CHAIR_CX - 22} y={FLOOR_Y - 14} width="44" height="4" rx="2" fill="#43474d" />
        <circle cx={CHAIR_CX - 22} cy={FLOOR_Y - 6} r="5" fill="#3a3d42" />
        <circle cx={CHAIR_CX + 22} cy={FLOOR_Y - 6} r="5" fill="#3a3d42" />

        {/* ── WASTEBASKET (left) ── */}
        <path d={`M34 ${FLOOR_Y} L58 ${FLOOR_Y} L56 ${FLOOR_Y - 32} L36 ${FLOOR_Y - 32} Z`} fill="#8e8377" />
        <rect x="35" y={FLOOR_Y - 35} width="22" height="4" rx="1.5" fill="#7d7266" />
        </g>
    </SceneShell>
);

export default HomeOfficeScene;
