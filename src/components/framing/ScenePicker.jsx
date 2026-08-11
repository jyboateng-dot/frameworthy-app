import React from 'react';
import { Sofa, Utensils, BedDouble, DoorOpen, Laptop, Square, ChevronDown } from 'lucide-react';
import { ROOM_SCENES } from '../../data/roomScenes';
import { useHoverDropdown } from '../../hooks/useHoverDropdown';

/**
 * Standalone scene selector for the visualizer — a dropdown pill stacked
 * directly beneath the wall-colour pill in the top-right corner.
 *
 * Deliberately mirrors that wall-colour popover — same pill, same panel,
 * same open/close motion — because the two are now a pair of backdrop
 * controls in one corner, and reading as siblings is what stops the corner
 * turning into a pile of unrelated buttons. Stacking them here (rather than a
 * strip across the top, which was tried first) is also what leaves the whole
 * top-centre band clear for a tall portrait render.
 */

// Room icons rather than abstract glyphs: the choice being made is "which
// room am I hanging this in", and a sofa/bed/door reads as that instantly at
// 16px where a miniature of the scene itself would only be a silhouette.
const SCENE_ICONS = {
    'studio-loft': Sofa,
    'dining-room': Utensils,
    bedroom: BedDouble,
    entryway: DoorOpen,
    'home-office': Laptop,
};

// `null` id = the default flat wall with the sofa scale cue, which is a real
// option here rather than the absence of one.
const PLAIN = { id: null, name: 'Plain wall', short: 'Plain', icon: Square };

const SHORT_NAMES = {
    'studio-loft': 'Loft',
    'dining-room': 'Dining',
    bedroom: 'Bedroom',
    entryway: 'Entry',
    'home-office': 'Office',
};

const OPTIONS = [
    ...ROOM_SCENES.map((s) => ({
        id: s.id,
        name: s.name,
        short: SHORT_NAMES[s.id] || s.name,
        icon: SCENE_ICONS[s.id] || Square,
        wallSpanCm: s.wallSpanCm,
    })),
    PLAIN,
];

const titleFor = (o) => (o.wallSpanCm ? `${o.name} — ${o.wallSpanCm}cm wall` : 'Plain wall with sofa scale cue');

const ScenePicker = ({ activeId, onSelect, className = '', style }) => {
    const { open, setOpen, hoverProps, closeOnSelect } = useHoverDropdown();

    const active = OPTIONS.find((o) => o.id === activeId) || OPTIONS[0];
    const ActiveIcon = active.icon;

    return (
        <div className={`relative z-20 ${className}`} style={style} {...hoverProps}>
            <button
                // Click still toggles regardless of hover support — it's what
                // opens the panel on touch, and what a keyboard user gets from
                // Enter/Space after Tabbing to the trigger, where no hover
                // event ever fires.
                onClick={() => setOpen((o) => !o)}
                title={`Scene — ${active.name}`}
                aria-haspopup="true"
                aria-expanded={open}
                className="flex h-[30px] items-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all bg-white/95 backdrop-blur text-stone-700 font-bold text-xs ml-auto"
            >
                <ActiveIcon size={14} className="shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">{active.short}</span>
                <ChevronDown size={14} className={`transition-transform text-stone-400 ${open ? 'rotate-180' : ''}`} />
            </button>

            <div
                className={`absolute top-full right-0 mt-[3px] bg-white/95 backdrop-blur shadow-xl border border-stone-100 rounded-xl p-1.5 w-[136px] origin-top-right transition-all duration-300 ease-out flex flex-col gap-0.5 ${
                    open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
                }`}
            >
                {OPTIONS.map((o) => {
                    const Icon = o.icon;
                    const isActive = o.id === activeId;
                    return (
                        <button
                            key={o.id ?? 'plain'}
                            onClick={() => { onSelect(o.id); closeOnSelect(); }}
                            title={titleFor(o)}
                            aria-pressed={isActive}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-colors ${
                                isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                            }`}
                        >
                            <Icon size={13} className="shrink-0" />
                            <span className="truncate">{o.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ScenePicker;
