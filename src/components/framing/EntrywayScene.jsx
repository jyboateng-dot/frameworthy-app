import React from 'react';
import SceneShell from './SceneShell';

/**
 * The "Entryway" scene — a narrow hall wall with a console table and the front
 * door. See SceneShell for the centimetre rule every coordinate here obeys.
 *
 * This is the scene that earns its place by saying no. At 340cm the wall is
 * the narrowest on offer, and the door casing eats the right 88cm of it, so a
 * piece that looks fine in the loft visibly runs into the door here. That is
 * the honest answer, and it's the one a customer most needs before ordering a
 * large canvas for a hallway.
 *
 * Two calibrated cues, deliberately: the console at 80cm and the door opening
 * at 203cm — a standard interior door, and the one dimension almost everyone
 * can eyeball against their own house.
 */

const ID = 'fw-entry';
const W = 340;
const H = 260;
// Was 230 (30cm floor), 246 (14cm), 258 (2cm) — now 259, a 1cm hairline,
// same depth as every other scene despite this one starting thinner (tile,
// not boards). See StudioLoftScene's FLOOR_Y comment for why trimming this
// is free wall height, not a fudge: the console's real 80cm and the door's
// real 203cm don't move, only how much canvas is spent drawing floor
// beneath them. Worth the most here — this is the narrowest wall on offer,
// so it's the scene most likely to need every spare centimetre to keep a
// tall piece off the console or the hook rail.
const FLOOR_Y = 259;
// Matches FLOOR_Y's 1cm floor budget exactly — see StudioLoftScene's SKIRT_H
// comment for why that's intentional at this depth, not a mismatch to fix.
const SKIRT_H = 1;

const DOOR_H = 203;                       // standard interior door opening
const DOOR_W = 81;
const DOOR_X = 251;
const CASING = 5;

const CONSOLE_W = 100;
const CONSOLE_H = 80;                     // the near-field scale cue
const CONSOLE_CX = W / 2;                 // sits under the hang point
const CONSOLE_TOP = FLOOR_Y - CONSOLE_H;  // 150

export const GEOMETRY = { widthCm: W, heightCm: H, floorLineCm: FLOOR_Y };

const EntrywayScene = ({ wallHex = '#f4f4f4', isDarkWall = false }) => (
    <SceneShell
        id={ID}
        widthCm={W}
        heightCm={H}
        floorLineCm={FLOOR_Y}
        skirtingCm={SKIRT_H}
        // Pale stone tile rather than boards — halls take the wet shoes, and it
        // keeps this scene distinguishable from the three wood-floored ones at
        // thumbnail size.
        seamSpacingCm={68}
        floorTopHex="#bab3a7"
        floorBottomHex="#a09889"
        wallHex={wallHex}
        isDarkWall={isDarkWall}
    >
        {/* ── FRONT DOOR (203cm opening — the second scale cue) ── */}
        <rect
            x={DOOR_X - CASING}
            y={FLOOR_Y - DOOR_H - CASING}
            width={DOOR_W + CASING * 2}
            height={DOOR_H + CASING}
            fill={isDarkWall ? '#d9d3c6' : '#efece4'}
        />
        <rect x={DOOR_X} y={FLOOR_Y - DOOR_H} width={DOOR_W} height={DOOR_H} fill={isDarkWall ? '#c3bcae' : '#e2ddd1'} />
        {/* two-panel door */}
        <rect x={DOOR_X + 11} y={FLOOR_Y - DOOR_H + 14} width={DOOR_W - 22} height="72" rx="2" fill="#000" opacity="0.07" />
        <rect x={DOOR_X + 11} y={FLOOR_Y - DOOR_H + 100} width={DOOR_W - 22} height="82" rx="2" fill="#000" opacity="0.07" />
        {/* handle at 95cm, where a real one sits */}
        <circle cx={DOOR_X + 11} cy={FLOOR_Y - 95} r="3.5" fill="#8d7a56" />

        {/* ── RUNNER ── */}
        <rect
            x="24"
            y={FLOOR_Y + SKIRT_H + 5}
            width="190"
            height="15"
            rx="2"
            fill={isDarkWall ? '#3a3733' : '#9c8f7d'}
            opacity="0.8"
        />

        {/* ── CONSOLE TABLE (100cm × 80cm) ── */}
        <ellipse cx={CONSOLE_CX} cy={FLOOR_Y + 4} rx="66" ry="6" fill={`url(#${ID}-contact)`} />
        <rect x={CONSOLE_CX - 52} y={CONSOLE_TOP} width={CONSOLE_W + 4} height="6" rx="2" fill="#6d5238" />
        <rect x={CONSOLE_CX - 46} y={CONSOLE_TOP + 6} width="5" height={CONSOLE_H - 6} fill="#5c4632" />
        <rect x={CONSOLE_CX + 41} y={CONSOLE_TOP + 6} width="5" height={CONSOLE_H - 6} fill="#5c4632" />
        <rect x={CONSOLE_CX - 46} y={FLOOR_Y - 30} width="92" height="4" rx="1.5" fill="#5c4632" />
        {/* woven basket on the lower shelf */}
        <rect x={CONSOLE_CX + 2} y={FLOOR_Y - 56} width="38" height="26" rx="3" fill="#b39a72" />
        <rect x={CONSOLE_CX + 2} y={FLOOR_Y - 48} width="38" height="2" fill="#000" opacity="0.12" />
        <rect x={CONSOLE_CX + 2} y={FLOOR_Y - 41} width="38" height="2" fill="#000" opacity="0.12" />

        {/* ── ON THE CONSOLE ── a key bowl and a short vase, nothing above
            100cm off the floor: at the 145cm hang centre that leaves artwork
            up to 90cm tall clear of it, and artwork always draws over the
            scene, so anything taller would appear to swallow the vase. */}
        <ellipse cx={CONSOLE_CX - 30} cy={CONSOLE_TOP - 3} rx="13" ry="4.5" fill="#9aa39b" />
        <ellipse cx={CONSOLE_CX - 30} cy={CONSOLE_TOP - 5} rx="13" ry="3.5" fill="#b3bbb2" />
        <path d={`M${CONSOLE_CX + 22} ${CONSOLE_TOP} L${CONSOLE_CX + 34} ${CONSOLE_TOP} L${CONSOLE_CX + 32} ${CONSOLE_TOP - 12} L${CONSOLE_CX + 24} ${CONSOLE_TOP - 12} Z`} fill="#a9bdc4" opacity="0.9" />
        <path d={`M${CONSOLE_CX + 28} ${CONSOLE_TOP - 12} L${CONSOLE_CX + 23} ${CONSOLE_TOP - 20}`} stroke="#557a4d" strokeWidth="1.6" fill="none" />
        <path d={`M${CONSOLE_CX + 28} ${CONSOLE_TOP - 12} L${CONSOLE_CX + 34} ${CONSOLE_TOP - 19}`} stroke="#557a4d" strokeWidth="1.6" fill="none" />

        {/* ── HOOK RAIL (left) ── wall-mounted at 168cm rather than a floor
            plant, deliberately. The panel crops the bottom of a scene from the
            hang line down by roughly `wallSpanCm` worth of centimetres, so on
            the narrowest wall here anything standing on the floor loses its
            base and reads as floating. A rail hangs above the crop in every
            layout, and it's the more entryway-ish detail anyway. */}
        {/* The rail's original left edge was x=26. Keep the grouped scene
            artefact 2 units from the viewport edge and 9 units lower. */}
        <g data-artefact="hanging-rack" transform="translate(-24 9)">
            <rect x="26" y={FLOOR_Y - 168} width="78" height="5" rx="1.5" fill="#6d5238" />
            <rect x="26" y={FLOOR_Y - 163} width="78" height="2.5" fill="#000" opacity="0.15" />
            {[40, 65, 90].map((x) => (
                <rect key={x} x={x} y={FLOOR_Y - 161} width="3" height="7" rx="1.5" fill="#8d7a56" />
            ))}
            {/* a tote hung from the middle hook */}
            <path d={`M58 ${FLOOR_Y - 154} C 58 ${FLOOR_Y - 166}, 74 ${FLOOR_Y - 166}, 74 ${FLOOR_Y - 154}`} stroke="#8a7156" strokeWidth="2" fill="none" />
            <rect x="52" y={FLOOR_Y - 154} width="28" height="34" rx="2" fill="#8d9382" />
            <rect x="52" y={FLOOR_Y - 154} width="28" height="5" fill="#000" opacity="0.12" />
        </g>
    </SceneShell>
);

export default EntrywayScene;
