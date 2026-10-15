import { test, expect } from 'playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('fw_tester_access', 'granted');
        localStorage.setItem('fw_tester_carousel_seen', 'true');
        localStorage.setItem('fw_cookie_consent', 'declined');
        localStorage.setItem('frameworthy_cart', JSON.stringify([{
            id: 'checkout-smoke', isSelected: true, quantity: 1, currency: 'GBP', totalPrice: 23.82,
            selectedFrame: { name: 'Aluminium Black', prodigiProduct: 'aluminium', prodigiColor: 'black' },
            selectedSize: { width: 8, height: 10, label: '8x10"', prodigiSizeInches: '8x10"' },
            uploadedImage: '/favicon.svg', orientation: 'portrait', matWidth: 'none', glassType: 'standard',
            prodigi: { sku: 'GLOBAL-FRA-ALU-8X10', destinationCountryCode: 'GB', quoteTotalGbp: 23.82, attributes: { color: 'black', glaze: 'Acrylic / Perspex', mount: 'No mount / Mat' } },
        }]));
    });
});

test('mobile guest checkout stays compact and preserves manual delivery details', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payment coming soon', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Find address' })).toHaveCount(0);
    await page.getByLabel('Email', { exact: true }).fill('checkout-test@example.com');
    await page.getByLabel('Full name', { exact: true }).fill('Test Customer');
    await page.getByLabel('Postcode', { exact: true }).fill('SW1A1AA');
    await page.getByLabel('House name or number and street').fill('10 Test Street');
    await page.getByLabel('Town or city', { exact: true }).fill('London');
    await page.getByRole('button', { name: 'Use this address' }).click();
    await expect(page.getByText('SW1A 1AA', { exact: true })).toBeVisible();
    await expect(page.getByLabel('House name or number and street')).toHaveCount(0);
    await page.getByRole('button', { name: 'Change address' }).click();
    await expect(page.getByLabel('House name or number and street')).toHaveValue('10 Test Street');
    await page.getByText('View details', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review Order', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'artifacts/checkout-mobile.png', fullPage: true });
});

test('switching destination commits fresh GBP quotes for Jersey', async ({ page }) => {
    await page.route('**/getProdigiQuote', route => route.fulfill({ json: { result: { quotes: [{ shippingMethod: 'Standard', total: { amount: 19.55, currency: 'GBP' }, retail: { token: 'test-quote-token' } }] } } }));
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Change country' }).click();
    await page.getByLabel('Delivery country').selectOption('JE');
    await expect(page.getByText('Jersey', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('frameworthy_cart'))[0].prodigi.destinationCountryCode)).toBe('JE');
    const item = await page.evaluate(() => JSON.parse(localStorage.getItem('frameworthy_cart'))[0]);
    expect(item.totalPrice).toBe(19.55);
    expect(item.prodigi.quoteToken).toBe('test-quote-token');
    await expect(page.getByLabel('Postcode', { exact: true })).toHaveAttribute('placeholder', 'JE2 3AA');
    await page.screenshot({ path: 'artifacts/checkout-desktop.png', fullPage: true });
});

test('failed repricing preserves the existing destination and price', async ({ page }) => {
    await page.route('**/getProdigiQuote', route => route.fulfill({ status: 503, json: { error: { status: 'UNAVAILABLE', message: 'Unavailable' } } }));
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Change country' }).click();
    await page.getByLabel('Delivery country').selectOption('JE');
    await expect(page.getByRole('alert')).toContainText('prices are unchanged');
    const item = await page.evaluate(() => JSON.parse(localStorage.getItem('frameworthy_cart'))[0]);
    expect(item.prodigi.destinationCountryCode).toBe('GB');
    expect(item.totalPrice).toBe(23.82);
});
