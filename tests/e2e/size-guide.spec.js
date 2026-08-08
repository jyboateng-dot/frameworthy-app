import { test, expect } from 'playwright/test';

test('custom framing opens and closes the size guide', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('fw_tester_access', 'granted');
        localStorage.setItem('fw_tester_carousel_seen', 'true');
    });
    await page.goto('/frame/customize');

    await page.getByRole('button', { name: 'Size guide' }).click();
    await expect(page.getByRole('heading', { name: 'Find the right frame size' })).toBeVisible();
    await page.getByRole('button', { name: 'Close size guide' }).click();
    await expect(page.getByRole('heading', { name: 'Find the right frame size' })).toHaveCount(0);
});
