import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/a-peak-is-only-a-candidate/');
});

const hydrated = async (page: import('@playwright/test').Page, selector: string) => {
  const figure = page.locator(selector);
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  return figure;
};
const num = (figure: import('@playwright/test').Locator, name: string) => async () =>
  Number(await figure.getAttribute(`data-${name}`));

test('opens with the title and is linked from Hidden in the Noise', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Peak Is Only a Candidate');
  await page.goto('articles/hidden-in-the-noise/');
  await page
    .getByRole('link', { name: /Read it/ })
    .first()
    .click();
  await expect(page).toHaveURL(/a-peak-is-only-a-candidate\/$/);
});

test('the maps are drawn at build time, as images inside SVG masks', async ({ page }) => {
  for (const id of ['map-gw150914', 'map-before', 'map-after']) {
    await expect(page.locator(`mask#${id} image`)).toHaveAttribute(
      'href',
      /^data:image\/png;base64,/,
    );
  }
});

test('a glitch as loud as the chirp fails the χ² test', async ({ page }) => {
  const figure = await hydrated(page, '.chi-test');
  await expect(figure).toHaveAttribute('data-case', 'chirp');
  expect(await num(figure, 'chi')()).toBeLessThan(2);
  await figure.getByLabel('A glitch just as loud').check();
  await expect(figure).toHaveAttribute('data-case', 'glitch');
  await expect.poll(num(figure, 'chi')).toBeGreaterThan(20);
});

test('nothing in the time-slid background is as loud as the candidate', async ({ page }) => {
  const figure = await hydrated(page, '.time-slides');
  await expect(figure).toHaveAttribute('data-mode', 'exclusive');
  await expect(figure).toHaveAttribute('data-louder', '0');
  const quiet = await num(figure, 'loudest')();
  await figure.getByLabel(/Leave the candidate's own triggers/).check();
  await expect(figure).toHaveAttribute('data-mode', 'inclusive');
  await expect.poll(num(figure, 'loudest')).toBeGreaterThan(quiet);
  await expect(figure).toHaveAttribute('data-louder', '0');
});

test('raising the line trades false alarms for missed signals', async ({ page }) => {
  const figure = await hydrated(page, '.threshold');
  const [line, strength] = await figure.getByRole('slider').all();
  await strength.fill('10');
  await line.fill('3');
  await expect(figure).toHaveAttribute('data-threshold', '3.0');
  expect(await num(figure, 'per-year')()).toBeGreaterThan(1e6);
  expect(await num(figure, 'pd')()).toBeGreaterThan(0.99);
  await line.fill('12');
  await expect(figure).toHaveAttribute('data-threshold', '12.0');
  expect(await num(figure, 'per-year')()).toBeLessThan(1e-10);
  expect(await num(figure, 'pd')()).toBeLessThan(0.1);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode with the mathematics open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const layer of await page.locator('details[data-layer="math"]').all()) {
      await layer.evaluate((details: HTMLDetailsElement) => (details.open = true));
    }
    for (const selector of ['.chi-test', '.time-slides', '.threshold']) {
      await hydrated(page, selector);
    }
    await expectNoA11yViolations(page);
  });
}
