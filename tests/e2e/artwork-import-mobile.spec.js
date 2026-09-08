import { expect, test } from 'playwright/test';

test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
});

async function openCustomizer(page) {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
        localStorage.setItem('fw_tester_access', 'granted');
        localStorage.setItem('fw_tester_carousel_seen', 'true');
    });
    await page.goto('/frame/customize', { waitUntil: 'domcontentloaded' });
}

test('cloud upload sources are visible in the mobile customizer', async ({ page }) => {
    await openCustomizer(page);

    const uploadButton = page.getByRole('button', { name: 'Upload Image' });
    await uploadButton.scrollIntoViewIfNeeded();
    await uploadButton.click();

    const drive = page.getByRole('menuitem', { name: 'Google Drive' });
    const dropbox = page.getByRole('menuitem', { name: 'Dropbox' });
    await expect(drive).toBeVisible();
    await expect(dropbox).toBeVisible();

    const menuBox = await page.getByRole('menu').boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
});

test('Google Drive selection imports an image on mobile', async ({ page }) => {
    await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({
        contentType: 'application/javascript',
        body: `window.google={accounts:{oauth2:{initTokenClient(options){return{requestAccessToken(){options.callback({access_token:'mobile-token',expires_in:3600});}};}}}};`,
    }));
    await page.route('https://apis.google.com/js/api.js', (route) => route.fulfill({
        contentType: 'application/javascript',
        body: `window.gapi={load(_name,options){
            class DocsView { setMode(){ return this; } }
            class PickerBuilder {
                addView(){ return this; } setOAuthToken(){ return this; }
                setDeveloperKey(){ return this; } setAppId(){ return this; }
                setCallback(callback){ this.callback=callback; return this; }
                build(){ const callback=this.callback; return {setVisible(){callback({action:'picked',docs:[{id:'mobile-drive-image',name:'drive.png',mimeType:'image/png'}]});}}; }
            }
            window.google.picker={DocsView,PickerBuilder,ViewId:{DOCS_IMAGES:'images'},DocsViewMode:{THUMBNAILS:'thumbs'},Action:{PICKED:'picked',CANCEL:'cancel'}};
            options.callback();
        }};`,
    }));
    await page.route('https://www.googleapis.com/drive/v3/files/mobile-drive-image?alt=media', (route) => route.fulfill({
        contentType: 'image/png',
        body: 'mobile-drive-image',
    }));
    await openCustomizer(page);

    await page.getByRole('button', { name: 'Upload Image' }).click();
    await page.getByRole('menuitem', { name: 'Google Drive' }).click();

    await expect(page.getByRole('button', { name: 'Replace Image' })).toBeVisible();
});

test('Dropbox selection imports an image on mobile', async ({ page }) => {
    await page.route('https://www.dropbox.com/static/api/2/dropins.js', (route) => route.fulfill({
        contentType: 'application/javascript',
        body: `window.Dropbox={choose(options){options.success([{name:'dropbox.jpg',link:'https://mobile.test/dropbox.jpg'}]);}};`,
    }));
    await page.route('https://mobile.test/dropbox.jpg', (route) => route.fulfill({
        contentType: 'image/jpeg',
        body: 'mobile-dropbox-image',
    }));
    await openCustomizer(page);

    await page.getByRole('button', { name: 'Upload Image' }).click();
    await page.getByRole('menuitem', { name: 'Dropbox' }).click();

    await expect(page.getByRole('button', { name: 'Replace Image' })).toBeVisible();
});
