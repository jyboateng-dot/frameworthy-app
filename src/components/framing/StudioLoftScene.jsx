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

const FLOOR_Y = 245;      // wall meets skirting
const SKIRT_H = 8;        // skirting board height
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
    const shadow = isDarkWall ? 'rgba(0,0,0,0.55)' : 'rgba(28,26,23,0.16)';
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
                <radialGradient id="fw-wall-light" cx="50%" cy="34%" r="78%">
                    <stop offset="0%" stopColor="#fff" stopOpacity={isDarkWall ? 0.16 : 0.55} />
                    <stop offset="60%" stopColor="#fff" stopOpacity={isDarkWall ? 0.05 : 0.16} />
                    <stop offset="100%" stopColor="#000" stopOpacity={isDarkWall ? 0.28 : 0.10} />
                </radialGradient>
                <linearGradient id="fw-floor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8a6a4a" />
                    <stop offset="100%" stopColor="#6f5238" />
                </linearGradient>
                <linearGradient id="fw-sofa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6d7469" />
                    <stop offset="100%" stopColor="#565c53" />
                </linearGradient>
                {/* Contact shadow beneath furniture. */}
                <radialGradient id="fw-contact" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#000" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* ── WALL ── */}
            <rect x="0" y="0" width="420" height={FLOOR_Y} fill={wallHex} />
            <rect x="0" y="0" width="420" height={FLOOR_Y} fill="url(#fw-wall-light)" />

            {/* ── FLOOR ── */}
            <rect x="0" y={FLOOR_Y} width="420" height={280 - FLOOR_Y} fill="url(#fw-floor)" />
            {/* Plank seams. Straight-on view, so they stay parallel — a
                receding/converging floor would contradict the flat wall plane
                the artwork placement depends on. */}
            {[0, 70, 140, 210, 280, 350].map((x) => (
                <rect key={x} x={x} y={FLOOR_Y + SKIRT_H} width="1" height={280 - FLOOR_Y - SKIRT_H} fill="#000" opacity="0.13" />
            ))}
            <rect x="0" y={FLOOR_Y} width="420" height={SKIRT_H} fill={skirting} />

            {/* ── RUG ── */}
            <rect x="90" y={FLOOR_Y + SKIRT_H + 6} width="240" height="18" rx="2" fill={isDarkWall ? '#3a3733' : '#cfc6b8'} opacity="0.85" />

            {/* ── SOFA (160cm — the scene's scale anchor) ── */}
            <ellipse cx="210" cy={FLOOR_Y + 6} rx={SOFA_W * 0.62} ry="7" fill="url(#fw-contact)" />
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
            <ellipse cx="52" cy={FLOOR_Y + 4} rx="20" ry="5" fill="url(#fw-contact)" />
            <rect x="50" y={FLOOR_Y - 118} width="3" height="118" fill="#4a463f" />
            <path d={`M34 ${FLOOR_Y - 150} L70 ${FLOOR_Y - 150} L64 ${FLOOR_Y - 118} L40 ${FLOOR_Y - 118} Z`} fill={isDarkWall ? '#d8cfbb' : '#e8e2d4'} />
            <ellipse cx="52" cy={FLOOR_Y - 118} rx="12" ry="3" fill="#f3e6c8" opacity={isDarkWall ? 0.75 : 0.45} />
            <rect x="38" y={FLOOR_Y - 4} width="28" height="4" rx="2" fill="#3d3a34" />

            {/* ── PLANT (right) ── */}
            <ellipse cx="366" cy={FLOOR_Y + 4} rx="22" ry="5" fill="url(#fw-contact)" />
            <path d={`M352 ${FLOOR_Y} L380 ${FLOOR_Y} L376 ${FLOOR_Y - 26} L356 ${FLOOR_Y - 26} Z`} fill="#a86c4e" />
            <rect x="354" y={FLOOR_Y - 29} width="24" height="4" rx="1.5" fill="#935e43" />
            <path d={`M366 ${FLOOR_Y - 29} L366 ${FLOOR_Y - 78}`} stroke="#4c6b45" strokeWidth="2.5" fill="none" />
            {/* Leaves, alternating left/right up the stem. FLOOR_Y is 245, so
                these sit between y=161 and y=208 — roughly 40-85cm off the
                floor, a believable height for a potted fiddle-leaf. */}
            <path d="M366 171 C 350 161, 344 175, 360 181" fill="#557a4d" opacity="0.92" />
            <path d="M366 179 C 384 167, 392 183, 373 188" fill="#557a4d" opacity="0.92" />
            <path d="M366 189 C 348 181, 340 195, 359 199" fill="#557a4d" opacity="0.92" />
            <path d="M366 199 C 386 189, 392 205, 372 208" fill="#557a4d" opacity="0.92" />

            {/* Ambient occlusion where wall meets floor — grounds the room. */}
            <rect x="0" y={FLOOR_Y - 14} width="420" height="14" fill={shadow} opacity="0.35" style={{ filter: 'blur(4px)' }} />
        </svg>
    );
};

export default StudioLoftScene;
