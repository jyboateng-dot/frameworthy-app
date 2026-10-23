import { FRAME_STYLES, CATEGORIES } from './constants';
import { PRODIGI_PRESENTATION } from './prodigiProductPresentation';
import { frameRetailPrice } from '../utils/retailPricing';

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

export const CATEGORY_DESCRIPTIONS = {
    'Prodigi Classic Frames': 'Solid, satin-laminated wood with a 20 mm face and 22 mm depth, paired with a premium fine-art print for a timeless, ready-to-hang finish.',
    'Prodigi Box Frames': 'Solid, hand-stained wood with a 20 mm face and 33 mm depth for a clean, contemporary shadow-line look.',
    'Prodigi Aluminium Frames': 'A sleek, lightweight aluminium frame with a slim 10 mm face, shatterproof Perspex and a modern matt finish.',
    'Prodigi Classic Framed Canvas': 'A 38 mm artist-grade cotton canvas set inside a satin-laminated classic frame for a traditional gallery-style look.',
    'Prodigi Float Framed Canvas': 'A 38 mm artist-grade canvas set apart from a slim wooden frame to create a subtle shadow gap and floating effect.',
    'Prodigi Eco Framed Canvas': 'A 38 mm satin canvas made from recycled plastic bottles, set inside a sustainably sourced wood floating frame.',
    'Prodigi Stretched Canvas': 'Heavyweight artist-grade canvas hand-stretched over 38 mm knotless pine bars for clean edges and a minimalist finish.',
};

export function frameCategoryDescription(category) {
    if (!category) return '';
    const key = category.startsWith('Prodigi ') ? category : `Prodigi ${category}`;
    return CATEGORY_DESCRIPTIONS[key] || CATEGORY_DESCRIPTIONS[category] || '';
}

export function displayFrameName(frame) {
    return frame.name.replace(/^(?:Prodigi )?(Classic Canvas|Float Canvas|Eco Canvas|Stretched Canvas|Classic|Box|Aluminium) · /, '');
}

export const FRAME_STARTING_PRICES_GBP = {
    'classic': 16,
    'box': 19,
    'aluminium': 12,
    'canvas-classic': 18,
    'canvas-float': 20,
    'canvas-eco': 17,
    'stretched-canvas': 14,
};

export function frameStartingPrice(frame) {
    if (!frame) return 0;
    return Math.ceil(frameRetailPrice(FRAME_STARTING_PRICES_GBP[frame.prodigiProduct] || 16));
}

export function frameStartingPriceDisplay(frame) {
    return `From £${frameStartingPrice(frame)}`;
}

export function categoryForFrame(frame) {
    if (frame?.prodigiProduct) return FRAME_STYLES.find(item => item.id === frame.id)?.category || frame.category || PRODIGI_FRAME_CATEGORIES[0];
    return PRODIGI_FRAME_CATEGORIES[0];
}

export function prodigiPresentationForFrame(frame) {
    return frame?.prodigiProduct ? PRODIGI_PRESENTATION[frame.prodigiProduct] || null : null;
}
