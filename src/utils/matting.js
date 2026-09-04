/**
 * Industry-standard mat-width formula, shared by the live visualizer and
 * the order-thumbnail capture so the two never disagree on how wide a
 * "Narrow"/"Standard"/"Wide" mat actually is.
 *
 * Base reveal (top/left/right) scales with the artwork's longest edge,
 * matching the tiers professional framers commonly quote: small prints
 * wear a proportionally thinner mat, larger prints a wider one, so the mat
 * reads as balanced against the art instead of disappearing or
 * overwhelming it.
 *
 * The bottom edge is then widened over that base by MAT_BOTTOM_WEIGHT —
 * the standard "weighted" (or "offset") mat convention in professional
 * framing. A perfectly symmetrical mat makes framed art read as visually
 * sinking toward the bottom edge (the same optical-centering illusion
 * that's why wall-hung art looks better a little above true centre); a
 * wider bottom border compensates for it. Left, right, and top stay equal
 * to each other — only the bottom differs.
 */

const MAT_BOTTOM_WEIGHT = 1.1; // +10% over the base reveal — the standard professional default

const MAT_TABLE = {
    // A 5 × 7 in (13 × 18 cm) print reads overwhelmed by a full 1 in
    // narrow reveal. 5/8 in keeps the narrow option visibly intentional
    // without taking over the small-format artwork.
    small: { narrow: 0.625, standard: 1.5, wide: 2.0 }, // longest edge <= 12in
    medium: { narrow: 1.5, standard: 2.0, wide: 3.0 },  // longest edge <= 20in
    large: { narrow: 2.0, standard: 3.0, wide: 4.0 },   // longest edge > 20in
};

const sizeTier = (maxDimIn) => (maxDimIn <= 12 ? 'small' : maxDimIn <= 20 ? 'medium' : 'large');

// A mat cutter works to 1/8in increments — anything finer isn't cuttable,
// so the bottom-weighted figure is rounded back to that grid rather than
// left as an arbitrary decimal.
const roundToEighth = (inches) => Math.round(inches * 8) / 8;

/**
 * @param {'none'|'narrow'|'standard'|'wide'} matWidthChoice
 * @param {{width: number, height: number}|null|undefined} sizePreset - the print size, in inches
 * @returns {{ topIn: number, sideIn: number, bottomIn: number }} reveal on each edge, in inches.
 *   All zero when matWidthChoice is 'none' or sizePreset is absent.
 */
export function getMatReveal(matWidthChoice, sizePreset) {
    if (matWidthChoice === 'none' || !sizePreset) {
        return { topIn: 0, sideIn: 0, bottomIn: 0 };
    }
    const maxDim = Math.max(sizePreset.width, sizePreset.height);
    const tier = MAT_TABLE[sizeTier(maxDim)];
    const base = tier[matWidthChoice] ?? tier.standard;
    return {
        topIn: base,
        sideIn: base,
        bottomIn: roundToEighth(base * MAT_BOTTOM_WEIGHT),
    };
}
