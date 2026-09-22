// Reversible experiment: disable to restore the previous Close-Up sizing.
export const ENABLE_CLOSE_UP_SIZE_PROGRESSION = true;

export function getCloseUpSize({ widthCm, heightCm, outerWidthCm, outerHeightCm, viewportWidth, viewportHeight }) {
    if ([widthCm, heightCm, outerWidthCm, outerHeightCm, viewportWidth, viewportHeight].some(value => !Number.isFinite(value) || value <= 0)) {
        return null;
    }
    // Logarithmic progression keeps small formats inspectable while giving
    // equal proportional size increases equal visual steps. Includes 180×180.
    const minArea = 13 * 18;
    const maxArea = 180 * 180;
    const progress = Math.max(0, Math.min(1, Math.log(widthCm * heightCm / minArea) / Math.log(maxArea / minArea)));
    const occupancy = 0.60 + 0.30 * progress;
    // Use the same safe span for both orientations so rotation cannot resize
    // a frame. Actual outer proportions (including rails) remain unchanged.
    const longSidePx = Math.min(viewportWidth * 0.85, viewportHeight * 0.90) * occupancy;
    const scale = longSidePx / Math.max(outerWidthCm, outerHeightCm);
    return { width: outerWidthCm * scale, height: outerHeightCm * scale };
}
