import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ROOM_SCENES } from '../../data/roomScenes';

/**
 * Prev/next arrows for stepping through room scenes one at a time, sitting
 * either side of the visualizer. The position indicator itself lives in
 * SceneDotThumb (top-left corner) rather than here — this component only
 * moves the selection, it doesn't display it.
 */

const OPTIONS = [
    { id: null, name: 'Close-Up' },
    ...ROOM_SCENES.map((s) => ({ id: s.id, name: s.name })),
];

// Close-Up flex-centres the frame in the pane, but a room scene hangs it
// near the top instead (leaving floor space for furniture below) — the two
// don't share a vertical centre. `topPx`, when supplied, is the frame's
// actual measured centre, so the arrows stay level with the artwork instead
// of sitting at a flat 50% that only happens to match Close-Up.
const SceneArrowCarousel = ({ activeId, onSelect, hidden = false, motionClass = '', topPx }) => {
    const index = Math.max(0, OPTIONS.findIndex((o) => o.id === activeId));

    const go = (dir) => {
        const next = (index + dir + OPTIONS.length) % OPTIONS.length;
        onSelect(OPTIONS[next].id);
    };

    const hiddenCls = hidden ? 'opacity-0 pointer-events-none' : 'opacity-100';
    const topStyle = topPx != null ? { top: `${topPx}px` } : undefined;

    return (
        <>
            <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous room"
                style={topStyle}
                className={`absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-30 flex h-9 w-9 items-center justify-center rounded-lg bg-white/65 text-stone-800 backdrop-blur-md transition-all hover:bg-white/80 sm:h-10 sm:w-10 ${motionClass} ${hiddenCls}`}
            >
                <ChevronLeft size={18} strokeWidth={1.6} />
            </button>
            <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next room"
                style={topStyle}
                className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-30 flex h-9 w-9 items-center justify-center rounded-lg bg-white/65 text-stone-800 backdrop-blur-md transition-all hover:bg-white/80 sm:h-10 sm:w-10 ${motionClass} ${hiddenCls}`}
            >
                <ChevronRight size={18} strokeWidth={1.6} />
            </button>
        </>
    );
};

export default SceneArrowCarousel;
