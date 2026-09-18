import React, { useEffect, useRef } from 'react';
import { Square } from 'lucide-react';
import { ROOM_SCENES } from '../../data/roomScenes';

/**
 * Top-left room-scene indicator: a row of small dots, one per scene, where
 * only the active one reveals itself as an actual room-photo thumbnail —
 * everything else stays a minimal dot. As selection moves, the previous
 * active dot shrinks back down and the new one grows into its thumbnail.
 *
 * Replaces both the earlier plain "current room" badge in this corner and
 * SceneArrowCarousel's separate bottom dot strip — this is now the one
 * place that shows which scenes exist and which one you're on, and each
 * dot is still clickable for a direct jump. The active room's name rides
 * alongside the dots, carried over from that earlier badge.
 */

// `short` keeps the pill's footprint down; the full name still carries the
// tooltip/aria-label on each dot, so nothing's lost, just abbreviated.
const SHORT_NAMES = {
    'studio-loft': 'Loft',
    'dining-room': 'Dining',
    'home-office': 'Office',
};

const OPTIONS = [
    { id: null, name: 'Close-Up', short: 'Close-Up' },
    ...ROOM_SCENES.map((s) => ({ id: s.id, name: s.name, short: SHORT_NAMES[s.id] || s.name, image: s.image })),
];

// Applied/removed imperatively so the "try a room scene" hint still has
// something to draw the eye to, without a state update inside an effect.
// Literal class names so Tailwind's scanner keeps them in the build.
const PULSE_CLASSES = ['ring-2', 'ring-stone-900/70', 'ring-offset-1'];

const SceneDotThumb = ({ activeId, onSelect, autoOpenSignal, framePreview, className = '', style }) => {
    const wrapRef = useRef(null);
    const activeOption = OPTIONS.find((o) => o.id === activeId);
    const activeName = activeOption?.short ?? 'Close-Up';

    useEffect(() => {
        if (!autoOpenSignal) return;
        const el = wrapRef.current;
        if (!el) return;
        el.classList.add(...PULSE_CLASSES);
        const t = window.setTimeout(() => el.classList.remove(...PULSE_CLASSES), 900);
        return () => window.clearTimeout(t);
    }, [autoOpenSignal]);

    return (
        <div
            ref={wrapRef}
            role="radiogroup"
            aria-label="Room scene"
            className={`flex items-center gap-[3px] rounded-full border border-stone-200 bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur transition-shadow duration-300 sm:gap-1 ${className}`}
            style={style}
        >
            <span className="whitespace-nowrap pl-0.5 text-[10.5px] font-bold text-stone-700 sm:text-[11px]">
                {activeName}
            </span>
            {OPTIONS.map((o) => {
                const key = o.id ?? 'plain';
                const isActive = o.id === activeId;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(o.id)}
                        title={o.name}
                        role="radio"
                        aria-checked={isActive}
                        aria-label={o.name}
                        // The overshoot easing (a "back out" curve — control
                        // points past 1 mean the box briefly exceeds its
                        // target size) is what makes the new thumbnail
                        // bulge past its resting size and settle back,
                        // rather than just growing straight into place.
                        className={`shrink-0 overflow-hidden rounded-full transition-all duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                            isActive
                                ? 'h-[18px] w-[18px] ring-1 ring-stone-900 sm:h-5 sm:w-5'
                                : 'h-1.5 w-1.5 bg-stone-300 hover:bg-stone-400'
                        }`}
                    >
                        {isActive ? (
                            o.image ? (
                                <span className="relative block h-full w-full">
                                    <img src={o.image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
                                    {/* A small mark for the configured piece —
                                        same size and spot in every scene (see
                                        framePreview's own comment at its call
                                        site for why this is fixed rather than
                                        each room's own real hang point/size). */}
                                    {framePreview && (
                                        <span
                                            aria-hidden="true"
                                            className="absolute -translate-x-1/2 -translate-y-1/2"
                                            style={{
                                                left: `${framePreview.leftPct}%`,
                                                top: `${framePreview.topPct}%`,
                                                width: `${framePreview.widthPct}%`,
                                                aspectRatio: framePreview.aspectRatio,
                                                backgroundColor: framePreview.frameColor,
                                            }}
                                        />
                                    )}
                                </span>
                            ) : (
                                <span className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
                                    <Square size={9} />
                                </span>
                            )
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
};

export default SceneDotThumb;
