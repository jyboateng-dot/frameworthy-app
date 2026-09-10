import { FRAME_STYLES, CATEGORIES } from './constants';

// Editorial selection: distinct profiles and finishes, not a sales ranking.
// Each landing-page batch of 12 includes everyday choices and statement styles.
export const FEATURED_FRAME_IDS = [
    'frame-8446',  // Flat Black Deep
    'frame-10728', // Flat White Deep
    'frame-10487', // Natural Flat
    'frame-10814', // Classic Mahogany
    'frame-11169', // Gold Flat
    'frame-10779', // Glossy Black
    'frame-8838',  // Antique Gold Ornate
    'frame-8837',  // Antique Silver Ornate
    'frame-11250', // Rustic Natural
    'frame-6540',  // Gold Bamboo with Decorative Edge
    'frame-83736', // Glossy Blue Scoop
    'frame-canvas', // Gallery Wrapped Canvas
    'frame-11114', // Modern Silver
    'frame-10484', // Cherry Flat
    'frame-10592', // Contemporary Walnut
    'frame-8981',  // Traditional Silver
    'frame-10716', // Antique Black Renaissance
    'frame-11234', // White Washed Ornate
    'frame-10569', // Grey Barnwood
    'frame-10874', // Aged Aqua
    'frame-11131', // Hi Gloss Walnut Burl
    'frame-83732', // Glossy Red Scoop
    'frame-9213',  // Textured Black Contemporary
    'frame-10272', // Wide Natural Bamboo
];

export function framesForCategory(category) {
    if (category === 'Featured Frames') {
        return FEATURED_FRAME_IDS.map(id => FRAME_STYLES.find(frame => frame.id === id)).filter(Boolean);
    }
    return FRAME_STYLES.filter(frame => frame.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }) || a.id.localeCompare(b.id));
}

export function categoryForFrame(frame) {
    if (FEATURED_FRAME_IDS.includes(frame?.id)) return 'Featured Frames';
    // Saved carts can contain a category from an earlier catalogue version.
    return FRAME_STYLES.find(item => item.id === frame?.id)?.category || CATEGORIES[0];
}
