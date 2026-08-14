import React from 'react';

/**
 * The backdrop every drawn room scene repeats: a lit wall, a plank/tile floor,
 * the skirting between them, and the shared fills furniture is drawn with.
 *
 * StudioLoftScene came first and stays hand-authored as the worked example of
 * the conventions; this factors them out so the scenes added after it don't
 * each re-derive the lighting and end up subtly different rooms.
 *
 * THE CENTIMETRE RULE CARRIES OVER, and it is the whole point: `widthCm` and
 * `heightCm` become the viewBox verbatim, so every coordinate a scene draws is
 * a real-world centimetre and roomScenes.js's `wallSpanCm` is exact by
 * construction rather than measured off a reference object. A scene that
 * fudges its furniture sizes silently makes the "honest scale" preview lie.
 *
 * Drawn dead-on (no perspective skew across the wall plane) so hung artwork
 * stays a plain axis-aligned rectangle — see roomScenes.js for why that
 * matters.
 *
 * Gradient ids are namespaced by `id` because two scenes mounted at once would
 * otherwise share one <defs>, and the first one's floor colour would silently
 * win in both.
 */
const SceneShell = ({
    id,
    widthCm,
    heightCm,
    floorLineCm,
    skirtingCm = 8,
    // Seam spacing for the floor — plank width for wood, tile pitch for stone.
    seamSpacingCm = 70,
    floorTopHex = '#8a6a4a',
    // Must match the scene's `floorHex` in roomScenes.js: that's the colour the
    // floor is continued in below the scene box, and a mismatch shows up as a
    // hard line across the panel.
    floorBottomHex = '#6f5238',
    wallHex = '#f4f4f4',
    isDarkWall = false,
    canvasInsetLeftCm = 0,
    children,
}) => {
    // Furniture keeps its own palette rather than deriving from the wall, so it
    // stays readable against both a near-white and a near-black wall. Only the
    // ambient shading flips, since a dark wall bounces far less light.
    const skirting = isDarkWall ? 'rgba(255,255,255,0.10)' : 'rgba(28,26,23,0.10)';
    const seamCount = Math.ceil(widthCm / seamSpacingCm);
    const canvasX = -canvasInsetLeftCm;
    const canvasWidthCm = widthCm + canvasInsetLeftCm;

    return (
        // The caller sizes the scene box to this viewBox's exact aspect ratio,
        // so `meet` neither crops nor letterboxes — which is what keeps one cm
        // in the viewBox mapping to a fixed fraction of the rendered box, and
        // therefore keeps the artwork placement math a direct ratio.
        <svg
            viewBox={`${canvasX} 0 ${canvasWidthCm} ${heightCm}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <defs>
                {/* Light falls off toward the floor and corners — without this
                    the flat fill reads as a colour swatch, not a wall. */}
                <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={floorTopHex} />
                    <stop offset="100%" stopColor={floorBottomHex} />
                </linearGradient>
            </defs>

            {/* ── WALL ── */}
            <rect x={canvasX} y="0" width={canvasWidthCm} height={floorLineCm} fill={wallHex} />

            {/* ── FLOOR ── grouped as its own standalone artefact (floor fill
                + seams together — they move as one surface), distinct from
                the floorboard trim and the wall it sits against. */}
            <g data-artefact="floor">
                <rect x={canvasX} y={floorLineCm} width={canvasWidthCm} height={heightCm - floorLineCm} fill={`url(#${id}-floor)`} />
                {/* Seams stay parallel: a receding/converging floor would contradict
                    the flat wall plane the artwork placement depends on. */}
                {Array.from({ length: seamCount }, (_, i) => i * seamSpacingCm).map((x) => (
                    <rect
                        key={x}
                        x={x}
                        y={floorLineCm + skirtingCm}
                        width="1"
                        height={heightCm - floorLineCm - skirtingCm}
                        fill="#000"
                        opacity="0.13"
                    />
                ))}
            </g>
            {/* Grouped on its own so it's a standalone, independently
                selectable artefact (distinct from the floor/wall it sits
                between) rather than just another leaf shape in the scene. */}
            <g data-artefact="floorboard">
                <rect x={canvasX} y={floorLineCm} width={canvasWidthCm} height={skirtingCm} fill={skirting} />
            </g>

            {/* Furniture sits between the floor and the ambient occlusion below,
                so the wall/floor junction darkens over the bottom of it. */}
            {children}

            {/* Ambient occlusion where wall meets floor — grounds the room. */}
        </svg>
    );
};

export default SceneShell;
