import StudioLoftScene from './StudioLoftScene';
import DiningRoomScene from './DiningRoomScene';
import BedroomScene from './BedroomScene';
import EntrywayScene, { EntrywaySceneForeground } from './EntrywayScene';
import HomeOfficeScene from './HomeOfficeScene';

/**
 * Which component draws which `tintable` scene.
 *
 * This lives here rather than on the ROOM_SCENES entries themselves so
 * roomScenes.js stays plain data — it's imported by the placement math and its
 * tests, which have no business pulling in React. Photographic scenes carry an
 * `image` URL instead and need no entry here.
 *
 * Every `tintable: true` scene must appear in this map; roomScenes.test.js
 * asserts it, since a missing entry renders as an empty box rather than
 * failing loudly.
 */
export const ROOM_SCENE_COMPONENTS = {
    'studio-loft': StudioLoftScene,
    'dining-room': DiningRoomScene,
    bedroom: BedroomScene,
    entryway: EntrywayScene,
    'home-office': HomeOfficeScene,
};

export const ROOM_SCENE_FOREGROUND_COMPONENTS = {
    entryway: EntrywaySceneForeground,
};

export default ROOM_SCENE_COMPONENTS;
