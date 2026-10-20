import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('articles/hidden-in-the-noise/');
});

test('opens with the title and the question', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hidden in the Noise');
});

test('whitening GW150914: the scrolly reaches the chirp', async ({ page }) => {
  const scrolly = page.locator('grwu-scrolly#whiten');
  const steps = scrolly.locator('.scrolly__steps > [data-step]');
  await steps.first().scrollIntoViewIfNeeded();
  await expect(scrolly).toHaveAttribute('data-active', '0');
  await steps.last().scrollIntoViewIfNeeded();
  await expect(scrolly).toHaveAttribute('data-active', '4');
  await expect(scrolly.locator('.whitening .s4').first()).toHaveCSS('opacity', '1');
});

test('dividing by the noise takes the vote away from the noisy frequency', async ({ page }) => {
  const figure = page.locator('.noise-weights');
  await figure.scrollIntoViewIfNeeded();
  // The server-rendered figure shows the same share; wait for the island to hydrate.
  await expect(page.locator('astro-island', { has: figure })).not.toHaveAttribute('ssr', /.*/);
  await expect(figure).toHaveAttribute('data-share', '89');
  await figure.getByRole('button', { name: 'Divide each miss by its noise' }).click();
  await expect(figure).toHaveAttribute('data-share', '19');
});

test('the matched filter finds the hidden chirp', async ({ page }) => {
  const figure = page.locator('.template-slide');
  await figure.scrollIntoViewIfNeeded();
  // data-seen becomes 1 once the island has hydrated and marked where the template starts.
  await expect(figure).toHaveAttribute('data-seen', '1');
  await expect(figure).toHaveAttribute('data-found', 'false');
  await figure.getByRole('slider').focus();
  await page.keyboard.press('ArrowRight');
  await expect(figure).toHaveAttribute('data-seen', '2');
  await figure.getByRole('button', { name: 'Scan the whole stretch' }).click();
  await expect(figure).toHaveAttribute('data-found', 'true');
  await expect(figure).toHaveAttribute('data-score', '20.2');
  await figure.getByRole('button', { name: 'Compare with noise alone' }).click();
  await expect(figure.getByText(/noise alone: never above 3\.9/)).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode with the mathematics open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const layer of await page.locator('details[data-layer="math"]').all()) {
      await layer.evaluate((details: HTMLDetailsElement) => (details.open = true));
    }
    for (const selector of ['.noise-weights', '.template-slide']) {
      const element = page.locator(selector);
      await element.scrollIntoViewIfNeeded();
      await expect(element.locator('svg')).toBeVisible();
    }
    await expectNoA11yViolations(page);
  });
}
