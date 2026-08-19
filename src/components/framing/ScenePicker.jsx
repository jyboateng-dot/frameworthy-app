import React, { useEffect } from 'react';
import { Sofa, Utensils, BedDouble, DoorOpen, Laptop, Square, ChevronDown } from 'lucide-react';
import { ROOM_SCENES } from '../../data/roomScenes';
import { useHoverDropdown } from '../../hooks/useHoverDropdown';

/**
 * Scene selector for the visualizer — a pill + dropdown, mirroring the
 * wall-colour picker (same hover-open behaviour via useHoverDropdown, same
 * pill/panel shape) rather than the horizontal option row this used to be.
 * Sits in the top-left visualizer chrome, where the unit toggle used to be.
 */

const SCENE_ICONS = {
    'studio-loft': Sofa,
    'dining-room': Utensils,
    bedroom: BedDouble,
    entryway: DoorOpen,
    'home-office': Laptop,
};

const OPTIONS = [
    { id: null, name: 'Plain wall', short: 'Plain', wallSpanCm: null, icon: Square },
    ...ROOM_SCENES.map((s) => ({
        id: s.id,
        name: s.name,
        short: {
            'studio-loft': 'Loft',
            'dining-room': 'Dining',
            bedroom: 'Bedroom',
            entryway: 'Entryway',
            'home-office': 'Home Office',
        }[s.id] || s.name,
        wallSpanCm: s.wallSpanCm,
        icon: SCENE_ICONS[s.id] || Square,
    })),
];

const titleFor = (o) => (o.wallSpanCm ? `${o.name} — ${o.wallSpanCm}cm wall` : 'Plain wall with sofa scale cue');

const ScenePicker = ({ activeId, onSelect, autoOpenSignal, className = '', style }) => {
    const { open, setOpen, hoverProps, closeOnSelect } = useHoverDropdown();
    const active = OPTIONS.find((o) => o.id === activeId) || OPTIONS[0];
    const ActiveIcon = active.icon;

    // Opens the picker on its own right after a new image lands — a fresh
    // upload or an Inspiration pick — so a customer who's never noticed this
    // pill sees, unprompted, that other scenes exist. autoOpenSignal is a
    // counter the caller bumps on exactly that event (never on mount, never
    // on the same image's later blob:->Cloudinary URL swap), so 0/undefined
    // on first render intentionally does nothing here.
    //
    // No timer closes this back up — it stays open until the customer
    // actually does something with it: picks a scene, clicks the pill to
    // collapse it, or (hover-capable devices) moves the mouse off it, same
    // as every other hover-dropdown pill in this chrome. A time-based close
    // was closing it while nobody had looked yet on a slower connection or a
    // customer who glanced away for a moment.
    useEffect(() => {
        if (autoOpenSignal) setOpen(true);
    }, [autoOpenSignal, setOpen]);

    return (
        // z-50 while open — above every other pill/chrome element it could
        // otherwise sit behind (they're all z-20 or lower); back to z-20,
        // its resting stacking order, once closed.
        <div className={`relative ${open ? 'z-50' : 'z-20'} ${className}`} style={style} {...hoverProps}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                title={`Scene — ${active.name}`}
                aria-haspopup="true"
                aria-expanded={open}
                className="flex h-[30px] items-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all bg-white/95 backdrop-blur text-stone-700 font-bold text-xs"
            >
                <ActiveIcon size={14} className="shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Scene</span>
                <ChevronDown size={14} className={`transition-transform text-stone-400 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* The Expanded Picker — same shape/motion as the wall-colour
                popover, opening down-left instead of down-right since this
                pill now sits in the top-left corner. */}
            <div
                className={`absolute top-full left-0 mt-[3px] bg-white/95 backdrop-blur shadow-xl border border-stone-100 rounded-xl p-1.5 w-36 origin-top-left transition-all duration-300 ease-out flex flex-col gap-0.5 ${
                    open
                        ? 'opacity-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 -translate-y-2 pointer-events-none'
                }`}
            >
                {OPTIONS.map((o) => {
                    const isActive = o.id === activeId;
                    const Icon = o.icon;
                    return (
                        <button
                            key={o.id ?? 'plain'}
                            type="button"
                            onClick={() => { onSelect(o.id); closeOnSelect(); }}
                            title={titleFor(o)}
                            role="radio"
                            aria-checked={isActive}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${
                                isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                            }`}
                        >
                            <Icon size={14} className="shrink-0" />
                            {o.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ScenePicker;
