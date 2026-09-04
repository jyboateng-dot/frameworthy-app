/**
 * Mat-width math, shared by the live visualizer and the order-thumbnail
 * capture so the two never disagree on how wide a mat actually is.
 *
 * Mat width is a free-form measurement the customer sets directly (a
 * slider, in inches — see the "Matting" section of CustomizeFramePage.jsx,
 * styled after custompictureframes.com's own mat-width slider) rather than
 * a small set of named presets. Older orders placed before this change
 * still have the original 'narrow'/'standard'/'wide' strings stored in
 * Firestore — see itemFormatters.js's matWidthLabel() for how those still
 * display correctly; this file only ever needs to handle the current,
 * numeric shape, since getMatReveal is called from live customization, not
 * from historical order display.
 *
 * The bottom edge is widened over the customer's chosen width by
 * MAT_BOTTOM_WEIGHT — the standard "weighted" (or "offset") mat convention
 * in professional framing. A perfectly symmetrical mat makes framed art
 * read as visually sinking toward the bottom edge (the same optical-
 * centering illusion that's why wall-hung art looks better a little above
 * true centre); a wider bottom border compensates for it. Left, right, and
 * top stay equal to each other — only the bottom differs.
 */

const MAT_BOTTOM_WEIGHT = 1.1; // +10% over the chosen width — the standard professional default

// The slider's own range/step/default — exported so CustomizeFramePage.jsx
// (the only UI that sets this) and this file never drift apart.
export const MAT_WIDTH_MIN_IN = 1;
export const MAT_WIDTH_MAX_IN = 6;
export const MAT_WIDTH_STEP_IN = 0.25;
export const MAT_WIDTH_DEFAULT_IN = 2;

// A mat cutter works to 1/8in increments — anything finer isn't cuttable,
// so the bottom-weighted figure is rounded back to that grid rather than
// left as an arbitrary decimal.
const roundToEighth = (inches) => Math.round(inches * 8) / 8;

export const clampMatWidthIn = (inches) =>
    Math.min(MAT_WIDTH_MAX_IN, Math.max(MAT_WIDTH_MIN_IN, inches));

/**
 * @param {'none'|number} matWidth - 'none' for no mat, otherwise the
 *   customer's chosen width in inches (any value — this doesn't clamp, so
 *   pass an already-clamped number).
 * @param {{width: number, height: number}|null|undefined} sizePreset - unused
 *   for the math itself (width no longer scales with print size — the
 *   customer sets it directly), kept as a parameter only so this still
 *   reads "no mat" for a size-less/placeholder state, matching every
 *   existing call site's expectations.
 * @returns {{ topIn: number, sideIn: number, bottomIn: number }} reveal on
 *   each edge, in inches. All zero when matWidth is 'none', absent, or
 *   sizePreset is absent.
 */
export function getMatReveal(matWidth, sizePreset) {
    if (matWidth === 'none' || matWidth == null || !sizePreset) {
        return { topIn: 0, sideIn: 0, bottomIn: 0 };
    }
    const base = Number(matWidth);
    if (!Number.isFinite(base) || base <= 0) {
        return { topIn: 0, sideIn: 0, bottomIn: 0 };
    }
    return {
        topIn: base,
        sideIn: base,
        bottomIn: roundToEighth(base * MAT_BOTTOM_WEIGHT),
    };
}
