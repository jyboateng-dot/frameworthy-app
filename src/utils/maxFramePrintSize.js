import { MIN_PRINT_DPI, doesSizeMeetMinDpi } from './museumArtwork';

// Every distinct framed-print glazing size offered by the Prodigi Classic and
// Box frame families (all mount/glaze variants), as `inches|cm`. Kept as a
// compact static list so collection grids don't have to load and parse the
// multi-megabyte prodigiCatalog.json just to label thumbnails;
// maxFramePrintSize.test.js fails if this ever drifts from the catalogue.
export const FRAMED_PRINT_SIZES = [
    '5x7|13x18', '5.8x8.3|14.8x21', '6x8|15x20', '8x8|20x20', '8x10|20x25', '8x12|20x30',
    '8x16|20x40', '8.3x11.7|21x29.7', '9x12|22x30', '9x18|23x45', '10x10|25x25', '10x12|25x30',
    '10x20|25x50', '10x30|25x75', '11x11|28x28', '11x14|28x35.5', '11x17|28x43', '11.4x16.5|29x42',
    '11.7x16.5|29.7x42', '12x12|30x30', '12x15|30.5x38.1', '12x16|30x40', '12x17|29x42',
    '12x18|30x45', '12x24|30x60', '12x36|30x90', '13x19|33x48', '14x14|36x36', '14x24|35x60',
    '15x20|38x50', '16x16|40x40', '16x20|40x50', '16x24|40x60', '16x32|40x80', '16x36|40x90',
    '16.5x23.4|42x59.4', '17x23|42x59', '17x35|43x88', '18x18|45x45', '18x24|45x60', '18x36|45x90',
    '20x20|50x50', '20x24|51x61', '20x28|50x70', '20x30|50x75', '20x36|50x91', '20x40|50x101',
    '22x28|55.9x71.1', '22x40|55.88x101.6', '23x33|59x84', '23.4x33.1|59.4x84.1', '24x24|60x60',
    '24x30|60x76', '24x31|60x80', '24x32|60x80', '24x36|60x90', '28x28|70x70', '28x40|70x100',
    '28x42|71x106', '28x44|70x112', '28x56|71x142', '30x30|75x75', '30x32|76x81', '30x34|76x86',
    '30x40|75x100', '30x42|75x107', '30x45|76x114', '30x60|76x152', '32x32|80x80', '32x40|81x101',
    '32x48|81x121', '33.1x46.8|84.1x118.9', '36x36|90x90', '36x48|91x121', '36x55|91x139',
    '39x52|99x132', '40x40|102x102', '40x50|101x127', '40x52|101x132', '40x60|102x152',
    '42x56|106x142', '45x60|114x152', '50x50|127x127',
].map((entry) => {
    const [inches, cm] = entry.split('|');
    const [width, height] = inches.split('x').map(Number);
    return { width, height, inches, cm, label: `${inches}" · ${cm}cm` };
});

// How far a frame's aspect ratio may differ from the artwork's before it no
// longer counts as a fit for that artwork (it would crop away too much).
const MAX_ASPECT_DIFFERENCE = 0.12;

const shortLongRatio = (w, h) => Math.min(w, h) / Math.max(w, h);

/**
 * The largest framed-print size this artwork can be printed at while staying
 * at or above the 150 DPI print floor, preferring sizes whose proportions
 * match the artwork. Returns null when the source resolution is unknown.
 */
export function maxFramePrintSize(pixelSize, minDpi = MIN_PRINT_DPI) {
    const w = Number(pixelSize?.w ?? pixelSize?.width);
    const h = Number(pixelSize?.h ?? pixelSize?.height);
    if (!(w > 0 && h > 0)) return null;

    const artworkRatio = shortLongRatio(w, h);
    const printable = FRAMED_PRINT_SIZES.filter((size) => doesSizeMeetMinDpi(size, { w, h }, minDpi));
    if (!printable.length) return null;

    const matching = printable.filter((size) =>
        Math.abs(shortLongRatio(size.width, size.height) - artworkRatio) / artworkRatio <= MAX_ASPECT_DIFFERENCE);
    const pool = matching.length ? matching : printable;
    const largest = pool.reduce((best, size) =>
        (size.width * size.height > best.width * best.height ? size : best));

    const orientation = w > h * 1.02 ? 'landscape' : h > w * 1.02 ? 'portrait' : 'square';
    return { ...largest, orientation };
}
