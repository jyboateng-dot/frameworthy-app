import { defineConfig } from 'vitest/config';

// These tests need the Firestore + Auth emulators (see `npm test`, which
// wraps this with `firebase emulators:exec --only firestore,auth`) — run
// bare `vitest run` here and every test hangs or errors trying to reach a
// real project.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // All test files share one Firestore/Auth emulator + project id, and
    // each file wipes that shared state in beforeEach — running files in
    // parallel lets one file's clear race another file's in-flight test.
    fileParallelism: false,
  },
});
