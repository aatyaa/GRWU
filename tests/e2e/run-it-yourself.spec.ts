import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/run-it-yourself/');
});

const hydrated = async (page: import('@playwright/test').Page, selector: string) => {
  const figure = page.locator(selector);
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  return figure;
};
const num = (figure: import('@playwright/test').Locator, name: string) => async () =>
  Number(await figure.getAttribute(`data-${name}`));

test('opens with the title and is linked from From Strain to Source', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Run It Yourself');
  await page.goto('articles/from-strain-to-source/');
  await page
    .getByRole('link', { name: /Read it/ })
    .last()
    .click();
  await expect(page).toHaveURL(/run-it-yourself\/$/);
});

test('the clock converts between UTC and GPS in both directions', async ({ page }) => {
  const clock = await hydrated(page, '.gps-clock');
  await expect(clock).toHaveAttribute('data-gps', '1126259462.4');
  await expect(clock).toHaveAttribute('data-leap', '17');
  await clock.getByRole('button', { name: 'GW170817' }).click();
  await expect(clock).toHaveAttribute('data-gps', '1187008882.4');
  await clock.getByLabel('GPS time').fill('1000000000');
  await expect(clock.getByLabel('UTC')).toHaveValue('2011-09-14 01:46:25');
  await clock.getByLabel('UTC').fill('not a time');
  await expect(clock.getByRole('alert')).toBeVisible();
});

test('fixing the spin narrows the mass ratio and moves it', async ({ page }) => {
  const figure = await hydrated(page, '.fixed-parameter');
  await expect(figure).toHaveAttribute('data-fixed', 'true');
  expect(Math.abs(await num(figure, 'shift')())).toBeGreaterThan(0.5);
  await figure.getByRole('slider').fill('0.12');
  await expect.poll(async () => Math.abs(await num(figure, 'shift')())).toBeLessThan(0.05);
  await figure.getByLabel('Fix the spin, as the tutorial does').uncheck();
  await expect(figure).toHaveAttribute('data-fixed', 'false');
});

test('the chirp mass leaves its prior, the phase does not', async ({ page }) => {
  const figure = await hydrated(page, '.prior-against');
  await expect(figure).toHaveAttribute('data-parameter', 'chirpMass');
  expect(await num(figure, 'share')()).toBeLessThan(0.2);
  await figure.getByLabel('Phase').check();
  await expect(figure).toHaveAttribute('data-parameter', 'phase');
  expect(await num(figure, 'share')()).toBeGreaterThan(0.85);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const selector of ['.gps-clock', '.fixed-parameter', '.prior-against']) {
      await hydrated(page, selector);
    }
    await expectNoA11yViolations(page);
  });
}
