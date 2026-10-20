import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const PATH = 'articles/the-shape-of-error/';

// Islands hydrate when they scroll into view. The server-rendered SVG is visible before that,
// so wait for Astro to drop the island's `ssr` attribute before pressing keys or buttons.
async function island(page: Page, selector: string) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await expect(element.locator('svg')).toBeVisible();
  await expect(page.locator('astro-island', { has: element })).not.toHaveAttribute('ssr', /.*/);
  return element;
}

test.beforeEach(async ({ page }) => {
  await page.goto(PATH);
});

test('opens with the title, the question and the byline', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Shape of Error');
  await expect(page.getByText('How do you find what you cannot see?')).toBeVisible();
  await expect(page.getByText('Attia A. Gadallah').first()).toBeVisible();
});

test('the scrollytelling figure follows the story to the best fit', async ({ page }) => {
  const steps = page.locator('grwu-scrolly .scrolly__steps > [data-step]');
  await steps.first().scrollIntoViewIfNeeded();
  const figure = page.locator('.gauss');
  await expect(figure).toHaveAttribute('data-step', '0');
  await steps.last().scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-step', '4');
  await expect(figure.getByText('the smallest possible')).toBeVisible();
});

test('least squares: the reader can move the line, and Gauss finds the minimum', async ({
  page,
}) => {
  const figure = await island(page, '.least-squares');
  const before = Number(await figure.getAttribute('data-total'));
  const best = Number(await figure.getAttribute('data-best'));
  expect(before).toBeGreaterThan(best);

  await figure.getByRole('slider', { name: 'Left end of the line' }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(figure).not.toHaveAttribute('data-total', before.toFixed(3));

  await figure.getByRole('button', { name: 'Let Gauss choose' }).click();
  await expect(figure).toHaveAttribute('data-total', best.toFixed(3));
  await expect(figure.getByText('the smallest it can be')).toBeVisible();
  await expect(figure.getByRole('button', { name: 'Let Gauss choose' })).toBeDisabled();
});

test('three costs, three answers: the mean follows the outlier', async ({ page }) => {
  const figure = await island(page, '.norms');
  await expect(figure).toHaveAttribute('data-mean', '0.40');
  await figure.getByRole('slider', { name: 'The measurement that disagrees' }).focus();
  await page.keyboard.press('Home');
  await expect(figure).toHaveAttribute('data-mean', '-0.19');
});

test('the bell appears once there are enough errors', async ({ page }) => {
  const figure = await island(page, '.error-shape');
  await expect(figure.locator('.bell')).not.toHaveClass(/shown/);
  const slider = figure.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('End');
  await expect(figure).toHaveAttribute('data-n', '2500');
  await expect(figure.locator('.bell')).toHaveClass(/shown/);
});

test('the likelihood is the product, and the poor point decides it', async ({ page }) => {
  const figure = await island(page, '.likelihood');
  const before = Number(await figure.getAttribute('data-product'));
  await figure.getByRole('slider', { name: 'Miss of point 4' }).focus();
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await expect
    .poll(async () => Number(await figure.getAttribute('data-product')))
    .toBeGreaterThan(before * 5);
});

test('residuals show what the model is missing', async ({ page }) => {
  const figure = await island(page, '.residuals');
  await expect(figure.getByText(/a wave survives/)).toBeVisible();
  await figure.getByRole('button', { name: 'Give the model the wave' }).click();
  await expect(figure).toHaveAttribute('data-complete', 'true');
  await expect(figure.getByText(/no shape left/)).toBeVisible();
});

test('a mathematical layer opens to its derivation', async ({ page }) => {
  const layer = page.locator('details#m1');
  await expect(layer).not.toHaveAttribute('open');
  await layer.locator('summary').click();
  await expect(layer).toHaveAttribute('open', '');
  await expect(layer.locator('.hinge')).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode with the mathematics open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const layer of await page.locator('details[data-layer="math"]').all()) {
      await layer.evaluate((details: HTMLDetailsElement) => (details.open = true));
    }
    for (const selector of [
      '.gauss',
      '.least-squares',
      '.norms',
      '.error-shape',
      '.likelihood',
      '.residuals',
    ]) {
      await island(page, selector);
    }
    await expectNoA11yViolations(page);
  });
}
