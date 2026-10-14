import { FRAME_STYLES, CATEGORIES } from './constants';
import { PRODIGI_PRESENTATION } from './prodigiProductPresentation';

export const PRODIGI_FRAME_CATEGORIES = CATEGORIES.filter(category => category.startsWith('Prodigi '));
export const PRODIGI_FRAME_STYLES = FRAME_STYLES.filter(frame => frame.prodigiProduct);
export const DEFAULT_PRODIGI_FRAME = PRODIGI_FRAME_STYLES.find(frame => frame.id === 'prodigi-classic-black') || PRODIGI_FRAME_STYLES[0];

// The original moulding catalogue remains in constants as parked data for a
// possible future return. Customer-facing flows must pass through this helper
// so stale links, saved selections, and curated-art records cannot reopen it.
export function activeFrameOrDefault(frame) {
    if (!frame?.prodigiProduct) return DEFAULT_PRODIGI_FRAME;
    return PRODIGI_FRAME_STYLES.find(item => item.id === frame.id) || DEFAULT_PRODIGI_FRAME;
}

// Editorial selection: distinct profiles and finishes, not a sales ranking.
// Each landing-page batch of 12 includes everyday choices and statement styles.
export const FEATURED_FRAME_IDS = [
    'prodigi-classic-black',
    'prodigi-box-black',
    'prodigi-aluminium-black',
    'prodigi-classic-canvas-black',
    'prodigi-float-canvas-black',
    'prodigi-eco-canvas-black',
    'prodigi-stretched-canvas',
];

export function framesForCategory(category) {
    if (category === 'Featured Frames') {
        return FEATURED_FRAME_IDS.map(id => FRAME_STYLES.find(frame => frame.id === id)).filter(Boolean);
    }
    if (!PRODIGI_FRAME_CATEGORIES.includes(category)) return [];
    return FRAME_STYLES.filter(frame => frame.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }) || a.id.localeCompare(b.id));
}

export function displayCategoryName(category) {
    return category.replace(/^Prodigi /, '');
}

export function displayFrameName(frame) {
    return frame.name.replace(/^(?:Prodigi )?(Classic Canvas|Float Canvas|Eco Canvas|Stretched Canvas|Classic|Box|Aluminium) · /, '');
}

export function categoryForFrame(frame) {
    if (frame?.prodigiProduct) return FRAME_STYLES.find(item => item.id === frame.id)?.category || frame.category || PRODIGI_FRAME_CATEGORIES[0];
    return PRODIGI_FRAME_CATEGORIES[0];
}

export function prodigiPresentationForFrame(frame) {
    return frame?.prodigiProduct ? PRODIGI_PRESENTATION[frame.prodigiProduct] || null : null;
}
