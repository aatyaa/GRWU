import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/the-straightest-path/');
});

const hydrated = async (page: import('@playwright/test').Page, selector: string) => {
  const figure = page.locator(selector);
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-hydrated', 'true');
  return figure;
};
const num = (figure: import('@playwright/test').Locator, name: string) => async () =>
  Number(await figure.getAttribute(`data-${name}`));

test('opens with the title and is listed on the home page', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Straightest Path');
  await page.goto('');
  await page
    .locator('section[aria-labelledby="more-title"]')
    .getByRole('link', { name: /The Straightest Path/ })
    .click();
  await expect(page).toHaveURL(/the-straightest-path\/$/);
});

test('the falling box keeps its ring round at first, and the tide shows with time', async ({
  page,
}) => {
  const figure = await hydrated(page, '.falling-box');
  await expect(figure).toHaveAttribute('data-time', '0');
  await expect(figure).toHaveAttribute('data-squeeze', '0.000');
  await figure.getByLabel(/Time falling/).fill('1800');
  await expect.poll(num(figure, 'squeeze')).toBeGreaterThan(0.3);
  // A smaller box changes the distances, not the shape.
  const squeeze = await num(figure, 'squeeze')();
  await figure.getByLabel(/Size of the box/).fill('0');
  await expect(figure).toHaveAttribute('data-size', '1');
  expect(Math.abs((await num(figure, 'squeeze')()) - squeeze)).toBeLessThan(0.005);
});

test('every observer computes the same interval', async ({ page }) => {
  const figure = await hydrated(page, '.two-observers');
  await expect(figure).toHaveAttribute('data-dx', '3.00');
  await expect(figure).toHaveAttribute('data-interval', '-16.00');
  await figure.getByLabel(/Observer B's speed/).fill('0.6');
  await expect(figure).toHaveAttribute('data-dx', '0.00');
  await expect(figure).toHaveAttribute('data-cdt', '4.00');
  await expect(figure).toHaveAttribute('data-interval', '-16.00');
  // The event is also a keyboard slider: right moves it outwards.
  const handle = figure.getByRole('slider', { name: /second event/ });
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  expect(await num(figure, 'dx')()).toBeGreaterThan(0);
  await expect(figure).toHaveAttribute('data-interval', '-16.00');
});

test('the twin who stays put ages most', async ({ page }) => {
  const figure = await hydrated(page, '.twin-paths');
  await expect(figure).toHaveAttribute('data-home', '10.0');
  await expect(figure).toHaveAttribute('data-away', '8.00');
  const handle = figure.getByRole('slider', { name: /turns round/ });
  await handle.focus();
  // Turning round further out leaves the traveller with less time.
  await page.keyboard.press('Home');
  await expect.poll(num(figure, 'away')).toBeLessThan(2.5);
  // Back towards the stay-at-home's worldline, the two clocks agree again.
  for (let i = 0; i < 49; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(num(figure, 'away')).toBeGreaterThan(9.9);
});

test('walkers who start parallel meet at the pole', async ({ page }) => {
  const figure = await hydrated(page, '.curved-surface[data-mode="walkers"]');
  const start = await num(figure, 'gap')();
  await figure.getByLabel(/How far they have walked/).fill('1');
  await expect(figure).toHaveAttribute('data-gap', '0');
  expect(start).toBeGreaterThan(0);
});

test('an arrow carried round a loop comes back turned by the angle at the pole', async ({
  page,
}) => {
  const figure = await hydrated(page, '.curved-surface[data-mode="arrow"]');
  await expect(figure).toHaveAttribute('data-turned', '90.0');
  await figure.getByLabel(/Angle at the pole/).fill('45');
  await expect(figure).toHaveAttribute('data-turned', '45.0');
  await figure.getByLabel(/How far round/).fill('0.5');
  await expect(figure).toHaveAttribute('data-turned', '');
});

test('orbiting clocks run slow low down and fast at the GPS orbit', async ({ page }) => {
  const figure = await hydrated(page, '.orbit-clocks');
  await expect(figure).toHaveAttribute('data-net', '38.4');
  const handle = figure.getByRole('slider', { name: /Orbit radius/ });
  await handle.focus();
  await page.keyboard.press('Home');
  expect(await num(figure, 'net')()).toBeLessThan(0);
});

test('the orbit precesses more the closer it is', async ({ page }) => {
  const figure = await hydrated(page, '.mercury-orbit');
  const close = await num(figure, 'shift')();
  expect(close).toBeGreaterThan(30);
  await figure.getByLabel(/Move the orbit in/).fill('0');
  await expect.poll(num(figure, 'shift')).toBeLessThan(1e-4);
});

test('a math layer explains each step beside its equation', async ({ page }) => {
  const layer = page.locator('#m-newton');
  await layer.locator('summary').click();
  await expect(layer.locator('.step__why').first()).toContainText('Slow motion');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const selector of [
      '.falling-box',
      '.two-observers',
      '.twin-paths',
      '.curved-surface[data-mode="walkers"]',
      '.curved-surface[data-mode="arrow"]',
      '.orbit-clocks',
      '.mercury-orbit',
    ]) {
      await hydrated(page, selector);
    }
    await expectNoA11yViolations(page);
  });
}
