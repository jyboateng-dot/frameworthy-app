import React from 'react';

// The FrameWorthy mark: an "F" built from actual picture-frame moulding
// proportions rather than a typeset letter. The top-left corner is drawn as
// a mitred 45° seam — the same joint every frame corner photo in the
// catalogue is shot from — picked out in the brand's gold instead of being
// typed in a stock serif. `gold` defaults to the brand accent but can be
// overridden to match `ink` for single-color contexts (e.g. a flat badge)
// where a gold-on-gold accent would otherwise disappear.
const LogoMark = ({ size = 32, ink = '#0a0a0a', gold = '#c9a84c', className = '' }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={className}
        aria-hidden="true"
        focusable="false"
    >
        <polygon points="22,18 40,18 40,36" fill={gold} />
        <polygon points="22,18 22,36 40,36" fill={ink} />
        <rect x="22" y="36" width="18" height="46" fill={ink} />
        <rect x="40" y="18" width="38" height="18" fill={ink} />
        <rect x="22" y="48" width="34" height="17" fill={ink} />
    </svg>
);

export default LogoMark;
