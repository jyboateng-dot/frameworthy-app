import { test, expect } from 'playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('mobile rooms slide as aligned layers and keep their foreground mounted', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
        localStorage.setItem('fw_tester_access', 'granted');
        localStorage.setItem('fw_tester_carousel_seen', 'true');
    });
    await page.goto('/frame/customize');
    const next = page.getByRole('button', { name: 'Next room', exact: true });
    await expect(next).toBeVisible({ timeout: 60_000 });
    await page.evaluate(() => {
        window.slideSamples = [];
        window.frameSamples = [];
        document.addEventListener('pointerdown', () => {
            const frame = document.querySelector('[data-testid="frame-render"]');
            window.beforeFrame = frame?.getBoundingClientRect().toJSON();
        });
        document.addEventListener('animationstart', event => {
            if (event.animationName !== 'roomSceneSlideIn' || event.target.classList.contains('room-scene-foreground')) return;
            const frame = document.querySelector('[data-testid="frame-render"]');
            const move = frame.getAnimations().find(animation => animation.effect.getKeyframes().some(key => key.transform));
            if (move) {
                const time = move.currentTime;
                move.pause();
                move.currentTime = 0;
                const start = frame.getBoundingClientRect().toJSON();
                const width = frame.offsetWidth;
                move.currentTime = 150;
                window.frameSamples.push({ before: window.beforeFrame, start, width, duringWidth: frame.offsetWidth });
                move.currentTime = time;
                move.play();
            }
            const layers = [...document.querySelectorAll('.room-scene-slide-in')];
            // Sample a deterministic point during motion, then resume it.
            const animations = layers.flatMap(el => el.getAnimations());
            animations.forEach(animation => { animation.pause(); animation.currentTime = 150; });
            window.slideSamples.push(layers.map(el => ({
                name: getComputedStyle(el).animationName,
                transform: getComputedStyle(el).transform,
            })));
            window.incomingForeground = document.querySelector('.room-scene-foreground.room-scene-slide-in');
            animations.forEach(animation => animation.play());
        });
    });
    for (let i = 0; i < 6; i++) {
        await next.click();
        await expect.poll(() => page.evaluate(() => window.slideSamples.length), { timeout: 15_000 }).toBe(i + 1);
        const sample = await page.evaluate(() => window.slideSamples.at(-1));
        expect(sample.every(layer => layer.name === 'roomSceneSlideIn')).toBe(true);
        expect(new Set(sample.map(layer => layer.transform)).size).toBe(1);
        expect(sample[0].transform).not.toBe('none');
        await expect(page.locator('.room-scene-slide-in')).toHaveCount(0);
        expect(await page.evaluate(() => !window.incomingForeground || window.incomingForeground.isConnected)).toBe(true);
    }
    const moves = await page.evaluate(() => window.frameSamples);
    expect(moves).toHaveLength(2);
    for (const move of moves) {
        expect(move.width).toBe(move.duringWidth);
        for (const property of ['left', 'top', 'width', 'height']) {
            expect(Math.abs(move.start[property] - move.before[property]), JSON.stringify({ property, move })).toBeLessThan(1);
        }
    }
});
