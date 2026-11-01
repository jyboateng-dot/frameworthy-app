const fs = require('fs');
let content = fs.readFileSync('src/data/constants.jsx', 'utf8');

const newArray = `    // ─── LIVING ROOM ─────────────────────────────
    {
        id: 'living-modern-stock',
        title: 'Modern Family Lounge',
        description: 'A bright, minimalist living room. A sleek black frame anchors the space above a neutral sofa.',
        type: 'frame', room: 'Living Room', mood: 'Modern',
        tags: ['Minimalist', 'Family', 'Statement'],
        previewImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'modern-black', sizeId: 'xl', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'living-warm-stock',
        title: 'Cozy Sunday Morning',
        description: 'Warm tones and soft textures. A diptych layout perfectly complements a relaxed living space.',
        type: 'frame', room: 'Living Room', mood: 'Warm',
        tags: ['Cozy', 'Diptych', 'Warm'],
        previewImage: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'lg', wallTextureId: 'Soft Beige', layout: 'diptych', frameThickness: 'thick' }
    },

    // ─── BEDROOM ─────────────────────────────────
    {
        id: 'bed-luxe-stock',
        title: 'Luxe Bedroom Retreat',
        description: 'A dark, moody master bedroom elevated by a stunning gold triptych above the headboard.',
        type: 'frame', room: 'Bedroom', mood: 'Luxe',
        tags: ['Moody', 'Gold', 'Triptych'],
        previewImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'gold-gilt', sizeId: 'md', wallTextureId: 'Dark Charcoal', layout: 'triptych', frameThickness: 'thin' }
    },
    {
        id: 'bed-cozy-stock',
        title: 'Morning Light',
        description: 'Soft morning light filtering through a bedroom, highlighting a clean white tabletop frame.',
        type: 'frame', room: 'Bedroom', mood: 'Peaceful',
        tags: ['Morning', 'White', 'Tabletop'],
        previewImage: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'classic-white', sizeId: 'tabletop', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thin' }
    },

    // ─── OFFICE ──────────────────────────────────
    {
        id: 'office-pro-stock',
        title: 'The Executive Workspace',
        description: 'A sharp, professional home office featuring a modern silver frame for credentials and awards.',
        type: 'frame', room: 'Office', mood: 'Professional',
        tags: ['Office', 'Professional', 'Silver'],
        previewImage: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'modern-silver', sizeId: 'sm', wallTextureId: 'Slate Grey', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'office-creative-stock',
        title: 'Creative Studio',
        description: 'A vibrant home studio wall using a mosaic layout to display inspiration and mood boards.',
        type: 'frame', room: 'Office', mood: 'Creative',
        tags: ['Studio', 'Mosaic', 'Creative'],
        previewImage: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'modern-black', sizeId: 'sm', wallTextureId: 'Clean White', layout: 'mosaic', frameThickness: 'thin' }
    },

    // ─── NURSERY ─────────────────────────────────
    {
        id: 'nursery-pastel-stock',
        title: 'Pastel Dreams',
        description: 'A soft, pastel-toned nursery room featuring a beautiful oak frame above the crib.',
        type: 'frame', room: 'Nursery', mood: 'Gentle',
        tags: ['Nursery', 'Pastel', 'Oak'],
        previewImage: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'lg', wallTextureId: 'Dusty Rose', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'nursery-play-stock',
        title: 'Playful Colors',
        description: 'Bright white frames pop against a colorful accent wall in this cheerful nursery.',
        type: 'frame', room: 'Nursery', mood: 'Playful',
        tags: ['Playful', 'Colorful', 'White'],
        previewImage: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'classic-white', sizeId: 'md', wallTextureId: 'Sky Blue', layout: 'single', frameThickness: 'thin' }
    },

    // ─── DINING ROOM ─────────────────────────────
    {
        id: 'dining-elegant-stock',
        title: 'Elegant Dining',
        description: 'A formal dining room anchored by a large, dramatic vintage bronze frame.',
        type: 'frame', room: 'Dining Room', mood: 'Elegant',
        tags: ['Formal', 'Bronze', 'Statement'],
        previewImage: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'vintage-bronze', sizeId: 'xl-land', wallTextureId: 'Deep Taupe', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'dining-warm-stock',
        title: 'Family Gathering Space',
        description: 'A warm, inviting dining area perfect for family meals, complemented by rustic oak frames.',
        type: 'frame', room: 'Dining Room', mood: 'Warm',
        tags: ['Gathering', 'Rustic', 'Warm'],
        previewImage: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'lg-land', wallTextureId: 'Soft Beige', layout: 'single', frameThickness: 'thin' }
    },

    // ─── ENTRYWAY ────────────────────────────────
    {
        id: 'entryway-modern-stock',
        title: 'A Grand Welcome',
        description: 'A modern entryway console featuring a striking black frame that sets the tone for the home.',
        type: 'frame', room: 'Entryway', mood: 'Modern',
        tags: ['Entryway', 'Welcome', 'Bold'],
        previewImage: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'modern-black', sizeId: 'lg', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'entryway-gallery-stock',
        title: 'Entryway Memories',
        description: 'A layered arrangement of varied frames welcomes guests with a collage of family memories.',
        type: 'frame', room: 'Entryway', mood: 'Eclectic',
        tags: ['Layered', 'Memories', 'Eclectic'],
        previewImage: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'classic-white', sizeId: 'md', wallTextureId: 'Soft Beige', layout: 'layered', frameThickness: 'thin' }
    },

    // ─── KIDS ROOM ───────────────────────────────
    {
        id: 'kids-art-stock',
        title: 'Little Artist Gallery',
        description: 'A dynamic arrangement celebrating a child’s growing portfolio and creative milestones.',
        type: 'frame', room: 'Kids Room', mood: 'Proud',
        tags: ['Art', 'Milestones', 'Gallery'],
        previewImage: 'https://images.unsplash.com/photo-1491013516836-7db643ee125a?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'classic-white', sizeId: 'sm', wallTextureId: 'Sky Blue', layout: 'mosaic', frameThickness: 'thin' }
    },
    {
        id: 'kids-reading-stock',
        title: 'Reading Nook',
        description: 'Storybook illustrations framed perfectly above a cozy kids reading corner.',
        type: 'frame', room: 'Kids Room', mood: 'Imaginative',
        tags: ['Reading', 'Cozy', 'Illustrations'],
        previewImage: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'md', wallTextureId: 'Dusty Rose', layout: 'single', frameThickness: 'thick' }
    },

    // ─── GALLERY ─────────────────────────────────
    {
        id: 'gallery-travel-stock',
        title: 'Travel & Adventure Wall',
        description: 'A curated gallery wall featuring a layered layout of travel landscapes and adventures.',
        type: 'frame', room: 'Gallery', mood: 'Eclectic',
        tags: ['Travel', 'Adventure', 'Layered'],
        previewImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'modern-black', sizeId: 'lg', wallTextureId: 'Clean White', layout: 'layered', frameThickness: 'thick' }
    },
    {
        id: 'gallery-minimal-stock',
        title: 'Minimalist Gallery',
        description: 'Clean white frames arranged in a precise diptych layout for a minimalist aesthetic.',
        type: 'frame', room: 'Gallery', mood: 'Minimal',
        tags: ['Minimal', 'White', 'Diptych'],
        previewImage: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=800&q=80',
        configuration: { frameStyleId: 'classic-white', sizeId: 'lg', wallTextureId: 'Soft Beige', layout: 'diptych', frameThickness: 'thin' }
    }`;

content = content.replace(/export const INSPIRATION_COLLECTIONS = \[\s*[\s\S]*?\s*\];/m, `export const INSPIRATION_COLLECTIONS = [\n${newArray}\n];`);
fs.writeFileSync('src/data/constants.jsx', content);
