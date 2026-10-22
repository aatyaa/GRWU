import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/mass-spin-and-nothing-else/');
});

const hydrated = async (page: import('@playwright/test').Page, selector: string) => {
  const figure = page.locator(selector);
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  return figure;
};
const num = (figure: import('@playwright/test').Locator, name: string) => async () =>
  Number(await figure.getAttribute(`data-${name}`));

test('opens with the title and follows on from The Straightest Path', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mass, Spin and Nothing Else');
  await page.goto('articles/the-straightest-path/');
  await page.getByRole('link', { name: /Mass, Spin and Nothing Else/ }).click();
  await expect(page).toHaveURL(/mass-spin-and-nothing-else\/$/);
});

test('outward light stands still on the horizon and falls in below it', async ({ page }) => {
  const figure = await hydrated(page, '.tipping-cones');
  expect(await num(figure, 'outward')()).toBeGreaterThan(0);
  const handle = figure.getByRole('slider', { name: /Where the cone sits/ });
  await handle.focus();
  // From 2.2 r_s down to the horizon in 0.05 steps.
  for (let i = 0; i < 24; i++) await page.keyboard.press('ArrowLeft');
  await expect(figure).toHaveAttribute('data-r', '1.00');
  await expect(figure).toHaveAttribute('data-outward', '0.000');
  await page.keyboard.press('Home');
  expect(await num(figure, 'outward')()).toBeLessThan(0);
});

test('white dwarfs shrink as they grow heavier, and stop existing at the limit', async ({
  page,
}) => {
  const figure = await hydrated(page, '.white-dwarf');
  const light = await num(figure, 'radius')();
  expect(light).toBeGreaterThan(6000);
  const handle = figure.getByRole('slider', { name: /Mass of the white dwarf/ });
  await handle.focus();
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowRight');
  await expect(figure).toHaveAttribute('data-mass', '1.20');
  expect(await num(figure, 'radius')()).toBeLessThan(light);
  await page.keyboard.press('End');
  await expect(figure).toHaveAttribute('data-radius', 'none');
});

test('the far clock never sees the surface cross the horizon', async ({ page }) => {
  const figure = await hydrated(page, '.two-clocks');
  expect(await num(figure, 'far')()).toBeGreaterThan(await num(figure, 'tau')());
  await figure.getByLabel(/On the surface's own clock/).fill('1.2');
  await expect(figure).toHaveAttribute('data-far', 'never');
  expect(await num(figure, 'r')()).toBeLessThan(1);
});

test('spin pulls the last stable orbit in, and past χ = 1 there is no horizon', async ({
  page,
}) => {
  const figure = await hydrated(page, '.kerr-radii');
  await figure.getByLabel(/Spin/).fill('0');
  await expect(figure).toHaveAttribute('data-isco', '6.000');
  await expect(figure).toHaveAttribute('data-horizon', '2.000');
  await figure.getByLabel(/Spin/).fill('0.9');
  expect(await num(figure, 'isco')()).toBeLessThan(2.4);
  await figure.getByLabel(/Spin/).fill('1.05');
  await expect(figure).toHaveAttribute('data-horizon', 'none');
});

test('a heavy enough hole swallows a star whole and spares a person at its horizon', async ({
  page,
}) => {
  const figure = await hydrated(page, '.tidal-stretch');
  await expect(figure).toHaveAttribute('data-star', 'torn');
  expect(await num(figure, 'tide')()).toBeGreaterThan(1e6);
  await figure.getByLabel(/Mass of the hole/).fill('9');
  await expect(figure).toHaveAttribute('data-star', 'swallowed');
  expect(await num(figure, 'tide')()).toBeLessThan(1e-3);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const selector of [
      '.tipping-cones',
      '.white-dwarf',
      '.two-clocks',
      '.kerr-radii',
      '.tidal-stretch',
    ]) {
      await hydrated(page, selector);
    }
    await expectNoA11yViolations(page);
  });
}
