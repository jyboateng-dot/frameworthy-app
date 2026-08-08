// Deduplicated, ascending-by-area view of FRAME_SIZES for the "Find your
// scale" size guide. FRAME_SIZES itself carries ~50 entries because the
// same physical size is aliased under several ids for different contexts
// (e.g. '16x20' / 'lg' / 'Large' are all 40x50cm) — the guide only needs
// one row per real physical size, so this collapses those aliases down to
// ~43 unique sizes, preferring the plain numeric id as the canonical entry.
import { FRAME_SIZES } from './constants';

function canonicalKey(size) {
    const [a, b] = [size.width, size.height].sort((x, y) => x - y);
    return `${a}x${b}`;
}

// Aliases (ids that aren't a plain "WxH"-style measurement) sort after
// numeric ids when picking which entry represents a given physical size —
// keeps e.g. '16x20' as canonical over 'lg'/'Large' for the same 40x50cm.
function isPlainId(id) {
    return /^\d/.test(id);
}

function bestForLabel(width, height) {
    const long = Math.max(width, height);
    const short = Math.min(width, height);
    const aspect = long / short;

    // Narrow/panoramic pieces (e.g. 4x24, 10x60cm) are meant for a specific
    // slim wall segment regardless of overall size — checked before the
    // area-based tiers below since a long, narrow piece would otherwise
    // fall into a "statement wall" tier its actual footprint doesn't match.
    if (aspect >= 2.2) return 'Hallway or narrow wall';

    if (long <= 10) return 'Desk or shelf display';
    if (long <= 18) return 'Bedside wall';
    if (long <= 24) return 'Above a console';
    if (long <= 36) return 'Above a sofa';
    if (long <= 60) return 'Feature wall';
    return 'Statement wall';
}

const byKey = new Map();
for (const size of FRAME_SIZES) {
    const key = canonicalKey(size);
    const existing = byKey.get(key);
    if (!existing || (!isPlainId(existing.id) && isPlainId(size.id))) {
        byKey.set(key, size);
    }
}

export const SIZE_GUIDE_ENTRIES = Array.from(byKey.values())
    .map(size => ({
        ...size,
        bestFor: bestForLabel(size.width, size.height),
    }))
    .sort((a, b) => (a.width * a.height) - (b.width * b.height));

// Reference figures for the scale illustration — matches the convention of
// showing a person and a common piece of furniture at real height so a
// customer can judge physical scale, not just read a number. Heights are
// average adult reference heights in inches.
export const SCALE_REFERENCES = {
    woman: { label: 'Woman', heightIn: 67, heightDisplay: '5\'7" (170cm)' },
    man: { label: 'Man', heightIn: 71, heightDisplay: '5\'11" (180cm)' },
    consoleHeightIn: 32,
    consoleDisplay: '32" (81cm)',
};
