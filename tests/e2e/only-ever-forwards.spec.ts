import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/only-ever-forwards/');
});

const hydrated = async (page: import('@playwright/test').Page, selector: string) => {
  const figure = page.locator(selector);
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  return figure;
};
const num = (figure: import('@playwright/test').Locator, name: string) => async () =>
  Number(await figure.getAttribute(`data-${name}`));

test('opens with the title and follows on from Mass, Spin and Nothing Else', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Only Ever Forwards');
  await page.goto('articles/mass-spin-and-nothing-else/');
  await page.getByRole('link', { name: /Only Ever Forwards/ }).click();
  await expect(page).toHaveURL(/only-ever-forwards\/$/);
});

test('the area theorem allows a still remnant of 14.2 solar masses but not 13, nor a spinning one', async ({
  page,
}) => {
  const figure = await hydrated(page, '.area-theorem');
  await expect(figure).toHaveAttribute('data-allowed', 'true');
  const mass = figure.getByRole('slider', { name: /Mass of the final hole/ });
  await mass.fill('13');
  await expect(figure).toHaveAttribute('data-allowed', 'false');
  await mass.fill('14.2');
  await expect(figure).toHaveAttribute('data-allowed', 'true');
  // A spinning hole has a smaller horizon for its mass, so it must keep more of it.
  await figure.getByRole('slider', { name: /Its spin/ }).fill('0.69');
  await expect(figure).toHaveAttribute('data-allowed', 'false');
});

test('a hole is colder than the sky unless it is lighter than about the Moon', async ({ page }) => {
  const figure = await hydrated(page, '.hawking-dial');
  await expect(figure).toHaveAttribute('data-fate', 'growing');
  const solar = await num(figure, 'temp')();
  expect(solar).toBeLessThan(1e-7);
  await figure.getByRole('slider', { name: /Mass of the hole/ }).fill('20');
  await expect(figure).toHaveAttribute('data-fate', 'evaporating');
  expect(await num(figure, 'temp')()).toBeGreaterThan(2.7);
});

test('the two polarisations stretch the ring one way, then the other', async ({ page }) => {
  const figure = await hydrated(page, '.polarisation');
  expect(await num(figure, 'plus-ratio')()).toBeGreaterThan(1.3);
  const moment = figure.getByRole('slider', { name: /Moment in the wave/ });
  await moment.fill('180');
  await expect.poll(num(figure, 'plus-ratio')).toBeLessThan(0.8);
  await moment.fill('90');
  await expect.poll(num(figure, 'plus-ratio')).toBeCloseTo(1, 2);
});

test('a weakly hyperbolic system amplifies errors more on finer grids', async ({ page }) => {
  const figure = await hydrated(page, '.well-posed');
  const grid = figure.getByRole('slider', { name: /Points on the grid/ });
  await grid.fill('0');
  await expect(figure).toHaveAttribute('data-n', '16');
  const coarse = await num(figure, 'weak')();
  await grid.fill('5');
  await expect(figure).toHaveAttribute('data-n', '512');
  expect(await num(figure, 'weak')()).toBeGreaterThan(20 * coarse);
  expect(await num(figure, 'strong')()).toBeLessThan(1.6);
});

test('every figure is on the page, and the entropy ledger shows the gain', async ({ page }) => {
  await expect(page.locator('figure.figure')).toHaveCount(11);
  await expect(page.locator('.entropy-ledger')).toContainText('gained 1.30 × 10⁸⁰');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode, mathematics open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const selector of ['.area-theorem', '.hawking-dial', '.polarisation', '.well-posed']) {
      await hydrated(page, selector);
    }
    for (const details of await page.locator('article details').all()) {
      await details.evaluate((el: HTMLDetailsElement) => (el.open = true));
    }
    await expectNoA11yViolations(page);
  });
}
