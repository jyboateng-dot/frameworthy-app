import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  optimizeDeps: {
    // Uploadcare's file-uploader lazy-imports its own web-component modules
    // at runtime; letting Vite pre-bundle it breaks those dynamic imports in
    // dev (404/403 on .vite/deps/web-*.js). Excluding it lets the browser
    // load its ESM directly, which resolves the nested imports correctly.
    exclude: ['@uploadcare/file-uploader', '@uploadcare/react-uploader'],
  },
  build: {
    // FrameWorthy intentionally ships several large, static catalogue datasets
    // (album artwork, Met archive, movie posters, and frame-strip metadata).
    // Keep them out of route UI chunks so they cache independently and so a
    // change to one catalogue doesn't invalidate the whole app shell.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/src/data/albumsLocal.js')) return 'catalog-albums';
          if (normalized.includes('/src/data/metLocal.js')) return 'catalog-met';
          if (normalized.includes('/src/data/moviesLocal.js')) return 'catalog-movies';
          if (normalized.includes('/src/data/web_met_dims.json')) return 'catalog-met-dimensions';
          if (normalized.includes('/src/data/source_dims.json')) return 'catalog-source-dimensions';
          if (normalized.includes('/src/data/frameStrips.json')) return 'catalog-frame-strips';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    // firestore.rules tests need the emulator (see vitest.rules.config.js /
    // `npm run test:rules`) and would hang here without one running.
    // functions/ is its own package with its own emulator-backed test run
    // (`npm --prefix functions test`) — not part of this project's suite.
    exclude: [...configDefaults.exclude, 'src/test/firestore/**', 'functions/**', 'tests/e2e/**'],
  },
})
