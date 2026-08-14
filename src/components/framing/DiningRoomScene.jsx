import React from 'react';
import SceneShell from './SceneShell';

/**
 * The "Dining Room" scene — a wide wall, with a 75cm-high table as the scale
 * cue. See SceneShell for the centimetre rule every coordinate here obeys.
 *
 * Nothing on the table reaches above 92cm off the floor, deliberately: with
 * the hang centre at 145cm, anything taller would be overlapped by artwork
 * over ~105cm tall, and artwork always draws on top of the scene.
 */

const ID = 'fw-dining';
const W = 440;
const H = 290;
// Was 255 (35cm floor), 274 (16cm), 288 (2cm) — now 289, a 1cm hairline.
// See StudioLoftScene's FLOOR_Y comment for why trimming this is free wall
// height, not a fudge — the table's real 75cm doesn't move, only how much
// canvas is spent drawing floor beneath it.
const FLOOR_Y = 289;
// Matches FLOOR_Y's 1cm floor budget exactly — see StudioLoftScene's SKIRT_H
// comment for why that's intentional at this depth, not a mismatch to fix.
const SKIRT_H = 1;

const TABLE_W = 180;                      // a real 6-seater
const TABLE_H = 75;                       // standard dining height — the scale anchor
const TABLE_X = (W - TABLE_W) / 2;        // 130
const TABLE_TOP = FLOOR_Y - TABLE_H;      // 180

const CHAIR_L = 104;                      // chair centres, one at each end
const CHAIR_R = 336;

export const GEOMETRY = { widthCm: W, heightCm: H, floorLineCm: FLOOR_Y };

// An end chair, drawn from behind: back panel, seat, four legs. 46cm across
// and 97cm to the top of the back, which is what a real dining chair measures.
const Chair = ({ cx }) => (
    <g>
        {/* back posts run from the seat up behind the back panel */}
        <rect x={cx - 22} y={FLOOR_Y - 97} width="5" height="55" fill="#5c4632" />
        <rect x={cx + 17} y={FLOOR_Y - 97} width="5" height="55" fill="#5c4632" />
        <rect x={cx - 23} y={FLOOR_Y - 97} width="46" height="34" rx="5" fill="#6d5238" />
        {/* slats, not a pale inset panel — an inset reads as a hollow frame at
            the size these render, which is distractingly like hung artwork */}
        <rect x={cx - 9} y={FLOOR_Y - 92} width="5" height="24" rx="2" fill="#5c4632" opacity="0.6" />
        <rect x={cx + 4} y={FLOOR_Y - 92} width="5" height="24" rx="2" fill="#5c4632" opacity="0.6" />
        {/* seat at 45cm */}
        <rect x={cx - 26} y={FLOOR_Y - 48} width="52" height="7" rx="2.5" fill="#6d5238" />
        <rect x={cx - 22} y={FLOOR_Y - 41} width="5" height="41" fill="#5c4632" />
        <rect x={cx + 17} y={FLOOR_Y - 41} width="5" height="41" fill="#5c4632" />
    </g>
);

const DiningRoomScene = ({ wallHex = '#f4f4f4', isDarkWall = false }) => (
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
            <linearGradient id={`${ID}-top`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8a6741" />
                <stop offset="100%" stopColor="#74532f" />
            </linearGradient>
        </defs>

        <g transform="translate(-4 0)">

        {/* ── RUG ── */}
        <rect
            x="88"
            y={FLOOR_Y + SKIRT_H + 6}
            width="264"
            height="16"
            rx="2"
            fill={isDarkWall ? '#3a3733' : '#cfc6b8'}
            opacity="0.85"
        />

        {/* ── TABLE (180cm × 75cm — the scene's scale anchor) ── */}
        {/* trestle legs + stretcher, drawn before the top so the top overlaps */}
        <rect x={TABLE_X + 12} y={TABLE_TOP + 6} width="8" height={TABLE_H - 6} fill="#5c4632" />
        <rect x={TABLE_X + TABLE_W - 20} y={TABLE_TOP + 6} width="8" height={TABLE_H - 6} fill="#5c4632" />
        <rect x={TABLE_X + 16} y={FLOOR_Y - 28} width={TABLE_W - 32} height="5" rx="2" fill="#5c4632" />
        <rect x={TABLE_X} y={TABLE_TOP} width={TABLE_W} height="7" rx="2" fill={`url(#${ID}-top)`} />
        <rect x={TABLE_X + 4} y={TABLE_TOP + 7} width={TABLE_W - 8} height="4" fill="#000" opacity="0.16" />

        <Chair cx={CHAIR_L} />
        <Chair cx={CHAIR_R} />

        {/* ── CENTREPIECE ── a low fruit bowl rather than a vase of stems: at
            90cm off the floor it only meets artwork over 110cm tall, where a
            tall vase would be overlapped by anything over ~75cm. */}
        <ellipse cx={W / 2} cy={TABLE_TOP - 4} rx="24" ry="7" fill="#9aa39b" />
        <ellipse cx={W / 2} cy={TABLE_TOP - 7} rx="24" ry="5" fill="#b3bbb2" />
        <circle cx={W / 2 - 8} cy={TABLE_TOP - 10} r="5" fill="#b9736f" />
        <circle cx={W / 2 + 2} cy={TABLE_TOP - 11} r="5" fill="#c98d7c" />
        <circle cx={W / 2 + 11} cy={TABLE_TOP - 9} r="4.5" fill="#a8894f" />

        {/* ── FLOOR PLANT (left) ── */}
        <path d={`M31 ${FLOOR_Y} L57 ${FLOOR_Y} L54 ${FLOOR_Y - 30} L34 ${FLOOR_Y - 30} Z`} fill="#8e8377" />
        <rect x="32" y={FLOOR_Y - 33} width="24" height="4" rx="1.5" fill="#7d7266" />
        {/* Upright blades — a snake plant, ~75cm to the tallest tip. */}
        <path d={`M44 ${FLOOR_Y - 33} C 40 ${FLOOR_Y - 60}, 38 ${FLOOR_Y - 80}, 41 ${FLOOR_Y - 108}`} stroke="#4c6b45" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d={`M44 ${FLOOR_Y - 33} C 49 ${FLOOR_Y - 58}, 52 ${FLOOR_Y - 74}, 50 ${FLOOR_Y - 96}`} stroke="#557a4d" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d={`M44 ${FLOOR_Y - 33} C 36 ${FLOOR_Y - 52}, 31 ${FLOOR_Y - 64}, 32 ${FLOOR_Y - 84}`} stroke="#5f8654" strokeWidth="4.5" strokeLinecap="round" fill="none" />

        {/* ── SIDE TABLE + CARAFE (right) ── 70cm tall */}
        <rect x="372" y={FLOOR_Y - 70} width="56" height="5" rx="2" fill="#6d5238" />
        <rect x="377" y={FLOOR_Y - 65} width="5" height="65" fill="#5c4632" />
        <rect x="418" y={FLOOR_Y - 65} width="5" height="65" fill="#5c4632" />
        <rect x="380" y={FLOOR_Y - 34} width="40" height="4" rx="1.5" fill="#5c4632" />
        <path d={`M394 ${FLOOR_Y - 70} L406 ${FLOOR_Y - 70} L404 ${FLOOR_Y - 88} L396 ${FLOOR_Y - 88} Z`} fill="#a9bdc4" opacity="0.85" />
        </g>
    </SceneShell>
);

export default DiningRoomScene;
