import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/almost-none-of-it/');
});

test('opens with the title', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Almost None of It Is About Gravitational Waves',
  );
});

test('the map: two gold leaves, and each leaf explains itself', async ({ page }) => {
  const map = page.locator('.skill-map');
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute('data-hydrated', 'true');
  await expect(map.locator('.leaf.gold')).toHaveCount(2);
  await map.getByRole('button', { name: 'Fourier analysis' }).click();
  await expect(map).toHaveAttribute('data-selected', 'fourier');
  await expect(map.getByText('transfers to any field with noisy data')).toBeVisible();
  await map.getByLabel('Show only what is specific to gravitational waves').check();
  await expect(map.locator('.leaf.dim')).toHaveCount(12);
});

test('a heavier binary sings lower, and less of its inspiral is heard', async ({ page }) => {
  const song = page.locator('.same-song');
  await song.scrollIntoViewIfNeeded();
  await expect(song).toHaveAttribute('data-hydrated', 'true');
  await song.getByRole('button', { name: /A light binary/ }).click();
  await expect(song).toHaveAttribute('data-mass', '20');
  const light = Number(await song.getAttribute('data-cycles'));
  const lightIsco = Number(await song.getAttribute('data-isco'));
  await song.getByRole('button', { name: /A heavy one/ }).click();
  await expect(song).toHaveAttribute('data-mass', '180');
  expect(Number(await song.getAttribute('data-cycles'))).toBeLessThan(light / 10);
  expect(Number(await song.getAttribute('data-isco'))).toBeLessThan(lightIsco / 5);
});

test('a fixed prior ignores the data', async ({ page }) => {
  const figure = page.locator('.prior-posterior');
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  expect(Math.abs(Number(await figure.getAttribute('data-median')) - 6.2)).toBeLessThan(0.1);
  await figure.getByLabel('Fixed at 4').check();
  await expect.poll(async () => Number(await figure.getAttribute('data-median'))).toBeCloseTo(4, 1);
  await figure.getByLabel('Ten times more data').check();
  await expect.poll(async () => Number(await figure.getAttribute('data-median'))).toBeCloseTo(4, 1);
});

test('the library route names the library for each step', async ({ page }) => {
  const route = page.locator('.library-route');
  await route.scrollIntoViewIfNeeded();
  await expect(route).toHaveAttribute('data-hydrated', 'true');
  await route.getByRole('button', { name: /Measure the source/ }).click();
  await expect(route).toHaveAttribute('data-lib', 'Bilby');
  await expect(route.getByText('bilby.run_sampler(')).toBeVisible();
  await route.getByRole('button', { name: /Find the data/ }).click();
  await expect(route).toHaveAttribute('data-lib', 'gwosc');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode with the mathematics open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const layer of await page.locator('details[data-layer="math"]').all()) {
      await layer.evaluate((details: HTMLDetailsElement) => (details.open = true));
    }
    for (const selector of ['.skill-map', '.prior-posterior', '.same-song', '.library-route']) {
      const element = page.locator(selector);
      await element.scrollIntoViewIfNeeded();
      await expect(element).toHaveAttribute('data-hydrated', 'true');
    }
    await expectNoA11yViolations(page);
  });
}
