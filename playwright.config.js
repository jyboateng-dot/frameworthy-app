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
        timeout: 30_000,
    },
});
