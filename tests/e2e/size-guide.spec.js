import { test, expect } from 'playwright/test';

test('customizer presents catalogue-backed frame sizes', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('fw_tester_access', 'granted');
        localStorage.setItem('fw_tester_carousel_seen', 'true');
    });
    await page.goto('/frame/customize');

    await expect(page.getByRole('heading', { name: /3 Dimensions/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '13 × 18 cm' })).toBeVisible();
    await page.getByRole('button', { name: '20 × 25 cm' }).click();
    await expect(page.getByRole('button', { name: '20 × 25 cm' })).toHaveAttribute('aria-pressed', 'true');
});
