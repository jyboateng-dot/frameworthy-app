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

/**
 * Detects if a customer is requesting a human agent / staff member.
 */
export function isHumanHandoffRequested(userMessage) {
    const text = (userMessage || '').toLowerCase();
    const keywords = ['human', 'agent', 'representative', 'real person', 'speak to staff', 'talk to staff', 'speak to someone', 'talk to someone', 'person', 'call me', 'staff member', 'manager', 'owner', 'operator'];
    return keywords.some(k => text.includes(k));
}

/**
 * Smart Local AI Engine
 * Evaluates semantic intent & keywords to provide accurate, specific answers.
 */
export function getLocalAiResponse(userMessage) {
    const text = (userMessage || '').toLowerCase().trim();

    // 1. Specific Canvas & Floater Frames
    if (matchAny(text, ['canvas', 'floater', 'wrapped', 'stretcher', 'floater canvas'])) {
        return "We offer 3 canvas options: 1) Gallery Wrapped Canvas (frameless 3D wrap over wooden stretcher bars), 2) Traditional Canvas (canvas set inside a classic outer moulding), and 3) Floater Canvas (canvas mounted inside a recessed channel frame with a subtle floating gap). All canvas pieces are sealed with a protective UV matte coating directly on the canvas without glass!";
    }

    // 2. Glass, Acrylic & Glazing Options
    if (matchAny(text, ['glass', 'acrylic', 'glazing', 'glare', 'non-glare', 'reflection', 'reflective', 'clear', 'anti-reflective'])) {
        return "We offer Standard Clear Glass (crystal-clear protection included by default) and Non-Glare Anti-Reflective Acrylic (museum-grade matte coating that eliminates reflections in bright rooms). Canvas & Floater frames use a protective UV matte sealant directly on the canvas without glass.";
    }

    // 3. Matboard Options
    if (matchAny(text, ['mat', 'mats', 'matboard', 'matboards', 'border', 'margin', 'ivory', 'navy', 'cream', 'terracotta', 'burgundy', 'white mat', 'black mat'])) {
        return "We offer 10 acid-free matboard colors (Polar White, Warm Ivory, Cream Beige, Celadon Green, Straw Yellow, Soot Black, Royal Navy, Hunter Green, Terracotta, Burgundy Maroon) and 4 mat width choices: No Mat, Narrow (1.5 in), Standard (2.5 in), or Wide Exhibition (3.5 in).";
    }

    // 4. Custom Sizes, Dimensions & Pricing
    if (matchAny(text, ['size', 'sizes', 'dimension', 'dimensions', 'width', 'height', 'cm', 'inch', 'inches', 'cost', 'price', 'prices', 'pricing', 'how much', 'rate', 'rates', '5x7', '8x10', 'a4', 'a3', 'a2', 'a1', '12x18', '18x24', '24x36', 'custom', 'small', 'medium', 'large', 'big', 'oversized'])) {
        if (text.includes('custom')) {
            return "You can enter any custom width and height dimensions directly into our customizer studio! Custom pricing is calculated transparently based on your artwork's dimensions starting from GHS 80 for small desktop sizes up to GHS 950 for 24x36 in (A1) and GHS 2,465 for statement 120x120 cm pieces.";
        }
        return "We offer 31+ preset sizes ranging from small desktop frames (13x18 cm / 5x7 in at GHS 80), 20x25 cm (GHS 130), A4 (GHS 145), 30x45 cm (GHS 270), up to 60x90 cm A1 (GHS 950) and 120x120 cm. You can also enter custom dimensions and toggle between cm and inches anytime!";
    }

    // 5. Frame Styles & Catalogue
    if (matchAny(text, ['style', 'styles', 'frame', 'frames', 'wood', 'gold', 'metal', 'black', 'white', 'ornate', 'antique', 'modern', 'minimalist', 'rustic', 'moulding', 'finish', 'finishes', 'catalogue', 'collection', 'type', 'types', 'choose', 'option', 'options'])) {
        return "Our catalogue features 342 handcrafted frame profiles categorized into Modern & Minimalist, Classic Wood & Natural Woods (Walnut, Oak, Mahogany), Ornate & Antique (Gold Leaf, Bronze), Rustic & Distressed, Metal & Sleek, Glossy Finishes, and Gallery Canvas Floaters! You can also select profile depths ranging from thin profiles to deep shadowboxes.";
    }

    // 6. Photo Upload & Quality Enhancement Engine
    if (matchAny(text, ['upload', 'photo', 'picture', 'image', 'resolution', 'quality', 'dpi', 'enhance', 'blur', 'pixel', 'print', 'printing'])) {
        return "Simply upload the highest quality version of your image available to you! Our backend image processing engine automatically optimizes, sharpens, and enhances your upload for printing. If an image cannot be enhanced to print standards for your requested frame size, our studio team will contact you directly before printing.";
    }

    // 7. Delivery, Shipping & Production Timelines
    if (matchAny(text, ['delivery', 'deliver', 'shipping', 'ship', 'courier', 'ghana', 'accra', 'kumasi', 'takoradi', 'tamale', 'time', 'timeline', 'days', 'arrive', 'when', 'location', 'region', 'regions'])) {
        return "We deliver across all 16 regions in Ghana! Every frame is handcrafted to custom specifications in 3 to 5 business days, and delivery takes 1 to 3 business days. Delivery fees are billed separately and paid directly to our courier partner upon arrival.";
    }

    // 8. Payment Methods & Paystack
    if (matchAny(text, ['pay', 'payment', 'payments', 'momo', 'mobile money', 'telecel', 'at money', 'mtn', 'card', 'visa', 'mastercard', 'paystack', 'cedi', 'ghs', 'currency', 'buy', 'checkout'])) {
        return "We accept payments in GHS securely via Paystack! You can pay using MTN Mobile Money, Telecel Cash, AT Money, or any Visa/Mastercard. All transactions are protected with bank-level 256-bit encryption.";
    }

    // 9. Orders & Status
    if (matchAny(text, ['track', 'tracking', 'status', 'order', 'orders', 'my order', 'receipt'])) {
        return "You can check your order status under 'My Orders' in your account menu! Orders are updated step by step: Order Received -> In Production -> Out for Delivery -> Delivered. Checked out as a guest? Use the Order Status page with your order ID and the email you used at checkout.";
    }

    // 10. Location, Physical Address & Phone Contacts
    if (matchAny(text, ['address', 'location', 'where', 'office', 'studio', 'adjiringanor', 'phone', 'contact', 'call', 'email', 'number', 'speak'])) {
        return "Our physical studio is located at No. 17A, Cashew Street, Adjiringanor, Accra, Ghana (TIN: GHA-724653368-8). You can call our support team at 0261 549 517 / 0501 648 227 (Mon-Sat, 8am-6pm GMT) or email us at admin@frameworthyco.com.";
    }

    // 11. Returns, Cancellations & Damaged Items
    if (matchAny(text, ['return', 'refund', 'cancel', 'cancellation', 'damage', 'damaged', 'broken', 'defect'])) {
        return "Orders can be cancelled for a full refund before production begins. If your frame arrives damaged or incorrect, please notify us within 72 hours with photos of the issue, and we will arrange a free replacement or a full refund via Paystack!";
    }

    // 12. Hanging Hardware & Room Visualizer
    if (matchAny(text, ['hang', 'hanging', 'wire', 'hook', 'hardware', 'visualizer', 'visualize', 'preview', 'wall'])) {
        return "Every frame arrives 100% ready to hang out of the box with pre-installed heavy-duty hanging wire, sawtooth hangers, or stainless steel D-rings! You can also use our Room Visualizer in the customizer to preview your frame against different wall colors and textures.";
    }

    // 13. Inspiration Catalog
    if (matchAny(text, ['inspiration', 'art', 'met', 'museum', 'poster', 'posters', 'album', 'albums'])) {
        return "You can order pre-formatted artwork ready for custom framing from our Inspiration catalog! Collections include Met Museum Classics (Monet, Van Gogh, Hokusai), Prestige Contemporary Art, Vintage Movie Posters, and Iconic Album Covers.";
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
    return "Thank you for reaching out to FrameWorthy! I am your AI Studio Assistant. I can help you with custom frame styles, sizing, prices in GHS, matboards, glass vs canvas glazing, delivery across Ghana, or payments. What can I assist you with today?";
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
