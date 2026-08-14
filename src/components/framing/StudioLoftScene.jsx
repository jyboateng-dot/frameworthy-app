import React from 'react';

/**
 * The "Studio Loft" room scene for the Frame Studio visualizer.
 *
 * Drawn rather than photographed for one reason: the wall repaints live from
 * the wall-colour picker. A photographic scene is locked to whatever colour
 * that room was painted, so choosing "Hale Navy" would show a beige room.
 *
 * EVERY COORDINATE IN HERE IS A REAL CENTIMETRE. The viewBox is
 * "0 0 420 280" = a 4.2m wide, 2.8m tall slice of room, which is what makes
 * roomScenes.js's `wallSpanCm: 420` exact by construction rather than
 * measured off a reference object. If you move anything, keep the cm scale:
 * the sofa is 160cm because a real 2-seater is 160cm, and the artwork is
 * placed against that same scale.
 *
 * Drawn dead-on (no perspective skew across the wall plane) so hung artwork
 * can be a plain axis-aligned rectangle — see roomScenes.js for why that
 * matters.
 */

// Wall meets skirting. Was 245 (35cm floor), 264 (16cm), 278 (2cm) — now 279,
// a 1cm hairline. The floor strip's own on-screen depth is a styling choice,
// not a real measurement (unlike ceiling height or furniture size, which
// are), so trimming it and pushing the boundary down is free real wall
// height, not a fudge: the ceiling doesn't move, the sofa's real 80cm
// doesn't move, there's just less canvas spent drawing floor a viewer never
// measures anything against. Real payoff for a piece that needs lifting
// near the ceiling to clear furniture below (see roomScenes.js's
// computeRoomPlacement) — more wall between the two before they meet.
// hang.y in roomScenes.js was recalculated to hold the same 140cm-above-
// floor default gallery height this moves under it.
const FLOOR_Y = 279;
// Matches FLOOR_Y's 1cm floor budget exactly — at 2cm (the old value) this
// would overrun the strip and drive the plank-seam rects below it to a
// negative height (SKIRT_H > total floor depth). With 1cm of floor there's
// no room for a distinct plank surface anyway, so the skirting IS the whole
// floor strip; SKIRT_H === the floor's total depth is intentional here, not
// a coincidence to "fix" back apart.
const SKIRT_H = 1;        // skirting board height
const SOFA_W = 160;       // a real 2-seater — the scene's honest scale cue
const SOFA_H = 80;
const SOFA_X = (420 - SOFA_W) / 2;
const SOFA_TOP = FLOOR_Y - SOFA_H;

// The drawn geometry, published so roomScenes.js's calibration for this scene
// can be checked against the drawing instead of restating it from memory —
// a `wallSpanCm` that has drifted from the viewBox silently breaks the scale
// honesty the whole module is built on.
export const GEOMETRY = { widthCm: 420, heightCm: 280, floorLineCm: FLOOR_Y };

const StudioLoftScene = ({ wallHex = '#f4f4f4', isDarkWall = false }) => {
    // Furniture keeps its own palette rather than deriving from the wall, so
    // it stays readable against both a near-white and a near-black wall. Only
    // the ambient shading flips, since a dark wall bounces far less light.
    const skirting = isDarkWall ? 'rgba(255,255,255,0.10)' : 'rgba(28,26,23,0.10)';

    return (
        // The caller sizes the scene box to this viewBox's exact aspect ratio,
        // so `meet` neither crops nor letterboxes — which is what keeps one cm
        // in the viewBox mapping to a fixed fraction of the rendered box, and
        // therefore keeps the artwork placement math a direct ratio.
        <svg
            viewBox="0 0 420 280"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <defs>
                {/* Light falls off toward the floor and corners — without this
                    the flat fill reads as a colour swatch, not a wall. */}
                <linearGradient id="fw-floor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8a6a4a" />
                    <stop offset="100%" stopColor="#6f5238" />
                </linearGradient>
                <linearGradient id="fw-sofa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6d7469" />
                    <stop offset="100%" stopColor="#565c53" />
                </linearGradient>
            </defs>

            {/* ── WALL ── */}
            <rect x="0" y="0" width="420" height={FLOOR_Y} fill={wallHex} />

            {/* ── FLOOR ── grouped as its own standalone artefact (floor fill
                + seams together — they move as one surface), distinct from
                the floorboard trim and the wall it sits against. */}
            <g data-artefact="floor">
                <rect x="0" y={FLOOR_Y} width="420" height={280 - FLOOR_Y} fill="url(#fw-floor)" />
                {/* Plank seams. Straight-on view, so they stay parallel — a
                    receding/converging floor would contradict the flat wall plane
                    the artwork placement depends on. */}
                {[0, 70, 140, 210, 280, 350].map((x) => (
                    <rect key={x} x={x} y={FLOOR_Y + SKIRT_H} width="1" height={280 - FLOOR_Y - SKIRT_H} fill="#000" opacity="0.13" />
                ))}
            </g>
            {/* Grouped on its own so it's a standalone, independently
                selectable artefact (distinct from the floor/wall it sits
                between) rather than just another leaf shape in the scene. */}
            <g data-artefact="floorboard">
                <rect x="0" y={FLOOR_Y} width="420" height={SKIRT_H} fill={skirting} />
            </g>

            <g transform="translate(-4 0)">

            {/* ── RUG ── */}
            <rect x="90" y={FLOOR_Y + SKIRT_H + 6} width="240" height="18" rx="2" fill={isDarkWall ? '#3a3733' : '#cfc6b8'} opacity="0.85" />

            {/* ── SOFA (160cm — the scene's scale anchor) ── */}
            {/* back */}
            <rect x={SOFA_X} y={SOFA_TOP} width={SOFA_W} height="46" rx="7" fill="url(#fw-sofa)" />
            {/* seat cushions */}
            <rect x={SOFA_X + 5} y={SOFA_TOP + 38} width={(SOFA_W - 16) / 2} height="26" rx="5" fill="#79806f" />
            <rect x={SOFA_X + (SOFA_W / 2) + 1} y={SOFA_TOP + 38} width={(SOFA_W - 16) / 2} height="26" rx="5" fill="#79806f" />
            {/* arms */}
            <rect x={SOFA_X - 6} y={SOFA_TOP + 20} width="14" height="46" rx="6" fill="#61675c" />
            <rect x={SOFA_X + SOFA_W - 8} y={SOFA_TOP + 20} width="14" height="46" rx="6" fill="#61675c" />
            {/* base + legs */}
            <rect x={SOFA_X - 4} y={SOFA_TOP + 62} width={SOFA_W + 8} height="10" rx="3" fill="#4f544a" />
            <rect x={SOFA_X + 6} y={FLOOR_Y - 9} width="5" height="9" fill="#3d3a34" />
            <rect x={SOFA_X + SOFA_W - 11} y={FLOOR_Y - 9} width="5" height="9" fill="#3d3a34" />
            {/* cushions */}
            <rect x={SOFA_X + 14} y={SOFA_TOP + 12} width="30" height="28" rx="5" fill="#8d9382" opacity="0.9" transform={`rotate(-8 ${SOFA_X + 29} ${SOFA_TOP + 26})`} />
            <rect x={SOFA_X + SOFA_W - 44} y={SOFA_TOP + 12} width="30" height="28" rx="5" fill="#b9a06a" opacity="0.85" transform={`rotate(7 ${SOFA_X + SOFA_W - 29} ${SOFA_TOP + 26})`} />

            {/* ── FLOOR LAMP (left) — ~165cm tall, a second scale cue ── */}
            <rect x="50" y={FLOOR_Y - 118} width="3" height="118" fill="#4a463f" />
            <path d={`M34 ${FLOOR_Y - 150} L70 ${FLOOR_Y - 150} L64 ${FLOOR_Y - 118} L40 ${FLOOR_Y - 118} Z`} fill={isDarkWall ? '#d8cfbb' : '#e8e2d4'} />
            <ellipse cx="52" cy={FLOOR_Y - 118} rx="12" ry="3" fill="#f3e6c8" opacity={isDarkWall ? 0.75 : 0.45} />
            <rect x="38" y={FLOOR_Y - 4} width="28" height="4" rx="2" fill="#3d3a34" />

            {/* ── PLANT (right) ── */}
            <path d={`M352 ${FLOOR_Y} L380 ${FLOOR_Y} L376 ${FLOOR_Y - 26} L356 ${FLOOR_Y - 26} Z`} fill="#a86c4e" />
            <rect x="354" y={FLOOR_Y - 29} width="24" height="4" rx="1.5" fill="#935e43" />
            <path d={`M366 ${FLOOR_Y - 29} L366 ${FLOOR_Y - 78}`} stroke="#4c6b45" strokeWidth="2.5" fill="none" />
            {/* Leaves, alternating left/right up the stem, expressed as
                FLOOR_Y-offsets (roughly 40-85cm off the floor, a believable
                height for a potted fiddle-leaf) rather than hardcoded
                absolute y's — those would silently detach from the stem the
                next time FLOOR_Y moves, which is exactly what happened here
                once before. */}
            <path d={`M366 ${FLOOR_Y - 74} C 350 ${FLOOR_Y - 84}, 344 ${FLOOR_Y - 70}, 360 ${FLOOR_Y - 64}`} fill="#557a4d" opacity="0.92" />
            <path d={`M366 ${FLOOR_Y - 66} C 384 ${FLOOR_Y - 78}, 392 ${FLOOR_Y - 62}, 373 ${FLOOR_Y - 57}`} fill="#557a4d" opacity="0.92" />
            <path d={`M366 ${FLOOR_Y - 56} C 348 ${FLOOR_Y - 64}, 340 ${FLOOR_Y - 50}, 359 ${FLOOR_Y - 46}`} fill="#557a4d" opacity="0.92" />
            <path d={`M366 ${FLOOR_Y - 46} C 386 ${FLOOR_Y - 56}, 392 ${FLOOR_Y - 40}, 372 ${FLOOR_Y - 37}`} fill="#557a4d" opacity="0.92" />

            {/* Ambient occlusion where wall meets floor — grounds the room. */}
            </g>
        </svg>
    );
};

export default StudioLoftScene;
