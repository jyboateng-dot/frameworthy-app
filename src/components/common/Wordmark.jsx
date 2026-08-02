import React from 'react';
import LogoMark from './LogoMark';

// Full FrameWorthy wordmark: the drawn LogoMark stands in for the word's own
// first letter — F (drawn) + "rameWorthy" (typed) as one continuous unit,
// not an icon sitting beside a redundant typed word. Set in the app's own
// Outfit (font-sans) at its heaviest weight rather than a font invented just
// for this — the drawn F is geometric and flat-shaded with no serifs, so it
// belongs with the same structural sans used everywhere else in the UI, not
// a third, unrelated voice introduced only for the logo. Proximity, shared
// weight, and a common baseline are what fuse the two — no separate
// connector device needed.
//
// `size` sets the LogoMark's base pixel size (and should match the text's
// smallest-breakpoint font-size); `textClassName` carries the actual
// Tailwind font-size classes (e.g. "text-base sm:text-xl") so the two stay
// in step at each breakpoint — pass matching `sm:w-[..px] sm:h-[..px]` via
// `markClassName` when the text size is responsive.
const Wordmark = ({
    size = 20,
    ink = '#e8e2d9',
    gold = '#c9a84c',
    className = '',
    textClassName = '',
    markClassName = '',
}) => (
    <span className={`inline-flex items-baseline ${className}`}>
        <LogoMark tight size={size} ink={ink} gold={gold} className={`shrink-0 ${markClassName}`} />
        <span
            className={`font-sans font-extrabold tracking-tight leading-none ${textClassName}`}
            style={{ color: ink }}
        >
            rameWorthy
        </span>
    </span>
);

export default Wordmark;
