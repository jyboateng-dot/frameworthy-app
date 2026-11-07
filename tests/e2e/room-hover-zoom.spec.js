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
