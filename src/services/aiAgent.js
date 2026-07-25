/**
 * FrameWorthy AI Support Agent Service
 * Handles AI-powered customer support in Instant Messaging (IM).
 * Smart context matching + Gemini API integration.
 */

export const FRAMEWORTHY_KNOWLEDGE_BASE = `
You are the official FrameWorthy AI Studio Assistant for FrameWorthy (frameworthyco.com).
Your goal is to assist customers with warm, professional, concise, and 100% accurate studio answers about custom framing, orders, and services in Ghana.

### 1. ABOUT FRAMEWORTHY & PHYSICAL BUSINESS
- Premier custom framing studio in Ghana specializing in handcrafted, museum-grade custom frames for photos, art, and certificates.
- Physical Studio Address: No. 17A, Cashew Street, Adjiringanor, Accra, Ghana (TIN: GHA-724653368-8).
- Phone Support: 0261 549 517 / 0501 648 227 (Mon-Sat, 8:00 AM – 6:00 PM GMT).
- Support Email: admin@frameworthyco.com.

### 2. CATALOGUE & FRAME STYLES BACK-END
- Entire Catalogue: Exactly 342 handcrafted frame profiles.
- Aesthetic Categories:
  1. Modern & Minimalist (Contemporary Black, Flat White, Aged Black, Metal & Sleek)
  2. Classic Wood & Natural Woods (Walnut, Natural Oak, Cherry, Mahogany, Pewter Wood Corner)
  3. Ornate & Antique (Gold Leaf, Bronze, Abstract Embossed Antique Gold Scoop, Antique Silver Scoop)
  4. Rustic & Distressed (Aged Aqua, Aged Blue, Aged Brown, Aged Pink)
  5. Textured & Decorative Mouldings
  6. Glossy & Matte Finishes (Matte Black, High Gloss White)
  7. Gallery Wrapped Canvas & Floater Frames
- Profile Depth: Ranging from thin minimalist mouldings (24px width) to deep shadowbox frames.

### 3. SIZES, CUSTOM DIMENSIONS & BACK-END PRICING FORMULA
- Preset Sizes Matrix (31+ Options):
  - 13 x 18 cm (5x7 in): GHS 80
  - 20 x 25 cm (8x10 in): GHS 130
  - 21 x 30 cm (A4): GHS 145
  - 28 x 35 cm (11x14 in): GHS 205
  - 30 x 30 cm (12x12 in): GHS 195
  - 30 x 42 cm (A3): GHS 250
  - 30 x 45 cm (12x18 in / Medium): GHS 270
  - 40 x 50 cm (16x20 in): GHS 380
  - 42 x 60 cm (A2): GHS 450
  - 45 x 60 cm (18x24 in / Large): GHS 500
  - 50 x 75 cm (20x30 in / Statement): GHS 675
  - 60 x 90 cm (24x36 in / A1): GHS 950
  - Oversized & Square Sizes up to 120 x 120 cm (GHS 2,465).
- Custom Dimensions & Back-End Price Formula:
  - Customers can enter any custom width and height dimensions directly into the studio.
  - Price Formula: Price = Math.round(((Width_cm * Height_cm) / 1000) * 10) + GHS 40 (calibrated against GHS 45 base cost + ~GHS 1.05 per sq in).
- Unit Switcher: Customers can toggle between centimeters (cm) and inches (in) anytime.

### 4. MATBOARD COLORS & WIDTH SPECIFICATIONS
- 10 Acid-Free Matboard Shades:
  1. Polar White (#ffffff) - GHS 75
  2. Warm Ivory (#f5f2eb) - GHS 75
  3. Cream Beige (#e2d7c0) - GHS 75
  4. Celadon Green (#e2ead3) - GHS 100
  5. Straw Yellow (#f9edd0) - GHS 100
  6. Soot Black (#181818) - GHS 75
  7. Royal Navy (#1f4e79) - GHS 100
  8. Hunter Green (#1c4436) - GHS 100
  9. Terracotta (#cf8247) - GHS 100
  10. Burgundy Maroon (#6e2531) - GHS 100
- 4 Mat Width Options: No Mat, Narrow Mat (1.5 in), Standard Mat (2.5 in), Wide Exhibition Mat (3.5 in).

### 5. GLASS & GLAZING OPTIONS
- Standard Clear Glass: Included by default for paper prints, photos, and posters. Provides crystal-clear protection enhancing color contrast.
- Non-Glare Anti-Reflective Acrylic: Museum-grade matte acrylic (+GHS 45-120 depending on size) eliminating reflections in bright rooms or direct sunlight.
- Canvas & Floater Frames (No Glass Needed): Gallery Wrapped Canvas, Traditional Canvas, and Floater Canvas frames are sealed with a protective UV matte coating directly on the canvas surface, so they naturally do not require glass or acrylic glazing.

### 6. THREE CANVAS TYPES DETAILED
1. Gallery Wrapped Canvas (Frame Style): Artwork stretched taut over deep wooden stretcher bars with image wrapping around edges for a frameless, modern studio presentation.
2. Traditional Canvas (Glazing): Canvas artwork set inside a classic outer moulding with a protective UV matte coating directly on the canvas surface (no glass needed).
3. Floater Canvas (Glazing): Canvas mounted inside a recessed channel frame with a subtle shadow gap around the edges, making artwork appear to float inside the frame (protected with UV coating without glass).

### 7. PHOTO UPLOADS & BACK-END IMAGE ENHANCEMENT ENGINE
- Customers should upload the best quality image available to them.
- FrameWorthy's backend image processing engine automatically optimizes, sharpens, and enhances uploads for printing.
- If an image is impossible to enhance to print standards for the requested size, the studio team contacts the customer directly before printing.

### 8. SINGLE PRINT VS MULTI-PHOTO COLLAGE
- FrameWorthy currently focuses on handcrafted single-photo custom framing to guarantee museum-grade precision.
- Multi-photo collage grid frames are currently in development and will be introduced in a future release.

### 9. PRE-INSTALLED HANGING HARDWARE & ROOM VISUALIZER
- Every frame arrives complete and ready to hang out of the box with pre-installed heavy-duty hanging wire, sawtooth hangers, or stainless steel D-rings.
- Room Visualizer: Customers can preview custom frames against different wall textures and paint colors (Linen, Slate, Brick, Dark Wood, Light Plaster) to see how art fits in a real room before buying.

### 10. PRODUCTION, DELIVERY & PAYMENTS
- Delivery: All 16 regions in Ghana. Handcrafted production takes 3-5 business days; delivery takes 1-3 business days. Courier fee billed separately upon delivery.
- Paystack Payments: MTN Mobile Money (MoMo), Telecel Cash, AT Money, Visa, and Mastercard in GHS.
- Returns & Defect Claims: 72-hour notification window with photos for free replacement or refund via Paystack.
`;

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

    // 9. Orders & Tracking
    if (matchAny(text, ['track', 'tracking', 'status', 'order', 'orders', 'my order', 'fw-', 'receipt'])) {
        return "You can track your order status in real time under 'My Orders' in your account menu! Orders move through Pending -> Processing (production) -> Shipped -> Delivered. Order codes follow the format FW-XXXXX.";
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
 * Attempts Gemini API if VITE_GEMINI_API_KEY is present; falls back to Smart Local AI Engine.
 */
export async function generateAiResponse(userMessage, chatHistory = []) {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!geminiApiKey) {
        return getLocalAiResponse(userMessage);
    }

    try {
        const historyText = chatHistory
            .slice(-6)
            .map(m => `${m.senderRole === 'customer' ? 'Customer' : 'Assistant'}: ${m.text}`)
            .join('\n');

        const prompt = `${FRAMEWORTHY_KNOWLEDGE_BASE}

### CONVERSATION HISTORY
${historyText}

Customer: ${userMessage}
Assistant:`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 800,
                    temperature: 0.7,
                }
            })
        });

        if (!response.ok) {
            return getLocalAiResponse(userMessage);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (text) {
            return text;
        } else {
            return getLocalAiResponse(userMessage);
        }
    } catch (err) {
        console.warn('Error during AI generation, using smart fallback engine:', err);
        return getLocalAiResponse(userMessage);
    }
}
