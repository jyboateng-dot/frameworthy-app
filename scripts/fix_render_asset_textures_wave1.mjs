// Wave 1 of the texture-crop fix (audit_frame_textures.mjs found 54 bad AR
// textures; cross-checking against frameRails.json found 30 of them already
// correct over there — see audit_rails_for_flagged_report.json).
//
// arTextures.js's railCandidates() prefers frameRenderProfiles.json's own
// frontTexture over frameRails.json's rail as its first candidate, so for
// these 30 frames it's reading the wrong one: repointing frontTexture at
// the already-good rails/*.webp is the entire fix, no new cropping.
import { readFileSync, writeFileSync } from 'node:fs';

const PROFILES_PATH = 'src/data/frameRenderProfiles.json';
const RAILS_PATH = 'src/data/frameRails.json';

const CLEAN_IDS = [
    'frame-10871', 'frame-9600', 'frame-83530', 'frame-9885', 'frame-10937',
    'frame-8613', 'frame-10168', 'frame-10165', 'frame-10169', 'frame-10167',
    'frame-9169', 'frame-10652', 'frame-10926', 'frame-83997', 'frame-9172',
    'frame-10439', 'frame-10779', 'frame-9684', 'frame-10623', 'frame-9073',
    'frame-10254', 'frame-9163', 'frame-9213', 'frame-7169', 'frame-10171',
    'frame-10397', 'frame-11197', 'frame-84159', 'frame-10838', 'frame-80299',
];

const profilesDoc = JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));
const rails = JSON.parse(readFileSync(RAILS_PATH, 'utf8')).rails;

let fixed = 0;
const skipped = [];
for (const id of CLEAN_IDS) {
    const profile = profilesDoc.profiles[id];
    const rail = rails[id];
    if (!profile || !rail?.h) {
        skipped.push(id);
        continue;
    }
    profile.frontTexture = {
        horizontalPath: rail.h,
        verticalPath: rail.v || profile.frontTexture?.verticalPath || null,
        // Traceable rather than silent: the original render-assets crop for
        // this id was audited as flat/padded/miscoloured (see
        // audit_frame_textures_report.json) and this now points at
        // frameRails.json's rail instead, which passed the same checks.
        sourceOverride: 'rails-pipeline',
        overriddenAt: new Date().toISOString().slice(0, 10),
    };
    fixed += 1;
}

if (skipped.length) {
    console.warn('Skipped (missing profile or rail entry):', skipped);
}

writeFileSync(PROFILES_PATH, `${JSON.stringify(profilesDoc, null, 2)}\n`, 'utf8');
console.log(`Repointed frontTexture for ${fixed}/${CLEAN_IDS.length} frames.`);
