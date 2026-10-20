import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/from-strain-to-source/');
});

test('opens with the title', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From Strain to Source');
});

test('GW150914 lines up in both detectors about 7 ms apart, flipped', async ({ page }) => {
  const figure = page.locator('.network');
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  const before = Number(await figure.getAttribute('data-corr'));
  expect(Math.abs(before)).toBeLessThan(0.3);
  // 30 samples at 4096 Hz is 7.3 ms.
  await figure.getByRole('slider').fill('30');
  await figure.getByLabel('Flip its sign').check();
  await expect(figure).toHaveAttribute('data-shift', '7.3');
  await expect
    .poll(async () => Number(await figure.getAttribute('data-corr')))
    .toBeGreaterThan(0.6);
});

test('the posterior pins the chirp mass, not the two masses', async ({ page }) => {
  const figure = page.locator('.posterior');
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  const read = (name: string) => async () => Number(await figure.getAttribute(`data-${name}`));
  // Off the ridge: far less likely than the best.
  await expect.poll(read('rel')).toBeLessThan(-5);
  // Two very different pairs on the ridge are both about as good as the best.
  const [heavier, lighter] = await figure.getByRole('slider').all();
  await heavier.fill('32.2');
  await lighter.fill('32.2');
  await expect.poll(read('rel')).toBeGreaterThan(-2);
  await heavier.fill('50');
  await lighter.fill('21.5');
  await expect.poll(read('rel')).toBeGreaterThan(-2);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode with the mathematics open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const layer of await page.locator('details[data-layer="math"]').all()) {
      await layer.evaluate((details: HTMLDetailsElement) => (details.open = true));
    }
    for (const selector of ['.network', '.posterior']) {
      const element = page.locator(selector);
      await element.scrollIntoViewIfNeeded();
      await expect(element).toHaveAttribute('data-hydrated', 'true');
    }
    await expectNoA11yViolations(page);
  });
}
