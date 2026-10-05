import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function expectNoA11yViolations(page: Page) {
  // Figures fade in when they scroll into view, and a reveal can begin a frame after a check
  // (or while axe scrolls). Reveal everything first, then measure contrast once every fade has
  // arrived, checked again two frames later so a late start is not missed.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('[data-reveal]')) {
      element.classList.add('is-revealed');
    }
  });
  const calm = () =>
    page.waitForFunction(
      () => document.getAnimations().every((animation) => animation.playState !== 'running'),
      undefined,
      { timeout: 5000 },
    );
  await calm();
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await calm();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
