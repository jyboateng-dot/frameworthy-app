import { test, expect } from 'playwright/test';

/**
 * The visualizer's one hard layout rule: nothing may cover the rendered piece,
 * and the floating controls may not cover each other.
 *
 * This exists because that rule kept being broken by addition. Every control
 * was absolutely pinned to its own corner, which is stable while there are
 * four of them and silently wrong the moment a fifth needs somewhere to go —
 * the scene picker landed on the approximation note at the bottom, then on the
 * dimensions pill at the top, and neither was visible in the layout code.
 *
 * So this asserts on measured geometry rather than on a list of known
 * elements. `[data-testid="visualizer-chrome"]` is the opt-in marker for
 * floating controls; anything added to the pane and marked is checked against
 * everything else automatically, which is what makes the rule hold for
 * controls that don't exist yet.
 *
 * ONE MARKER IS ALL A NEW CONTROL NEEDS. If you add a floating control to the
 * visualizer and don't mark it, this suite won't know about it — that is the
 * one failure mode here, and it's why the marker sits next to the positioning
 * classes rather than somewhere clever.
 */

const GATE = () => {
    localStorage.setItem('fw_tester_access', 'granted');
    localStorage.setItem('fw_tester_carousel_seen', 'true');
};

// Widths worth checking, and why each one is here rather than a round number:
//   375  the narrowest phone still supported — where a centred control has the
//        least room between the corner buttons
//   768  tablet, stacked layout, chrome at its sm: insets
//   1023 one pixel below the side-by-side threshold: the widest the visualizer
//        ever gets while still full-bleed, and the last width before the frame
//        is re-laid-out against a 70% pane
//   1280 the default desktop side-by-side case
const WIDTHS = [375, 768, 1023, 1280];

/**
 * Open the customize page with the visualizer settled.
 *
 * `domcontentloaded`, not the default `load`: the page pulls the Unsplash demo
 * photo and opens Firebase connections, so `load` can hang indefinitely on a
 * machine without network — which reads as a layout failure when it's really
 * an offline test runner. The frame render is the thing being measured, so
 * waiting for it is both stricter and honest about what has to exist.
 */
const openVisualizer = async (page) => {
    await page.goto('/frame/customize', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="frame-render"]', { timeout: 30_000 });
};

/**
 * Choose a room scene, whichever treatment the picker is currently using.
 *
 * The inline variants (icon rail, chip row, thumbnail strip) expose every
 * scene as a button straight away; the dropdown keeps them behind a trigger.
 * Opening first when a trigger exists means this survives switching variants
 * rather than pinning the suite to one of them.
 */
const selectScene = async (page, name) => {
    const trigger = page.locator('[aria-haspopup="true"]');
    if (await trigger.count()) {
        await trigger.first().click();
        await page.waitForTimeout(250);   // the panel animates open
    }
    // force + first: the option can sit under the sticky site nav mid-scroll,
    // and this is choosing a scene, not testing the click target.
    await page.getByRole('button', { name, exact: true }).first().click({ force: true });
};

const rects = (page) =>
    page.evaluate(() => {
        const visible = (el) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            // Faded-out chrome (full screen, max zoom) is not on screen even
            // though it's still mounted, so it can't overlap anything.
            return (
                s.visibility !== 'hidden' &&
                s.display !== 'none' &&
                parseFloat(s.opacity) > 0.01 &&
                r.width > 0 &&
                r.height > 0
            );
        };
        const box = (el, label) => {
            const r = el.getBoundingClientRect();
            return { label, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        };

        const pane = document.querySelector('[data-testid="visualizer-pane"]');
        const frameEl = document.querySelector('[data-testid="frame-render"]');

        // The piece's real footprint includes its dimension ticks and labels,
        // which hang OUTSIDE its box (-top-4 / -right-4 plus their own height).
        // Measuring the box alone is what let a 1px gap pass as clear: the box
        // wasn't touching anything, but the label above it was.
        const frame = frameEl && visible(frameEl) ? (() => {
            const r = frameEl.getBoundingClientRect();
            const o = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
            for (const d of frameEl.querySelectorAll('*')) {
                if (!visible(d)) continue;
                const dr = d.getBoundingClientRect();
                o.top = Math.min(o.top, dr.top);
                o.bottom = Math.max(o.bottom, dr.bottom);
                o.left = Math.min(o.left, dr.left);
                o.right = Math.max(o.right, dr.right);
            }
            return { ...o, label: 'frame-render (incl. dimension labels)' };
        })() : null;
        const caption = document.querySelector('[data-testid="visualizer-caption"]');
        const chrome = [...document.querySelectorAll('[data-testid="visualizer-chrome"]')].filter(visible);

        // The toolbar's own slots. Comparing only the marked containers misses
        // collisions *inside* one of them: the scene strip once overflowed its
        // flex slot and rendered underneath the wall-colour button, which the
        // container-level check couldn't see because both live in the toolbar.
        const toolbar = document.querySelector('[data-testid="visualizer-chrome"][class*="flex"]');
        const slotEls = toolbar ? [...toolbar.children].filter(visible) : [];
        const slots = slotEls.map((el, i) => box(el, `toolbar-slot[${i}]`));

        // For clearance, compare against the CONTROLS, not the toolbar
        // container — that container spans the full pane width, so a centred
        // piece is always "near" it while the space between the corners is
        // in fact empty. The controls are what a viewer actually sees.
        const controls = [
            ...slotEls.map((el, i) => box(el, el.querySelector('[title]')?.getAttribute('title') || `toolbar-slot[${i}]`)),
            ...[...document.querySelectorAll('button[data-testid="visualizer-chrome"]')]
                .filter(visible)
                .map((el, i) => box(el, el.getAttribute('title') || `corner-button[${i}]`)),
        ];

        return {
            pane: pane ? box(pane, 'pane') : null,
            frame,
            caption: caption && visible(caption) ? box(caption, 'caption') : null,
            chrome: chrome.map((el, i) => box(el, el.getAttribute('title') || el.className.split(' ')[0] || `chrome[${i}]`)),
            slots,
            controls,
            viewportWidth: window.innerWidth,
        };
    });

// Positive = pixels of genuine overlap on both axes. Zero or negative = clear.
const overlap = (a, b) => {
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return x > 0 && y > 0 ? Math.round(Math.min(x, y)) : 0;
};

const describeOverlap = (a, b) =>
    `"${a.label}" overlaps "${b.label}" by ${overlap(a, b)}px\n` +
    `  ${a.label}: ${JSON.stringify(a)}\n  ${b.label}: ${JSON.stringify(b)}`;

/**
 * Air between two boxes: how far apart on their most-separated axis.
 * Negative means they intrude on each other, 0 means they touch.
 */
const clearance = (a, b) =>
    Math.round(Math.max(Math.max(b.left - a.right, a.left - b.right), Math.max(b.top - a.bottom, a.top - b.bottom)));

/**
 * Not-overlapping isn't the bar — the piece must not come near a control.
 * Before this was enforced, a 90x120 in the Entryway cleared the dimensions
 * pill by exactly 1px: zero overlap, and visually touching.
 *
 * 12px rather than the 16 the layout budgets for, so sub-pixel rounding and
 * font-metric differences between platforms can't make this flap. Anything
 * genuinely tight fails well before it reads as contact.
 */
const MIN_CLEARANCE_PX = 12;

const describeClearance = (a, b) =>
    `"${a.label}" comes within ${clearance(a, b)}px of "${b.label}" (need >= ${MIN_CLEARANCE_PX})\n` +
    `  ${a.label}: ${JSON.stringify(a)}\n  ${b.label}: ${JSON.stringify(b)}`;

for (const width of WIDTHS) {
    test.describe(`visualizer at ${width}px`, () => {
        test.use({ viewport: { width, height: 900 } });

        // The first navigation pays for a cold Vite compile of the whole app,
        // which alone can outrun the 30s default.
        test.beforeEach(({}, testInfo) => testInfo.setTimeout(90_000));

        test('no control covers the rendered piece, and none cover each other', async ({ page }) => {
            await page.addInitScript(GATE);
            await openVisualizer(page);
            // Chrome slides/fades in; measuring mid-transition reads a box that
            // is on its way somewhere else.
            await page.waitForTimeout(900);

            const { pane, frame, caption, chrome, slots, controls, viewportWidth } = await rects(page);

            expect(pane, 'visualizer pane not found').not.toBeNull();
            expect(frame, 'frame render not found').not.toBeNull();
            expect(chrome.length, 'no chrome found — the marker was probably dropped').toBeGreaterThan(0);

            // Nothing may escape the screen. A control that overflows is both
            // unreachable and a source of horizontal page scroll.
            for (const c of chrome) {
                expect(c.left, `"${c.label}" starts off-screen at ${c.left}`).toBeGreaterThanOrEqual(0);
                expect(c.right, `"${c.label}" runs to ${c.right}, past the ${viewportWidth}px viewport`)
                    .toBeLessThanOrEqual(viewportWidth);
            }

            // Slots within the toolbar must not sit on each other either.
            for (let i = 0; i < slots.length; i++) {
                for (let j = i + 1; j < slots.length; j++) {
                    expect(overlap(slots[i], slots[j]), describeOverlap(slots[i], slots[j])).toBe(0);
                }
            }

            for (const c of controls) {
                expect(clearance(frame, c), describeClearance(frame, c)).toBeGreaterThanOrEqual(MIN_CLEARANCE_PX);
            }

            // The caption sits under the frame in plain-wall mode and is the
            // thing the bottom-centre placement actually collided with.
            if (caption) {
                for (const c of chrome) {
                    expect(overlap(caption, c), describeOverlap(caption, c)).toBe(0);
                }
            }

            for (let i = 0; i < chrome.length; i++) {
                for (let j = i + 1; j < chrome.length; j++) {
                    expect(overlap(chrome[i], chrome[j]), describeOverlap(chrome[i], chrome[j])).toBe(0);
                }
            }
        });

        test('the rule holds in a room scene too', async ({ page }) => {
            await page.addInitScript(GATE);
            await openVisualizer(page);

            // Entryway is the narrowest wall (340cm), so a given piece renders
            // largest there — the worst case for the frame meeting the chrome.
            await selectScene(page, 'Entryway');
            await page.waitForTimeout(900);

            const { frame, controls } = await rects(page);
            for (const c of controls) {
                expect(clearance(frame, c), describeClearance(frame, c)).toBeGreaterThanOrEqual(MIN_CLEARANCE_PX);
            }
        });

        test('the piece keeps its distance at every large size, in every scene', async ({ page }) => {
            await page.addInitScript(GATE);
            await openVisualizer(page);

            // Expand the full size list — the biggest pieces are behind it, and
            // they're the ones that crowd the controls.
            const more = page.getByRole('button', { name: /more sizes/i });
            if (await more.count()) await more.first().click();

            // Narrowest wall first: the same piece renders largest there.
            for (const scene of ['Entryway', 'Home Office', 'Plain wall']) {
                await selectScene(page, scene);
                await page.waitForTimeout(500);

                for (const size of ['100 × 150 cm', '120 × 120 cm', '90 × 120 cm', '100 × 100 cm']) {
                    const btn = page.getByRole('button', { name: size, exact: true });
                    if (!(await btn.count())) continue;
                    await btn.first().click({ force: true });
                    await page.waitForTimeout(600);

                    const { frame, controls } = await rects(page);
                    for (const c of controls) {
                        expect(
                            clearance(frame, c),
                            `${scene} @ ${size} — ${describeClearance(frame, c)}`,
                        ).toBeGreaterThanOrEqual(MIN_CLEARANCE_PX);
                    }
                }
            }
        });

        test('hover-to-zoom clears the pane to the piece and its note', async ({ page }) => {
            await page.addInitScript(GATE);
            await openVisualizer(page);

            await page.getByTestId('frame-render').hover();
            await page.waitForTimeout(900);

            // Hover scales the frame past its true size to be looked at
            // closely. Every control gets out of the way; the piece and the
            // approximation note are what's left.
            const { frame, chrome } = await rects(page);
            expect(chrome, 'controls should be hidden while hover-zoomed').toHaveLength(0);
            expect(frame, 'the piece must stay visible').not.toBeNull();
            await expect(page.getByText('Note: Visualizer renderings').first()).toBeVisible();

            // Belt and braces: if a control is ever made visible in this state
            // again, it still may not land on the piece.
            for (const c of chrome) {
                expect(overlap(frame, c), describeOverlap(frame, c)).toBe(0);
            }
        });

        test('the rule holds at the largest offered size', async ({ page }) => {
            await page.addInitScript(GATE);
            await openVisualizer(page);

            // The frame grows with the selected size; the biggest standard size
            // is where it comes closest to the pane edges and the controls.
            //
            // force: the size buttons live in the panel below/beside the
            // visualizer and the sticky site nav overlaps them mid-scroll, so
            // the default hit-test fails on something this test isn't about.
            // What's being measured is the layout after the size changes.
            await page.getByRole('button', { name: '100 × 100 cm' }).click({ force: true });
            await page.waitForTimeout(900);

            const { frame, controls } = await rects(page);
            for (const c of controls) {
                expect(clearance(frame, c), describeClearance(frame, c)).toBeGreaterThanOrEqual(MIN_CLEARANCE_PX);
            }
        });
    });
}
