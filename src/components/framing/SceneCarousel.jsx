import React, { useEffect, useRef } from 'react';
import { Square, ChevronLeft, ChevronRight } from 'lucide-react';
import { ROOM_SCENES } from '../../data/roomScenes';

/**
 * Room-scene selector for the visualizer — a horizontally scrolling strip of
 * room-photo thumbnails instead of ScenePicker's pill + dropdown. Picking a
 * room is now a swipe/scroll + tap along one row rather than an open/close
 * step, so every option is visible (and previewable) at once.
 *
 * Same drop-in props as ScenePicker (activeId, onSelect, autoOpenSignal) so
 * it can be swapped in without touching the caller's state wiring.
 */

const OPTIONS = [
    { id: null, name: 'Close-Up' },
    ...ROOM_SCENES.map((s) => ({ id: s.id, name: s.name, image: s.image })),
];

const THUMB_STEP_PX = 52; // thumbnail width + gap, used for arrow-scroll distance

// Applied/removed imperatively (not via React state) so the attention pulse
// is a direct DOM-effect sync rather than a state update inside an effect.
// Written out as literal class names so Tailwind's scanner still picks them
// up even though they're never interpolated into JSX.
const PULSE_CLASSES = ['ring-2', 'ring-stone-900/70', 'ring-offset-1'];

const SceneCarousel = ({ activeId, onSelect, autoOpenSignal, className = '', style }) => {
    const scrollerRef = useRef(null);
    const itemRefs = useRef({});

    // Mirrors ScenePicker's auto-open cue: the "Try a room scene" hint no
    // longer has a dropdown to pop open, so it scrolls the strip into view
    // and gives it a brief attention pulse instead.
    useEffect(() => {
        if (!autoOpenSignal) return;
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollTo({ left: 0, behavior: 'smooth' });
        el.classList.add(...PULSE_CLASSES);
        const t = window.setTimeout(() => el.classList.remove(...PULSE_CLASSES), 900);
        return () => window.clearTimeout(t);
    }, [autoOpenSignal]);

    // Keep the active thumbnail in view when selection changes from
    // elsewhere (e.g. the mobile double-tap return-to-room gesture).
    useEffect(() => {
        itemRefs.current[activeId ?? 'plain']?.scrollIntoView({
            behavior: 'smooth',
            inline: 'nearest',
            block: 'nearest',
        });
    }, [activeId]);

    const scrollByStep = (dir) => {
        scrollerRef.current?.scrollBy({ left: dir * THUMB_STEP_PX * 2, behavior: 'smooth' });
    };

    return (
        <div className={`relative flex items-center gap-1 ${className}`} style={style}>
            <button
                type="button"
                onClick={() => scrollByStep(-1)}
                aria-label="Scroll rooms left"
                className="hidden shrink-0 h-7 w-6 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-400 shadow-sm backdrop-blur transition-colors hover:text-stone-900 sm:flex"
            >
                <ChevronLeft size={14} />
            </button>

            <div
                ref={scrollerRef}
                role="radiogroup"
                aria-label="Room scene"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory rounded-full border border-stone-200/90 bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur transition-shadow duration-300 max-w-[10.5rem] sm:max-w-[13.5rem]"
            >
                {OPTIONS.map((o) => {
                    const key = o.id ?? 'plain';
                    const isActive = o.id === activeId;
                    return (
                        <button
                            key={key}
                            ref={(el) => { itemRefs.current[key] = el; }}
                            type="button"
                            onClick={() => onSelect(o.id)}
                            title={o.name}
                            role="radio"
                            aria-checked={isActive}
                            className={`relative shrink-0 snap-start overflow-hidden rounded-full transition-all ${
                                isActive
                                    ? 'h-8 w-8 ring-2 ring-stone-900 sm:h-9 sm:w-9'
                                    : 'h-7 w-7 opacity-70 hover:opacity-100 sm:h-8 sm:w-8'
                            }`}
                        >
                            {o.image ? (
                                <img src={o.image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
                                    <Square size={13} />
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={() => scrollByStep(1)}
                aria-label="Scroll rooms right"
                className="hidden shrink-0 h-7 w-6 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-400 shadow-sm backdrop-blur transition-colors hover:text-stone-900 sm:flex"
            >
                <ChevronRight size={14} />
            </button>
        </div>
    );
};

export default SceneCarousel;
