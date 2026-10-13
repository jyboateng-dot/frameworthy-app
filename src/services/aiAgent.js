/**
 * FrameWorthy AI Support Agent Service
 * Handles AI-powered customer support in Instant Messaging (IM).
 *
 * Real answers come from the askSupportAgent Cloud Function (a server-side
 * Gemini proxy — the API key and knowledge base never ship to the client).
 * The keyword engine below is the offline/failure fallback.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const HANDOFF_KEYWORDS = ['human', 'agent', 'representative', 'real person', 'speak to staff', 'talk to staff', 'speak to someone', 'talk to someone', 'person', 'call me', 'staff member', 'manager', 'owner', 'operator'];
// \b word-boundary anchors so e.g. 'person' doesn't match inside
// 'personalized', or 'owner' inside 'homeowner' — a plain .includes() check
// matched any of these keywords as a substring of a longer, unrelated word.
const HANDOFF_PATTERNS = HANDOFF_KEYWORDS.map(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));

/**
 * Detects if a customer is requesting a human agent / staff member.
 */
export function isHumanHandoffRequested(userMessage) {
    const text = userMessage || '';
    return HANDOFF_PATTERNS.some(re => re.test(text));
}

/**
 * Smart Local AI Engine
 * Evaluates semantic intent & keywords to provide accurate, specific answers.
 */
export function getLocalAiResponse(userMessage) {
    const text = (userMessage || '').toLowerCase().trim();

    // 1. Specific Canvas & Floater Frames
    if (matchAny(text, ['canvas', 'floater', 'wrapped', 'stretcher', 'floater canvas'])) {
        return "We offer stretched canvas, classic framed canvas, float framed canvas, and eco framed canvas. The customizer shows the sizes and finishes currently available for each style.";
    }

    // 2. Glass, Acrylic & Glazing Options
    if (matchAny(text, ['glass', 'acrylic', 'glazing', 'glare', 'non-glare', 'reflection', 'reflective', 'clear', 'anti-reflective'])) {
        return "Applicable print frames use the glazing shown in the customizer, including Perspex and selected anti-reflective options. Canvas styles do not use glazing.";
    }

    // 3. Matboard Options
    if (matchAny(text, ['mat', 'mats', 'matboard', 'matboards', 'border', 'margin', 'ivory', 'navy', 'cream', 'terracotta', 'burgundy', 'white mat', 'black mat'])) {
        return "Classic and Box frames can be ordered without matting or with Snow White, Off-white, or Black matting where the selected size supports it. Mat width is set automatically for the chosen product size.";
    }

    // 4. Custom Sizes, Dimensions & Pricing
    if (matchAny(text, ['size', 'sizes', 'dimension', 'dimensions', 'width', 'height', 'cm', 'inch', 'inches', 'cost', 'price', 'prices', 'pricing', 'how much', 'rate', 'rates', '5x7', '8x10', 'a4', 'a3', 'a2', 'a1', '12x18', '18x24', '24x36', 'custom', 'small', 'medium', 'large', 'big', 'oversized'])) {
        return "Available sizes come directly from the current made-to-order catalogue and vary by frame style, finish, and destination. Choose a product in the customizer to see its live GBP price.";
    }

    // 5. Frame Styles & Catalogue
    if (matchAny(text, ['style', 'styles', 'frame', 'frames', 'wood', 'gold', 'metal', 'black', 'white', 'ornate', 'antique', 'modern', 'minimalist', 'rustic', 'moulding', 'finish', 'finishes', 'catalogue', 'collection', 'type', 'types', 'choose', 'option', 'options'])) {
        return "Our current collection includes Classic, Box, and Aluminium frames, plus classic framed, float framed, eco framed, and stretched canvas styles.";
    }

    // 6. Photo Upload & Quality Enhancement Engine
    if (matchAny(text, ['upload', 'photo', 'picture', 'image', 'resolution', 'quality', 'dpi', 'enhance', 'blur', 'pixel', 'print', 'printing'])) {
        return "Simply upload the highest quality version of your image available to you! Our backend image processing engine automatically optimizes, sharpens, and enhances your upload for printing. If an image cannot be enhanced to print standards for your requested frame size, our studio team will contact you directly before printing.";
    }

    // 7. Delivery, Shipping & Production Timelines
    if (matchAny(text, ['delivery', 'deliver', 'shipping', 'ship', 'courier', 'time', 'timeline', 'days', 'arrive', 'when', 'location', 'region', 'regions'])) {
        return "The current collection delivers to the United Kingdom and Jersey. Standard delivery and applicable tax are included in the live GBP quote, and the delivery estimate is shown for the selected product.";
    }

    // 8. Payment Methods & Paystack
    if (matchAny(text, ['pay', 'payment', 'payments', 'momo', 'mobile money', 'telecel', 'at money', 'mtn', 'card', 'visa', 'mastercard', 'paystack', 'cedi', 'ghs', 'currency', 'buy', 'checkout'])) {
        return "Prices are currently quoted in GBP. Online payment for this collection is being connected, and checkout clearly shows when payment is not yet available.";
    }

    // 9. Orders & Status
    if (matchAny(text, ['track', 'tracking', 'status', 'order', 'orders', 'my order', 'receipt'])) {
        return "You can check your order status under 'My Orders' in your account menu! Orders are updated step by step: Order Received -> In Production -> Out for Delivery -> Delivered. Checked out as a guest? Use the Order Status page with your order ID and the email you used at checkout.";
    }

    // 10. Location, Physical Address & Phone Contacts
    if (matchAny(text, ['address', 'location', 'where', 'office', 'studio', 'adjiringanor', 'phone', 'contact', 'call', 'email', 'number', 'speak'])) {
        return "Our physical studio is located at No. 17A, Cashew Street, Adjiringanor, Accra, Ghana. You can call our support team at 0261 549 517 / 0501 648 227 (Mon-Sat, 8am-6pm GMT) or email us at admin@frameworthyco.com.";
    }

    // 11. Returns, Cancellations & Damaged Items
    if (matchAny(text, ['return', 'refund', 'cancel', 'cancellation', 'damage', 'damaged', 'broken', 'defect'])) {
        return "Orders can be cancelled for a full refund before production begins. If your frame arrives damaged or incorrect, please notify us within 72 hours with photos so we can arrange a replacement or refund.";
    }

    // 12. Hanging Hardware & Room Visualizer
    if (matchAny(text, ['hang', 'hanging', 'wire', 'hook', 'hardware', 'visualizer', 'visualize', 'preview', 'wall'])) {
        return "Hanging hardware depends on the product and size. The customizer shows the supplied Cobra hook, sawtooth hanger, built-in rear hanger, or that hardware is not included. Wall nails, screws, and plugs are not included.";
    }

    // 13. Curated Art Catalog
    if (matchAny(text, ['curated art', 'inspiration', 'art', 'met', 'museum', 'poster', 'posters', 'album', 'albums'])) {
        return "You can order pre-formatted artwork ready for custom framing from our Curated Art catalog! Collections include Met Museum Classics (Monet, Van Gogh, Hokusai), Prestige Contemporary Art, Vintage Movie Posters, and Iconic Album Covers.";
    }

    // 14. Multi-photo Collage
    if (matchAny(text, ['collage', 'grid', 'multiple photo', 'multiple photos'])) {
        return "We currently focus on handcrafted single-photo custom framing to guarantee museum-grade precision for every print. Multi-photo collage grid layouts are currently in development and will be introduced in an upcoming release!";
    }

    // 15. Greetings & General Inquiries
    if (matchAny(text, ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'help', 'question', 'info'])) {
        return "Hello! 👋 Welcome to FrameWorthy Customer Support. I am your AI Studio Assistant. How can I help you with custom frame styles, sizes, pricing, delivery, or materials today?";
    }

    // Contextual Fallback
    return "Thank you for reaching out to FrameWorthy! I can help with frame styles, available sizes, live GBP prices, matting, glazing, delivery to the United Kingdom or Jersey, and checkout.";
}

// Helper to check if string contains any keyword from list
function matchAny(text, keywords) {
    return keywords.some(k => text.includes(k));
}

/**
 * Generate AI Response
 * Asks the askSupportAgent Cloud Function (server-side Gemini proxy). Falls
 * back to the Smart Local AI Engine if the function is unreachable or errors
 * (offline, signed-out edge cases, upstream outage).
 */
const askSupportAgent = httpsCallable(functions, 'askSupportAgent');

export async function generateAiResponse(userMessage, chatHistory = []) {
    try {
        const history = (chatHistory || [])
            .slice(-6)
            .map(m => ({ senderRole: m.senderRole, text: m.text }));
        const res = await askSupportAgent({ message: userMessage, history });
        const text = res?.data?.text?.trim();
        return text || getLocalAiResponse(userMessage);
    } catch (err) {
        console.warn('Support agent unavailable, using smart fallback engine:', err);
        return getLocalAiResponse(userMessage);
    }
}
