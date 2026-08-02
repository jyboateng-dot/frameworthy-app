import React from 'react';

// The FrameWorthy mark: an "F" built from actual picture-frame moulding
// proportions rather than a typeset letter. The top-left corner is drawn as
// a mitred 45° seam — the same joint every frame corner photo in the
// catalogue is shot from — picked out in the brand's gold instead of being
// typed in a stock serif. `gold` defaults to the brand accent but can be
// overridden to match `ink` for single-color contexts (e.g. a flat badge)
// where a gold-on-gold accent would otherwise disappear.
//
// `tight` swaps the padded 0-100 "badge" viewBox (favicon, chat avatar —
// contexts where the F sits alone and reads better with breathing room)
// for one cropped exactly to the glyph's own bounds. Wordmark contexts pass
// this so the drawn F can sit flush against the "rameWorthy" that follows
// it — as the actual first letter of the word, not an icon beside it —
// without the badge padding throwing off the baseline.
const LogoMark = ({ size = 32, ink = '#0a0a0a', gold = '#c9a84c', className = '', tight = false }) => (
    <svg
        width={size}
        height={size}
        viewBox={tight ? '22 18 56 64' : '0 0 100 100'}
        className={className}
        aria-hidden="true"
        focusable="false"
    >
        {/* One unified silhouette rather than several abutting rects/polygons —
            adjacent shapes each anti-alias independently against the background,
            which leaves a faint seam at their shared edge once rendered large
            (an app icon, not just a 24px nav mark). The gold triangle is then
            painted on top of solid ink instead of next to it, so its edge blends
            into opaque fill either way instead of ever meeting the background. */}
        <path d="M22,18 L78,18 L78,36 L40,36 L40,48 L56,48 L56,65 L40,65 L40,82 L22,82 Z" fill={ink} />
        <polygon points="22,18 40,18 40,36" fill={gold} />
    </svg>
);

export default LogoMark;
