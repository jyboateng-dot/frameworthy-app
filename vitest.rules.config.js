import { defineConfig } from 'vitest/config';

// Separate config for firestore.rules tests: these need the Firestore
// emulator running (via `npm run test:rules`, which wraps this with
// `firebase emulators:exec`) and run under node, not jsdom — kept out of
// the default `npm test` run so a plain `vitest run` doesn't hang waiting
// for an emulator nobody started.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/firestore/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
