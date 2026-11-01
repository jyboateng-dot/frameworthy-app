import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLOUD_NAME = 'uucoqdzr';
const UPLOAD_PRESET = 'frameworthy_uploads';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const CLOUDINARY_FOLDER = 'inspiration_marketing';

const FILES = [
    'living_room_ghana_wedding_1778431713765.png',
    'living_room_ghana_family_1778432426813.png',
    'bedroom_ghana_grad_1778431800272.png',
    'bedroom_ghana_couple_1778432471838.png',
    'office_ghana_album_1778432491375.png',
    'office_ghana_milestone_1778432510303.png',
    'nursery_ghana_baby_1778431736189.png',
    'nursery_ghana_shower_1778432544309.png',
    'dining_room_ghana_dinner_1778432558170.png',
    'dining_room_ghana_cc_1778432572166.png',
    'entryway_ghana_tour_1778432585917.png',
    'entryway_ghana_landscape_1778432610177.png',
    'kids_room_ghana_play_1778432626085.png',
    'kids_room_ghana_school_1778432667065.png',
    'gallery_ghana_vacation_1778431784202.png',
    'gallery_ghana_memories_1778432682804.png',
];

async function uploadOne(file) {
    const filePath = path.join(__dirname, 'public', 'inspiration', file);
    const buf = fs.readFileSync(filePath);
    const blob = new Blob([buf]);
    const publicId = file.replace(/\.[^.]+$/, '');
    const form = new FormData();
    form.append('file', blob, file);
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', CLOUDINARY_FOLDER);
    form.append('public_id', publicId);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    if (!res.ok) {
        const text = await res.text().catch(() => '<unreadable>');
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    const json = await res.json();
    return json.secure_url;
}

async function main() {
    const constantsPath = path.join(__dirname, 'src', 'data', 'constants.jsx');
    let content = fs.readFileSync(constantsPath, 'utf-8');
    const failures = [];

    await Promise.all(FILES.map(async (file) => {
        try {
            const url = await uploadOne(file);
            const localRef = `/inspiration/${file}`;
            if (!content.includes(localRef)) {
                console.warn(`WARNING: ${localRef} not found in constants.jsx`);
                return;
            }
            content = content.split(localRef).join(url);
            console.log(`Migrated ${file}`);
        } catch (err) {
            failures.push({ file, error: err.message });
        }
    }));

    fs.writeFileSync(constantsPath, content);
    console.log(`\nDone. ${FILES.length - failures.length}/${FILES.length} migrated.`);
    if (failures.length) {
        console.log('Failures:', JSON.stringify(failures, null, 2));
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
