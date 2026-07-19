import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    // firestore.rules tests need the emulator (see vitest.rules.config.js /
    // `npm run test:rules`) and would hang here without one running.
    // functions/ is its own package with its own emulator-backed test run
    // (`npm --prefix functions test`) — not part of this project's suite.
    exclude: [...configDefaults.exclude, 'src/test/firestore/**', 'functions/**'],
  },
})
