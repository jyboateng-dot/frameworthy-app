/* global process */
import { test, expect } from 'playwright/test';

// Run with GEOAPIFY_E2E=1 VITE_ADDRESS_LOOKUP_PROVIDER=geoapify
// VITE_GEOAPIFY_API_KEY=fixture-only. Requests are
// intercepted below: no provider credits or real delivery data are used.
test.skip(!process.env.GEOAPIFY_E2E, 'Requires the Geoapify-enabled test build');
test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
        localStorage.setItem('fw_tester_access', 'granted');
        localStorage.setItem('fw_tester_carousel_seen', 'true');
        localStorage.setItem('fw_cookie_consent', 'declined');
        localStorage.setItem('frameworthy_cart', JSON.stringify([{
            id: 'geo-smoke', isSelected: true, quantity: 1, currency: 'GBP', totalPrice: 19.55,
            selectedFrame: { name: 'Aluminium Black', prodigiProduct: 'aluminium', prodigiColor: 'black' },
            selectedSize: { width: 8, height: 10, label: '8x10"' },
            uploadedImage: '/favicon.svg', prodigi: { sku: 'GLOBAL-FRA-ALU-8X10', destinationCountryCode: 'JE', quoteTotalGbp: 19.55 },
        }]));
    });
});

test('Geoapify search selects a Jersey house and displays attribution', async ({ page }) => {
    await page.route('https://api.geoapify.com/v1/geocode/autocomplete?**', async route => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get('filter')).toBe('countrycode:je');
        await route.fulfill({ json: { results: [{ country_code: 'je', result_type: 'building', name: 'Test House', address_line1: 'Test House, Test Road', district: 'St Helier', formatted: 'Test House, Test Road, Jersey JE2 3AA', postcode: 'JE2 3AA', datasource: { attribution: '© OpenStreetMap contributors' } }] } });
    });
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
    await page.getByLabel('Search your address').fill('Test House');
    await page.getByRole('button', { name: 'Search addresses' }).click();
    await page.getByRole('option', { name: 'Test House, Test Road, Jersey JE2 3AA' }).click();
    await expect(page.getByText('Test House, Test Road', { exact: true })).toBeVisible();
    await expect(page.getByText('JE2 3AA', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Powered by Geoapify' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change address' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: 'artifacts/checkout-geoapify-mobile.png', fullPage: true });
});

test('street-only matches keep delivery fields open for completion', async ({ page }) => {
    await page.route('https://api.geoapify.com/v1/geocode/autocomplete?**', route => route.fulfill({ json: { results: [{ country_code: 'je', result_type: 'street', address_line1: 'Test Road', street: 'Test Road', formatted: 'Test Road, Jersey' }] } }));
    await page.goto('/checkout');
    await page.getByLabel('Search your address').fill('Test Road');
    await page.getByRole('button', { name: 'Search addresses' }).click();
    await page.getByRole('option', { name: 'Test Road, Jersey' }).click();
    await expect(page.getByLabel('House name or number and street')).toHaveValue('Test Road');
    await expect(page.getByLabel('Postcode', { exact: true })).toHaveValue('');
    await expect(page.getByRole('status')).toContainText('Please add or check');
});

test('quota failures fall back to manual entry without contacting Ideal', async ({ page }) => {
    let idealRequests = 0;
    await page.route('https://api.ideal-postcodes.co.uk/**', route => { idealRequests++; return route.abort(); });
    await page.route('https://api.geoapify.com/v1/geocode/autocomplete?**', route => route.fulfill({ status: 429, json: { message: 'Quota exceeded' } }));
    await page.goto('/checkout');
    await page.getByLabel('Search your address').fill('Test Road');
    await page.getByRole('button', { name: 'Search addresses' }).click();
    await expect(page.getByRole('alert')).toContainText('enter your address manually');
    await expect(page.getByLabel('House name or number and street')).toBeVisible();
    expect(idealRequests).toBe(0);
    await expect(page.getByRole('button', { name: 'Payment coming soon', exact: true })).toBeDisabled();
});
