/**
 * Mat-width math, shared by the live visualizer and the order-thumbnail
 * capture so the two never disagree on how wide a mat actually is.
 *
 * EXPERIMENTAL (2026-09-04): mat width is a free-form slider the customer
 * drags directly (styled after custompictureframes.com's own mat-width
 * picker), not the three fixed 'narrow'/'standard'/'wide' presets this
 * replaced. The user is still trying this out — it may get reverted back
 * to presets, so keep this file's change self-contained and easy to
 * back out of the same way it went in.
 *
 * The slider itself is index-based (0, 1, 2, ...), not a plain inches
 * value, because the very first step off "no mat" must land exactly on 1in
 * — not 0.25in — per the spec: index 0 is No Mat, index 1 is 1.00in, and
 * every index after that adds MAT_WIDTH_STEP_IN, up to MAT_WIDTH_MAX_IN at
 * the top of the track. A plain 0-to-8-by-0.25 range would instead pass
 * through 0.25/0.5/0.75 on the way to 1 — sliderIndexToMatWidth/
 * matWidthToSliderIndex below are what make that jump possible while still
 * using a plain, evenly-stepped range input under the hood.
 *
 * Older orders placed before this change still have the original
 * 'narrow'/'standard'/'wide' strings stored in Firestore — see
 * itemFormatters.js's matWidthLabel() for how those still display
 * correctly; this file only ever needs to handle the current, numeric
 * shape, since getMatReveal is called from live customization, not from
 * historical order display.
 *
 * The selected width is the physical reveal on every edge. Keeping all four
 * sides equal makes the customer-facing value unambiguous for production.
 */

// The slider's own range/step/default — exported so CustomizeFramePage.jsx
// (the only UI that sets this) and this file never drift apart.
export const MAT_WIDTH_MIN_IN = 1;
export const MAT_WIDTH_MAX_IN = 8;
export const MAT_WIDTH_STEP_IN = 0.25;
export const MAT_WIDTH_DEFAULT_IN = 2;

// Index-space bounds for the <input type="range"> itself: 0 is "No Mat",
// MAT_WIDTH_MAX_INDEX is MAT_WIDTH_MAX_IN. Plain integer steps in between —
// the inch math happens in sliderIndexToMatWidth, not in the slider's own
// min/max/step attributes.
export const MAT_WIDTH_MAX_INDEX = 1 + Math.round((MAT_WIDTH_MAX_IN - MAT_WIDTH_MIN_IN) / MAT_WIDTH_STEP_IN);

export const clampMatWidthIn = (inches) =>
    Math.min(MAT_WIDTH_MAX_IN, Math.max(MAT_WIDTH_MIN_IN, inches));

// Must match the safety clamp CustomizeFramePage.jsx applies to the
// rendered mat percentage (matPctW/matPctTop/matPctBottom) — that clamp
// stops the on-screen mat from swallowing the artwork on a small print,
// but by itself it only affects the DRAWING. It never touched the
// customer's chosen matWidth number, so without maxMatWidthForSize below,
// a customer could pick a mat wide enough to trigger that clamp, see a
// smaller, clamped mat on screen, and still have the raw, un-clamped
// width sent to the production house — a mat that looks nothing like
// what they approved. maxMatWidthForSize caps the SLIDER at the same
// threshold instead, so whatever the customer can select is guaranteed
// to render without clamping and to match exactly what ships.
export const MAT_RENDER_MAX_PCT = 45;

/**
 * The largest mat width (in inches, snapped to the slider's own
 * quarter-inch steps) this print size + frame moulding can take before
 * the render clamp above would kick in. Mirrors the clamp's math — the
 * tightest frame axis is the binding constraint — without needing to be pixel-exact;
 * this only has to be a safe, same-ballpark cap for a slider limit, not
 * a re-derivation of the live render.
 */
export function maxMatWidthForSize(wInch, hInch, railWidthIn) {
    if (!wInch || !hInch) return MAT_WIDTH_MAX_IN;
    const widthOuterIn = wInch + 2 * railWidthIn;
    const heightOuterIn = hInch + 2 * railWidthIn;
    const widthLimitIn = (MAT_RENDER_MAX_PCT / 100) * widthOuterIn - railWidthIn;
    const bottomLimitIn = (MAT_RENDER_MAX_PCT / 100) * heightOuterIn - railWidthIn;
    const limitIn = Math.min(widthLimitIn, bottomLimitIn);
    const steppedDownIn = Math.floor((limitIn - MAT_WIDTH_MIN_IN) / MAT_WIDTH_STEP_IN) * MAT_WIDTH_STEP_IN + MAT_WIDTH_MIN_IN;
    return clampMatWidthIn(steppedDownIn);
}

/** Slider position (0..MAT_WIDTH_MAX_INDEX) -> matWidth ('none' or inches). */
export function sliderIndexToMatWidth(index) {
    if (index <= 0) return 'none';
    return Math.round((MAT_WIDTH_MIN_IN + (index - 1) * MAT_WIDTH_STEP_IN) * 100) / 100;
}

/** matWidth ('none' or inches, including a legacy preset string) -> slider position. */
export function matWidthToSliderIndex(matWidth) {
    if (matWidth === 'none' || matWidth == null) return 0;
    const inches = clampMatWidthIn(Number(matWidth) || MAT_WIDTH_DEFAULT_IN);
    return 1 + Math.round((inches - MAT_WIDTH_MIN_IN) / MAT_WIDTH_STEP_IN);
}

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
        bottomIn: base,
    };
}
