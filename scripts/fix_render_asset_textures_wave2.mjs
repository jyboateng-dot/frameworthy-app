// Wave 2: a single frame (Cherry Flat, frame-10484) reported by the user as
// rendering wrong in AR. Not caught by audit_frame_textures.mjs's padding
// check because its bad crop's backdrop is light gray, not pure white, so
// it slipped under that check's near-white threshold — but it's the exact
// same failure as Wave 1: frontTexture.horizontalPath is a loose crop that's
// mostly backdrop, while frameRails.json's rail is a tight, correct crop of
// the real wood. Same fix: repoint frontTexture at the rail.
import { readFileSync, writeFileSync } from 'node:fs';

const PROFILES_PATH = 'src/data/frameRenderProfiles.json';
const RAILS_PATH = 'src/data/frameRails.json';

const IDS = ['frame-10484'];

const profilesDoc = JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));
const rails = JSON.parse(readFileSync(RAILS_PATH, 'utf8')).rails;

let fixed = 0;
for (const id of IDS) {
    const profile = profilesDoc.profiles[id];
    const rail = rails[id];
    if (!profile || !rail?.h) {
        console.warn('Skipped (missing profile or rail entry):', id);
        continue;
    }
    profile.frontTexture = {
        horizontalPath: rail.h,
        verticalPath: rail.v || profile.frontTexture?.verticalPath || null,
        sourceOverride: 'rails-pipeline',
        overriddenAt: new Date().toISOString().slice(0, 10),
    };
    fixed += 1;
}

writeFileSync(PROFILES_PATH, `${JSON.stringify(profilesDoc, null, 2)}\n`, 'utf8');
console.log(`Repointed frontTexture for ${fixed}/${IDS.length} frames.`);
