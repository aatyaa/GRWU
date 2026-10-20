import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/what-the-wrong-model-knows/');
});

test('opens with the title', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What the Wrong Model Knows');
});

test('the ring scrolly ends on the late fit', async ({ page }) => {
  const scrolly = page.locator('grwu-scrolly#ring');
  await scrolly.locator('.scrolly__steps > [data-step]').last().scrollIntoViewIfNeeded();
  await expect(scrolly).toHaveAttribute('data-active', '4');
});

test('the answer moves with the start of the fit, and the second tone fixes it', async ({
  page,
}) => {
  const lab = page.locator('.ring-lab');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-hydrated', 'true');
  const slider = lab.getByRole('slider');
  const read = (name: string) => async () => Number(await lab.getAttribute(`data-${name}`));
  await expect(lab).toHaveAttribute('data-start', '0.00');
  // From the peak, one tone answers far from 60 with a poor fit.
  expect(Number(await lab.getAttribute('data-answer'))).toBeGreaterThan(65);
  expect(Number(await lab.getAttribute('data-off'))).toBeGreaterThan(20);

  // At 2 ms the fit looks fine and the answer is still wrong by several error bars.
  await slider.fill('8');
  await expect(lab).toHaveAttribute('data-start', '2.00');
  await expect.poll(read('chi')).toBeLessThan(1.2);
  await expect.poll(read('off')).toBeGreaterThan(5);

  // Give the template the second tone and the answer is on the truth, from the peak.
  await slider.fill('0');
  await lab.getByLabel('Give the template the second tone').check();
  await expect.poll(read('off')).toBeLessThan(2);
  await expect.poll(async () => Math.abs((await read('answer')()) - 60)).toBeLessThan(1);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode with the mathematics open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const layer of await page.locator('details[data-layer="math"]').all()) {
      await layer.evaluate((details: HTMLDetailsElement) => (details.open = true));
    }
    const lab = page.locator('.ring-lab');
    await lab.scrollIntoViewIfNeeded();
    await expect(lab.locator('svg')).toBeVisible();
    await expectNoA11yViolations(page);
  });
}
