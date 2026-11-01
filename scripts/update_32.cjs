const fs = require('fs');
let content = fs.readFileSync('src/data/constants.jsx', 'utf8');

const newArray = `    // ─── LIVING ROOM ─────────────────────────────
    {
        id: 'living-modern',
        title: 'Ghanaian Wedding Glow',
        description: 'A beautiful modern living room in Ghana featuring a large, elegant framed picture of a happy couple in traditional Kente attire.',
        type: 'frame', room: 'Living Room', mood: 'Modern',
        tags: ['Wedding', 'Kente', 'Statement'],
        previewImage: '/inspiration/living_room_ghana_wedding_1778431713765.png',
        configuration: { frameStyleId: 'modern-black', sizeId: 'xl', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'living-family',
        title: 'Family Gathering',
        description: 'A stylish diptych frame displaying a joyful Ghanaian family gathering in a high-end modern living space.',
        type: 'frame', room: 'Living Room', mood: 'Warm',
        tags: ['Family', 'Diptych', 'Gathering'],
        previewImage: '/inspiration/living_room_ghana_family_1778432426813.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'lg', wallTextureId: 'Soft Beige', layout: 'diptych', frameThickness: 'thin' }
    },
    {
        id: 'living-art',
        title: 'Contemporary African Art',
        description: 'A chic modern living room displaying a single bold framed contemporary African artwork.',
        type: 'frame', room: 'Living Room', mood: 'Chic',
        tags: ['Art', 'Statement', 'Bold'],
        previewImage: '/inspiration/living_ghana_art_1778883519084.png',
        configuration: { frameStyleId: 'modern-black', sizeId: 'xl', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'living-elders',
        title: 'Ghanaian Elders',
        description: 'A traditional yet modern living room featuring a diptych of Ghanaian elders in rich traditional wear.',
        type: 'frame', room: 'Living Room', mood: 'Traditional',
        tags: ['Elders', 'Heritage', 'Kente'],
        previewImage: '/inspiration/living_ghana_elders_1778883535937.png',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'lg', wallTextureId: 'Warm Terracotta', layout: 'diptych', frameThickness: 'thin' }
    },

    // ─── BEDROOM ─────────────────────────────────
    {
        id: 'bed-dark-luxe',
        title: 'Graduation Pride',
        description: 'A luxurious bedroom elegantly displaying a framed graduation portrait of a young Ghanaian woman in her gown.',
        type: 'frame', room: 'Bedroom', mood: 'Luxe',
        tags: ['Graduation', 'Milestone', 'Luxe'],
        previewImage: '/inspiration/bedroom_ghana_grad_1778431800272.png',
        configuration: { frameStyleId: 'gold-gilt', sizeId: 'lg', wallTextureId: 'Dark Charcoal', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'bed-couple',
        title: 'Romantic Getaway',
        description: 'A cozy bedroom retreat featuring a romantic triptych of a Ghanaian couple at the beach.',
        type: 'frame', room: 'Bedroom', mood: 'Romantic',
        tags: ['Couple', 'Triptych', 'Beach'],
        previewImage: '/inspiration/bedroom_ghana_couple_1778432471838.png',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'md', wallTextureId: 'Soft Beige', layout: 'triptych', frameThickness: 'thin' }
    },
    {
        id: 'bed-maternity',
        title: 'Maternity Glow',
        description: 'A warm, cozy bedroom featuring a triptych of a beautiful Ghanaian maternity photoshoot.',
        type: 'frame', room: 'Bedroom', mood: 'Warm',
        tags: ['Maternity', 'Triptych', 'Family'],
        previewImage: '/inspiration/bedroom_ghana_maternity_1778883547903.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'lg', wallTextureId: 'Dusty Rose', layout: 'triptych', frameThickness: 'thin' }
    },
    {
        id: 'bed-fashion',
        title: 'Modern Fashion',
        description: 'A modern fashion-forward bedroom with a single large statement frame showing a stylish young Ghanaian woman.',
        type: 'frame', room: 'Bedroom', mood: 'Fashion',
        tags: ['Fashion', 'Bold', 'Portrait'],
        previewImage: '/inspiration/bedroom_ghana_fashion_1778883572645.png',
        configuration: { frameStyleId: 'modern-black', sizeId: 'xl', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thick' }
    },

    // ─── OFFICE ──────────────────────────────────
    {
        id: 'office-album',
        title: 'Afrobeats Album Art',
        description: 'A sleek modern home office with a bold, wide square frame displaying vibrant Ghanaian Afrobeats album art.',
        type: 'frame', room: 'Office', mood: 'Creative',
        tags: ['Music', 'Bold', 'Creative'],
        previewImage: '/inspiration/office_ghana_album_1778432491375.png',
        configuration: { frameStyleId: 'modern-black', sizeId: 'md', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'office-milestone',
        title: 'Professional Milestone',
        description: 'A thin, modern silver frame cleanly displaying a professional award for a Ghanaian businessman.',
        type: 'frame', room: 'Office', mood: 'Minimal',
        tags: ['Award', 'Professional', 'Minimal'],
        previewImage: '/inspiration/office_ghana_milestone_1778432510303.png',
        configuration: { frameStyleId: 'modern-silver', sizeId: 'sm', wallTextureId: 'Slate Grey', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'office-kente',
        title: 'Kente Heritage',
        description: 'A sleek home office featuring a framed authentic Kente cloth textile piece.',
        type: 'frame', room: 'Office', mood: 'Heritage',
        tags: ['Kente', 'Textile', 'Heritage'],
        previewImage: '/inspiration/office_ghana_kente_1778883595835.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'lg', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'office-team',
        title: 'Startup Team',
        description: 'A modern office space featuring a mosaic of framed photos of a successful Ghanaian startup team.',
        type: 'frame', room: 'Office', mood: 'Professional',
        tags: ['Team', 'Startup', 'Mosaic'],
        previewImage: '/inspiration/office_ghana_team_1778883611690.png',
        configuration: { frameStyleId: 'modern-silver', sizeId: 'md', wallTextureId: 'Soft Beige', layout: 'mosaic', frameThickness: 'thin' }
    },

    // ─── NURSERY ─────────────────────────────────
    {
        id: 'nursery-baby',
        title: 'Newborn Sweetness',
        description: 'A cozy, sunlit nursery room featuring a beautifully framed portrait of a smiling newborn African baby in warm pastel tones.',
        type: 'frame', room: 'Nursery', mood: 'Warm',
        tags: ['Newborn', 'Nursery', 'Family'],
        previewImage: '/inspiration/nursery_ghana_baby_1778431736189.png',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'md', wallTextureId: 'Soft Beige', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'nursery-shower',
        title: 'Joyous Baby Shower',
        description: 'A classic mosaic gallery wall showing photos from a joyous Ghanaian baby shower in a pastel nursery aesthetic.',
        type: 'frame', room: 'Nursery', mood: 'Pastel',
        tags: ['Shower', 'Mosaic', 'Memories'],
        previewImage: '/inspiration/nursery_ghana_shower_1778432544309.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'md', wallTextureId: 'Dusty Rose', layout: 'mosaic', frameThickness: 'thick' }
    },
    {
        id: 'nursery-naming',
        title: 'Naming Ceremony',
        description: 'A softly lit nursery displaying a photo from a traditional Ghanaian naming ceremony.',
        type: 'frame', room: 'Nursery', mood: 'Traditional',
        tags: ['Outdooring', 'Ceremony', 'Family'],
        previewImage: '/inspiration/nursery_ghana_naming_1778883625251.png',
        configuration: { frameStyleId: 'gold-gilt', sizeId: 'sm', wallTextureId: 'Soft Beige', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'nursery-twins',
        title: 'Adorable Twins',
        description: 'A colorful nursery with a diptych frame arrangement of adorable Ghanaian twins.',
        type: 'frame', room: 'Nursery', mood: 'Playful',
        tags: ['Twins', 'Colorful', 'Diptych'],
        previewImage: '/inspiration/nursery_ghana_twins_1778883638609.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'md', wallTextureId: 'Sky Blue', layout: 'diptych', frameThickness: 'thin' }
    },

    // ─── DINING ROOM ─────────────────────────────
    {
        id: 'dining-dinner',
        title: 'Family Dinner',
        description: 'An elegant dining room featuring a large statement frame with a wide border showing a lively family dinner.',
        type: 'frame', room: 'Dining Room', mood: 'Elegant',
        tags: ['Dinner', 'Statement', 'Elegant'],
        previewImage: '/inspiration/dining_room_ghana_dinner_1778432558170.png',
        configuration: { frameStyleId: 'vintage-bronze', sizeId: 'xl-land', wallTextureId: 'Dark Charcoal', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'dining-capecoast',
        title: 'Cape Coast Castle',
        description: 'A formal dining setup with a beautifully framed landscape photo of the historic Cape Coast Castle.',
        type: 'frame', room: 'Dining Room', mood: 'Historic',
        tags: ['Landscape', 'History', 'Gold'],
        previewImage: '/inspiration/dining_room_ghana_cc_1778432572166.png',
        configuration: { frameStyleId: 'gold-gilt', sizeId: 'lg-land', wallTextureId: 'Deep Taupe', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'dining-feast',
        title: 'Sunday Feast',
        description: 'A vibrant dining room with a wide frame capturing a rich Ghanaian family feast featuring Jollof and Waakye.',
        type: 'frame', room: 'Dining Room', mood: 'Vibrant',
        tags: ['Feast', 'Food', 'Family'],
        previewImage: '/inspiration/dining_ghana_feast_1778883664346.png',
        configuration: { frameStyleId: 'vintage-bronze', sizeId: 'xl-land', wallTextureId: 'Warm Terracotta', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'dining-heritage',
        title: 'Architectural Heritage',
        description: 'An elegant dining room featuring a layered gallery layout of historical Ghanaian architecture.',
        type: 'frame', room: 'Dining Room', mood: 'Elegant',
        tags: ['Architecture', 'Layered', 'History'],
        previewImage: '/inspiration/dining_ghana_heritage_1778883678465.png',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'lg', wallTextureId: 'Deep Taupe', layout: 'layered', frameThickness: 'thin' }
    },

    // ─── ENTRYWAY ────────────────────────────────
    {
        id: 'entryway-tour',
        title: 'Black Star Square',
        description: 'A welcoming entryway console featuring a sleek frame displaying a family posing on tour at Black Star Square.',
        type: 'frame', room: 'Entryway', mood: 'Modern',
        tags: ['Tour', 'Modern', 'Welcome'],
        previewImage: '/inspiration/entryway_ghana_tour_1778432585917.png',
        configuration: { frameStyleId: 'modern-black', sizeId: 'md', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thin' }
    },
    {
        id: 'entryway-landscape',
        title: 'Ghanaian Beach',
        description: 'A welcoming modern entryway with a single chunky statement frame showing a beautiful landscape photo of a local beach.',
        type: 'frame', room: 'Entryway', mood: 'Coastal',
        tags: ['Beach', 'Landscape', 'Statement'],
        previewImage: '/inspiration/entryway_ghana_landscape_1778432610177.png',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'lg', wallTextureId: 'Sky Blue', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'entryway-welcome',
        title: 'Akwaaba Welcome',
        description: 'A welcoming entryway with a single chunky frame showing the traditional Ghanaian "Akwaaba" symbol with a family.',
        type: 'frame', room: 'Entryway', mood: 'Welcoming',
        tags: ['Akwaaba', 'Welcome', 'Family'],
        previewImage: '/inspiration/entryway_ghana_welcome_1778883693555.png',
        configuration: { frameStyleId: 'modern-black', sizeId: 'lg', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'entryway-festival',
        title: 'Chale Wote Vibes',
        description: 'A bold modern entryway console with a large statement frame showing colorful street art from the Chale Wote festival in Accra.',
        type: 'frame', room: 'Entryway', mood: 'Bold',
        tags: ['Festival', 'Street Art', 'Colorful'],
        previewImage: '/inspiration/entryway_ghana_festival_1778883723283.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'xl', wallTextureId: 'Clean White', layout: 'single', frameThickness: 'thick' }
    },

    // ─── KIDS ROOM ───────────────────────────────
    {
        id: 'kids-play',
        title: 'Playful Moments',
        description: 'A colorful kids room featuring a playful layered frame arrangement showing Ghanaian children playing.',
        type: 'frame', room: 'Kids Room', mood: 'Playful',
        tags: ['Kids', 'Layered', 'Colorful'],
        previewImage: '/inspiration/kids_room_ghana_play_1778432626085.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'md', wallTextureId: 'Sky Blue', layout: 'layered', frameThickness: 'thin' }
    },
    {
        id: 'kids-school',
        title: 'School Portrait',
        description: 'A kids bedroom where a bold frame cleanly displays a cheerful school portrait of a young Ghanaian boy in uniform.',
        type: 'frame', room: 'Kids Room', mood: 'Cheerful',
        tags: ['Portrait', 'School', 'Bright'],
        previewImage: '/inspiration/kids_room_ghana_school_1778432667065.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'sm', wallTextureId: 'Dusty Rose', layout: 'single', frameThickness: 'thick' }
    },
    {
        id: 'kids-sports',
        title: 'Neighborhood Football',
        description: 'A lively kids room with a triptych of Ghanaian children playing football in an Accra neighborhood.',
        type: 'frame', room: 'Kids Room', mood: 'Energetic',
        tags: ['Football', 'Sports', 'Triptych'],
        previewImage: '/inspiration/kids_ghana_sports_1778883749332.png',
        configuration: { frameStyleId: 'modern-black', sizeId: 'md', wallTextureId: 'Clean White', layout: 'triptych', frameThickness: 'thin' }
    },
    {
        id: 'kids-dance',
        title: 'Adowa Dancer',
        description: 'A bright kids room with a single framed photo of a young Ghanaian girl performing a traditional Adowa dance.',
        type: 'frame', room: 'Kids Room', mood: 'Cultural',
        tags: ['Dance', 'Culture', 'Bright'],
        previewImage: '/inspiration/kids_ghana_dance_1778883762249.png',
        configuration: { frameStyleId: 'gold-gilt', sizeId: 'sm', wallTextureId: 'Dusty Rose', layout: 'single', frameThickness: 'thin' }
    },

    // ─── GALLERY ─────────────────────────────────
    {
        id: 'gallery-vacation',
        title: 'Kakum Canopy',
        description: 'A bright, modern home gallery featuring a central frame of a joyful family vacation at the Kakum canopy walkway.',
        type: 'frame', room: 'Gallery', mood: 'Eclectic',
        tags: ['Vacation', 'Kakum', 'Gallery Wall'],
        previewImage: '/inspiration/gallery_ghana_vacation_1778431784202.png',
        configuration: { frameStyleId: 'classic-white', sizeId: 'lg', wallTextureId: 'Clean White', layout: 'mosaic', frameThickness: 'thin' }
    },
    {
        id: 'gallery-memories',
        title: 'A Lifetime of Memories',
        description: 'A layered gallery wall layout showcasing a rich collage of a Ghanaian family’s life memories.',
        type: 'frame', room: 'Gallery', mood: 'Eclectic',
        tags: ['Memories', 'Layered', 'Eclectic'],
        previewImage: '/inspiration/gallery_ghana_memories_1778432682804.png',
        configuration: { frameStyleId: 'modern-black', sizeId: 'lg', wallTextureId: 'Soft Beige', layout: 'layered', frameThickness: 'thick' }
    },
    {
        id: 'gallery-kofi',
        title: 'Family Patriarch',
        description: 'A home gallery wall dedicated to the life of a prominent Ghanaian family patriarch with a mosaic layout.',
        type: 'frame', room: 'Gallery', mood: 'Vintage',
        tags: ['Patriarch', 'Mosaic', 'History'],
        previewImage: '/inspiration/gallery_ghana_kofi_1778883774680.png',
        configuration: { frameStyleId: 'vintage-bronze', sizeId: 'xl', wallTextureId: 'Dark Charcoal', layout: 'mosaic', frameThickness: 'thick' }
    },
    {
        id: 'gallery-nature',
        title: 'Aburi Gardens',
        description: 'A beautifully layered gallery wall showcasing the lush green landscapes of the Aburi Botanical Gardens.',
        type: 'frame', room: 'Gallery', mood: 'Lush',
        tags: ['Nature', 'Layered', 'Aburi'],
        previewImage: '/inspiration/gallery_ghana_nature_1778883787383.png',
        configuration: { frameStyleId: 'rustic-oak', sizeId: 'lg', wallTextureId: 'Clean White', layout: 'layered', frameThickness: 'thin' }
    }`;

content = content.replace(/export const INSPIRATION_COLLECTIONS = \[\s*[\s\S]*?\s*\];/m, `export const INSPIRATION_COLLECTIONS = [\n${newArray}\n];`);
fs.writeFileSync('src/data/constants.jsx', content);
