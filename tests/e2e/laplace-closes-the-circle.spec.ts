import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/laplace-closes-the-circle/');
});

const hydrated = async (page: import('@playwright/test').Page, selector: string) => {
  const figure = page.locator(selector);
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  return figure;
};
const num = (figure: import('@playwright/test').Locator, name: string) => async () =>
  Number(await figure.getAttribute(`data-${name}`));

test('opens with the title', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Laplace Closes the Circle');
});

test('least squares is the narrowest honest estimator, whatever the noise', async ({ page }) => {
  const figure = await hydrated(page, '.gauss-markov');
  for (const noise of ['A bell', 'Flat', 'Two-valued: ±1']) {
    await figure.getByLabel(noise).check();
    await expect
      .poll(async () => (await num(figure, 'ols')()) < (await num(figure, 'rival')()))
      .toBe(true);
  }
});

test('sums become a bell, unless the pieces are heavy-tailed', async ({ page }) => {
  const figure = await hydrated(page, '.sums');
  const slider = figure.getByRole('slider');
  await figure.getByLabel('Lopsided').check();
  await slider.fill('7');
  await expect(figure).toHaveAttribute('data-n', '50');
  await expect.poll(num(figure, 'tail')).toBeLessThan(0.002);
  await figure.getByLabel('Heavy-tailed, like glitches').check();
  await expect.poll(num(figure, 'tail')).toBeGreaterThan(0.05);
});

test('the prior removes the impossible negative masses', async ({ page }) => {
  const figure = await hydrated(page, '.negative-mass');
  expect(await num(figure, 'best')()).toBeLessThan(0);
  expect(await num(figure, 'median')()).toBeGreaterThan(0);
  await figure.getByRole('slider').fill('2');
  await expect.poll(num(figure, 'removed')).toBeLessThan(0.05);
});

test('Gauss–Newton finds a valley floor, not always the deepest', async ({ page }) => {
  const figure = await hydrated(page, '.gauss-newton');
  await figure.getByRole('button', { name: 'Keep stepping' }).click();
  await expect(figure).toHaveAttribute('data-deepest', 'false');
  await figure.getByRole('slider').fill('3.8');
  await figure.getByRole('button', { name: 'Keep stepping' }).click();
  await figure.getByRole('button', { name: 'Keep stepping' }).click();
  await expect(figure).toHaveAttribute('data-deepest', 'true');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode with the mathematics open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const layer of await page.locator('details[data-layer="math"]').all()) {
      await layer.evaluate((details: HTMLDetailsElement) => (details.open = true));
    }
    for (const selector of [
      '.gauss-markov',
      '.sums',
      '.negative-mass',
      '.prior-posterior',
      '.gauss-newton',
    ]) {
      await hydrated(page, selector);
    }
    await expectNoA11yViolations(page);
  });
}
