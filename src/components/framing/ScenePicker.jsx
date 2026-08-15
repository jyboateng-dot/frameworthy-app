import React from 'react';
import { ROOM_SCENES } from '../../data/roomScenes';

/**
 * Scene selector for the visualizer.
 *
 * An expanded horizontal pill that sits in the top chrome between the
 * measurement/unit control and the wall-colour picker. The scene data,
 * scale references, hang points, and rendering stay untouched.
 */

const OPTIONS = [
    { id: null, name: 'Plain wall', short: 'Plain', wallSpanCm: null },
    ...ROOM_SCENES.map((s) => ({
        id: s.id,
        name: s.name,
        short: {
            'studio-loft': 'Loft',
            'dining-room': 'Dining',
            bedroom: 'Bed',
            entryway: 'Entry',
            'home-office': 'Office',
        }[s.id] || s.name,
        wallSpanCm: s.wallSpanCm,
    })),
];

const titleFor = (o) => (o.wallSpanCm ? `${o.name} — ${o.wallSpanCm}cm wall` : 'Plain wall with sofa scale cue');

const ScenePicker = ({ activeId, onSelect, className = '', style }) => (
    <div
        className={`relative z-20 max-w-[calc(100vw-8.5rem)] overflow-hidden rounded-full border border-stone-200 bg-white/95 p-0.5 shadow-sm backdrop-blur ${className}`}
        style={style}
        role="radiogroup"
        aria-label="Room scene"
    >
        <div className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 px-2 text-[9px] font-black uppercase tracking-[0.16em] text-stone-400">
                scene
            </span>
            {OPTIONS.map((o) => {
                const isActive = o.id === activeId;

                return (
                    <button
                        key={o.id ?? 'plain'}
                        type="button"
                        onClick={() => onSelect(o.id)}
                        title={titleFor(o)}
                        role="radio"
                        aria-checked={isActive}
                        className={`h-6 shrink-0 rounded-full px-2 text-[10px] font-black tracking-tight transition-all sm:px-2.5 sm:text-[11px] ${
                            isActive
                                ? 'bg-stone-900 text-white shadow-sm'
                                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                        }`}
                    >
                        {o.short}
                    </button>
                );
            })}
        </div>
    </div>
);

export default ScenePicker;
