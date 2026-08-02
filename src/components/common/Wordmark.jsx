import React from 'react';
import LogoMark from './LogoMark';

const WORD_FONT = "'Avenir Next', 'Century Gothic', -apple-system, 'Segoe UI', sans-serif";

// Full FrameWorthy wordmark: the drawn LogoMark stands in for the word's own
// first letter — spelling F + "rameWorthy" as one continuous unit rather
// than sitting beside a separately-typed, redundant "F". Set in a bold
// geometric sans instead of the app's usual Playfair Display serif — a
// thin, high-contrast serif doesn't sit well next to a solid drawn
// letterform the way a sturdier grotesk does. The underline under "r" is
// what visually fuses the drawn F into the typed word that follows it.
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
            className={`leading-none ${textClassName}`}
            style={{ fontFamily: WORD_FONT, fontWeight: 800, letterSpacing: '-0.02em', color: ink }}
        >
            <span style={{ textDecoration: 'underline', textDecorationColor: gold, textDecorationThickness: '2px', textUnderlineOffset: '3px' }}>r</span>ameWorthy
        </span>
    </span>
);

export default Wordmark;
