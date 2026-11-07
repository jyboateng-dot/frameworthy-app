import { test, expect } from 'playwright/test';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const MOTION_MS = 420;
const SAMPLE_TIMES = [0, 105, 210, 315, 420];

async function sampleFrameTransition(page) {
    return page.locator('[data-testid="frame-render"]').evaluate(async (frame, { sampleTimes, motionMs }) => {
        const foreground = document.querySelector('.room-scene-foreground:not(.room-scene-slide-out)');
        const chrome = document.querySelector('[data-testid="visualizer-chrome"]');
        const animatedElements = [frame, foreground, chrome].filter(Boolean);
        const animations = animatedElements.flatMap(element => (
            element.getAnimations().filter(animation => animation instanceof CSSTransition)
        ));
        if (!animations.length) throw new Error('Frame transition did not start.');
        animations.forEach(animation => animation.pause());

        const samples = [];
        for (const time of sampleTimes) {
            animations.forEach(animation => { animation.currentTime = time; });
            await new Promise(resolve => requestAnimationFrame(resolve));
            const rect = frame.getBoundingClientRect();
            samples.push({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                roomOpacity: foreground ? Number(getComputedStyle(foreground).opacity) : null,
                chromeOpacity: chrome ? Number(getComputedStyle(chrome).opacity) : null,
            });
        }

        animations.forEach(animation => {
            animation.currentTime = motionMs;
            animation.play();
        });
        return samples;
    }, { sampleTimes: SAMPLE_TIMES, motionMs: MOTION_MS });
}

test('room hover zoom-out retraces zoom-in in reverse', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
        localStorage.setItem('fw_tester_access', 'granted');
        localStorage.setItem('fw_tester_carousel_seen', 'true');
    });
    await page.goto('/frame/customize');

    await page.getByRole('tab', { name: 'Studio Loft' }).click();
    await expect(page.locator('.room-scene-slide-in')).toHaveCount(0, { timeout: 15_000 });

    const frame = page.locator('[data-testid="frame-render"]');
    await expect(frame).toBeVisible({ timeout: 60_000 });
    const resting = await frame.boundingBox();
    await page.mouse.move(resting.x + resting.width / 2, resting.y + resting.height / 2);
    await expect.poll(() => frame.evaluate(element => element.getAnimations().some(animation => animation instanceof CSSTransition))).toBe(true);
    const zoomIn = await sampleFrameTransition(page);

    await page.waitForTimeout(MOTION_MS + 50);
    await page.mouse.move(4, 4);
    await expect.poll(() => frame.evaluate(element => element.getAnimations().some(animation => animation instanceof CSSTransition))).toBe(true);
    const zoomOut = await sampleFrameTransition(page);

    for (let index = 0; index < SAMPLE_TIMES.length; index += 1) {
        const forward = zoomIn[index];
        const reverse = zoomOut[SAMPLE_TIMES.length - 1 - index];
        for (const property of ['left', 'top', 'width', 'height']) {
            expect(Math.abs(forward[property] - reverse[property]), `${property} at sample ${index}`).toBeLessThan(1);
        }
        expect(Math.abs(forward.roomOpacity - reverse.roomOpacity), `room opacity at sample ${index}`).toBeLessThan(0.02);
        expect(Math.abs(forward.chromeOpacity - reverse.chromeOpacity), `chrome opacity at sample ${index}`).toBeLessThan(0.02);
    }
});

test.describe('mobile room close-up detour and touch gestures', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('mobile double-tap close-up fades room smoothly and retraces in reverse with zero passive touch warnings', async ({ page }) => {
        test.setTimeout(120_000);
        const consoleWarningsAndErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                consoleWarningsAndErrors.push(msg.text());
            }
        });
        page.on('pageerror', (err) => {
            consoleWarningsAndErrors.push(err.message);
        });

        await page.addInitScript(() => {
            localStorage.setItem('fw_tester_access', 'granted');
            localStorage.setItem('fw_tester_carousel_seen', 'true');
        });
        await page.goto('/frame/customize');

        const next = page.getByRole('button', { name: 'Next room', exact: true });
        await expect(next).toBeVisible({ timeout: 60_000 });
        await next.click();
        await expect(page.locator('.room-scene-slide-in')).toHaveCount(0, { timeout: 15_000 });
        await expect(page.getByRole('radio', { name: 'Studio Loft' })).toBeChecked();

        const frame = page.locator('[data-testid="frame-render"]');
        await expect(frame).toBeVisible();
        const restingBox = await frame.boundingBox();

        // Double-tap frame on mobile to enter Close-Up inspection detour
        await frame.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const touch = (type) => {
                const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
                el.dispatchEvent(new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    touches: type === 'touchend' ? [] : [t],
                    targetTouches: type === 'touchend' ? [] : [t],
                    changedTouches: [t],
                }));
            };
            touch('touchstart');
            touch('touchend');
            touch('touchstart');
            touch('touchend');
        });

        await expect(page.getByRole('radio', { name: 'Close-Up' })).toBeChecked();
        await expect.poll(() => frame.evaluate(element => element.getAnimations().some(animation => animation instanceof CSSTransition))).toBe(true);
        const zoomIn = await sampleFrameTransition(page);

        // Room foreground stays mounted and fades out over the 420ms transition
        expect(zoomIn[0].roomOpacity).toBeGreaterThan(0.95);
        expect(zoomIn[2].roomOpacity).toBeGreaterThan(0.15);
        expect(zoomIn[2].roomOpacity).toBeLessThan(0.85);
        expect(zoomIn[4].roomOpacity).toBeLessThan(0.05);

        await page.waitForTimeout(MOTION_MS + 50);

        // Single-tap frame on mobile to return to Studio Loft
        await frame.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const touch = (type) => {
                const t = new Touch({ identifier: 2, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
                el.dispatchEvent(new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    touches: type === 'touchend' ? [] : [t],
                    targetTouches: type === 'touchend' ? [] : [t],
                    changedTouches: [t],
                }));
            };
            touch('touchstart');
            touch('touchend');
        });

        await expect(page.getByRole('radio', { name: 'Studio Loft' })).toBeChecked();
        await expect.poll(() => frame.evaluate(element => element.getAnimations().some(animation => animation instanceof CSSTransition))).toBe(true);
        const zoomOut = await sampleFrameTransition(page);

        for (let index = 0; index < SAMPLE_TIMES.length; index += 1) {
            const forward = zoomIn[index];
            const reverse = zoomOut[SAMPLE_TIMES.length - 1 - index];
            for (const property of ['left', 'top', 'width', 'height']) {
                expect(Math.abs(forward[property] - reverse[property]), `${property} at sample ${index}`).toBeLessThan(1);
            }
            expect(Math.abs(forward.roomOpacity - reverse.roomOpacity), `room opacity at sample ${index}`).toBeLessThan(0.02);
        }

        await page.waitForTimeout(MOTION_MS + 50);
        const returnedBox = await frame.boundingBox();
        for (const property of ['x', 'y', 'width', 'height']) {
            expect(Math.abs(returnedBox[property] - restingBox[property]), `resting ${property}`).toBeLessThan(1);
        }

        // Swipe gesture across the zone must not emit passive event listener warnings
        await frame.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const y = rect.top + rect.height / 2;
            const makeTouch = (x) => new Touch({ identifier: 3, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
            const start = makeTouch(280);
            const mid = makeTouch(200);
            const end = makeTouch(110);
            el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [start], targetTouches: [start], changedTouches: [start] }));
            el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [mid], targetTouches: [mid], changedTouches: [mid] }));
            el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [end] }));
        });

        await expect(page.locator('.room-scene-slide-in')).toHaveCount(0, { timeout: 15_000 });
        const passiveWarnings = consoleWarningsAndErrors.filter(text => text.includes('passive event listener'));
        expect(passiveWarnings).toEqual([]);
    });
});
