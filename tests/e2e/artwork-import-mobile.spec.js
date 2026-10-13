import { expect, test } from 'playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('active artwork sources fit the mobile customizer', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('fw_tester_access', 'granted');
        localStorage.setItem('fw_tester_carousel_seen', 'true');
    });
    await page.goto('/frame/customize', { waitUntil: 'domcontentloaded' });

    const uploadButton = page.getByRole('button', { name: 'Upload Image' });
    await uploadButton.scrollIntoViewIfNeeded();
    await uploadButton.click();

    await expect(page.getByRole('menuitem', { name: 'Device' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Paste image link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Curated Art' })).toBeVisible();

    const menuBox = await page.getByRole('menu').boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
});
