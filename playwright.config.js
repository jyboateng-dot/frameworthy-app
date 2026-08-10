import { defineConfig } from 'playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    use: {
        baseURL: 'http://127.0.0.1:4174',
        viewport: { width: 1280, height: 800 },
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 4174',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: !process.env.CI,
        // A cold Vite start of this app doesn't reliably finish inside 30s.
        // That only shows up when there's no server already running to reuse,
        // which is exactly the CI case — and it fails as "Timed out waiting
        // for webServer", which reads like an app fault rather than a slow boot.
        timeout: 120_000,
    },
});
