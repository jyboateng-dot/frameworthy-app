import React from 'react';
import { Sofa, Utensils, BedDouble, DoorOpen, Laptop, Square, ChevronDown } from 'lucide-react';
import { ROOM_SCENES } from '../../data/roomScenes';
import { ROOM_SCENE_COMPONENTS } from './roomSceneComponents';

/**
 * Standalone scene selector for the visualizer.
 *
 * Lives at bottom-centre, which is the only free region of the pane — the four
 * corners are already the dimensions pill, the wall-colour pill, AR and full
 * screen — and also the quietest band of every scene: the room scenes all draw
 * floor there, and plain-wall mode has nothing below the frame but the sofa
 * cue's caption.
 *
 * Three variants are implemented so they can be compared in place rather than
 * argued about in the abstract. `variant` is read from the `?scenePicker=`
 * query param by the caller; once one is chosen the other two come out.
 */

// Room icons rather than abstract glyphs: the choice being made is "which room
// am I hanging this in", and a sofa/bed/door reads as that instantly at 16px
// where a miniature of the scene itself would only be a silhouette.
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

const options = () => [
    PLAIN,
    ...ROOM_SCENES.map((s) => ({
        id: s.id,
        name: s.name,
        short: SHORT_NAMES[s.id] || s.name,
        icon: SCENE_ICONS[s.id] || Square,
        wallSpanCm: s.wallSpanCm,
        scene: s,
    })),
];

const titleFor = (o) => (o.wallSpanCm ? `${o.name} — ${o.wallSpanCm}cm wall` : 'Plain wall with sofa scale cue');

const SHELL =
    'bg-white/95 backdrop-blur border border-stone-200 rounded-full shadow-sm hover:shadow-md transition-all';

/* ── A. icon rail, active expands ─────────────────────────────────────────
   Mirrors the dimensions pill's own trick (Ruler icon + a width-animated
   in/cm reveal), so the two read as one family of control. Icon-only at
   rest keeps it ~220px, which is what lets it survive a 375px pane. */
const IconRail = ({ items, activeId, onSelect }) => (
    <div className={`flex items-stretch overflow-x-auto max-w-full h-9 ${SHELL} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {items.map((o) => {
            const Icon = o.icon;
            const active = o.id === activeId;
            return (
                <button
                    key={o.id ?? 'plain'}
                    onClick={() => onSelect(o.id)}
                    title={titleFor(o)}
                    aria-label={o.name}
                    aria-pressed={active}
                    className={`shrink-0 flex items-center h-full px-2.5 transition-colors ${
                        active ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                >
                    <Icon size={16} className="shrink-0" />
                    {/* Width-animated rather than mounted/unmounted, so the
                        rail slides between rooms instead of snapping. */}
                    <span
                        className={`overflow-hidden whitespace-nowrap text-[11px] font-semibold transition-all duration-300 ease-out ${
                            active ? 'max-w-[90px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                        }`}
                    >
                        {o.short}
                    </span>
                </button>
            );
        })}
    </div>
);

/* ── B. labelled chip row ─────────────────────────────────────────────────
   Every name visible, no discovery cost. Wider than the pane on a phone, so
   it scrolls — the scrollbar is hidden but the overflow is real. */
const ChipRow = ({ items, activeId, onSelect }) => (
    <div className={`flex items-stretch overflow-x-auto max-w-full h-9 ${SHELL} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {items.map((o) => {
            const active = o.id === activeId;
            return (
                <button
                    key={o.id ?? 'plain'}
                    onClick={() => onSelect(o.id)}
                    title={titleFor(o)}
                    aria-pressed={active}
                    className={`shrink-0 px-3 h-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        active ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                >
                    {o.name}
                </button>
            );
        })}
    </div>
);

/* ── C. live scene thumbnails ─────────────────────────────────────────────
   The actual scene components at ~56px, tinted with the live wall colour, so
   the picker previews exactly what selecting does. Costs six extra mounted
   SVGs that re-render whenever the wall colour changes. */
const ThumbStrip = ({ items, activeId, onSelect, wallHex, isDarkWall }) => (
    <div className={`flex items-center gap-1 p-1 overflow-x-auto max-w-full ${SHELL} !rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {items.map((o) => {
            const Scene = o.id ? ROOM_SCENE_COMPONENTS[o.id] : null;
            const active = o.id === activeId;
            return (
                <button
                    key={o.id ?? 'plain'}
                    onClick={() => onSelect(o.id)}
                    title={titleFor(o)}
                    aria-label={o.name}
                    aria-pressed={active}
                    className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden transition-all ${
                        active ? 'ring-2 ring-stone-900 ring-offset-1 ring-offset-white' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: wallHex }}
                >
                    {/* The scene draws its own wall, so plain-wall is simply the
                        swatch with nothing on it — which is what it is. */}
                    {Scene && <Scene wallHex={wallHex} isDarkWall={isDarkWall} />}
                </button>
            );
        })}
    </div>
);

/* ── D. dropdown pill ─────────────────────────────────────────────────────
   A trigger showing the current scene, opening a list. Unlike the three
   inline treatments this costs one collapsed pill of chrome instead of a
   strip, which is the point: it stacks under the wall-colour pill in the
   corner and leaves the top of the pane clear for tall portrait renders.

   Deliberately mirrors the wall-colour popover it sits beneath — same pill,
   same panel, same open/close motion — because they're now a pair of
   backdrop controls in one corner and reading as siblings is what stops the
   corner turning into a pile of unrelated buttons. */
const Dropdown = ({ items, activeId, onSelect }) => {
    const [open, setOpen] = React.useState(false);
    const active = items.find((o) => o.id === activeId) || items[0];
    const ActiveIcon = active.icon;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                title={`Scene — ${active.name}`}
                aria-haspopup="true"
                aria-expanded={open}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full border border-stone-200 shadow-sm hover:shadow-md transition-all bg-white/95 backdrop-blur text-stone-700 font-semibold text-xs ml-auto"
            >
                <ActiveIcon size={14} className="shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">{active.short}</span>
                <ChevronDown size={14} className={`transition-transform text-stone-400 ${open ? 'rotate-180' : ''}`} />
            </button>

            <div
                className={`absolute top-10 right-0 mt-2 bg-white/95 backdrop-blur shadow-xl border border-stone-100 rounded-xl p-1.5 w-[136px] origin-top-right transition-all duration-300 ease-out flex flex-col gap-0.5 ${
                    open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
                }`}
            >
                {items.map((o) => {
                    const Icon = o.icon;
                    const isActive = o.id === activeId;
                    return (
                        <button
                            key={o.id ?? 'plain'}
                            onClick={() => { onSelect(o.id); setOpen(false); }}
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

const VARIANTS = { icons: IconRail, chips: ChipRow, thumbs: ThumbStrip, dropdown: Dropdown };

const ScenePicker = ({ variant = 'icons', activeId, onSelect, wallHex, isDarkWall, className = '' }) => {
    const Variant = VARIANTS[variant] || IconRail;
    const items = options();

    return (
        // `min-w-0 max-w-full` is load-bearing, not tidiness. This wrapper sits
        // between the toolbar's `min-w-0 flex-1` slot and the variant's own
        // `max-w-full`, and a flex item defaults to `min-width: auto` — it
        // refuses to shrink below its content. Unstyled, this div sized itself
        // to the full six-thumbnail strip, the variant's `max-w-full` resolved
        // against *that* instead of the slot, and at 375px the strip rendered
        // 35→400 in a 375px viewport: it overflowed the screen and the
        // wall-colour button covered the last two scenes, which were then
        // unclickable. Breaking the min-width chain anywhere breaks all of it.
        <div className={`min-w-0 max-w-full ${className}`}>
            <Variant
                items={items}
                activeId={activeId}
                onSelect={onSelect}
                wallHex={wallHex}
                isDarkWall={isDarkWall}
            />
        </div>
    );
};

export default ScenePicker;
