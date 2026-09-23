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

// Anchor navigation to the pane, independently of frame size or scene placement.
const SceneArrowCarousel = ({ activeId, onSelect, hidden = false, motionClass = '', topPx }) => {
    const index = Math.max(0, OPTIONS.findIndex((o) => o.id === activeId));

    const go = (dir) => {
        const next = (index + dir + OPTIONS.length) % OPTIONS.length;
        onSelect(OPTIONS[next].id);
    };

    const hiddenCls = hidden ? 'opacity-0 pointer-events-none' : 'opacity-100';

    return (
        <>
            <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous room"
                style={{ top: topPx }}
                className={`absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-stone-300/55 bg-white/68 text-stone-900 shadow-[0_2px_8px_rgba(28,25,23,0.12)] backdrop-blur-md transition-[opacity,background-color,box-shadow] hover:bg-white/82 hover:shadow-[0_3px_12px_rgba(28,25,23,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:ring-offset-2 sm:h-10 sm:w-10 ${motionClass} ${hiddenCls}`}
            >
                <ChevronLeft size={18} strokeWidth={1.6} />
            </button>
            <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next room"
                style={{ top: topPx }}
                className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-stone-300/55 bg-white/68 text-stone-900 shadow-[0_2px_8px_rgba(28,25,23,0.12)] backdrop-blur-md transition-[opacity,background-color,box-shadow] hover:bg-white/82 hover:shadow-[0_3px_12px_rgba(28,25,23,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:ring-offset-2 sm:h-10 sm:w-10 ${motionClass} ${hiddenCls}`}
            >
                <ChevronRight size={18} strokeWidth={1.6} />
            </button>
        </>
    );
};

export default SceneArrowCarousel;
