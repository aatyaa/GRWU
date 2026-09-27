import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const pages = [
  { path: '', heading: 'Gravitational-wave data analysis, explained visually' },
  { path: 'about/', heading: 'About GRWU' },
  { path: 'lab/', heading: 'Lab' },
];

for (const { path, heading } of pages) {
  test(`"${path || 'home'}" renders and passes axe`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expectNoA11yViolations(page);
  });
}

test('dark theme passes axe', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('lab/');
  await expectNoA11yViolations(page);
});

test('unknown pages show the 404 page', async ({ page }) => {
  await page.goto('no-such-page/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

test('the home page lists the essays in review or published', async ({ page }) => {
  await page.goto('');
  await expect(
    page.locator('.cards').getByRole('link', { name: /The Shape of Error/ }),
  ).toBeVisible();
  // Planned essays are named but not linked.
  await expect(page.getByText('Hidden in the Noise')).toBeVisible();
  await expect(page.getByRole('link', { name: /Hidden in the Noise/ })).toHaveCount(0);
});

test('the home page runs the GW250114 scene', async ({ page }) => {
  await page.goto('');
  const stage = page.locator('grwu-binary-hero .ovh');
  await expect(stage).toHaveAttribute('data-hero-ready', /.*/);
  await expect(stage).not.toHaveAttribute('data-hero-error', /.*/);
  await expect(page.getByRole('button', { name: 'Scientific' })).toBeVisible();
});

test('Svelte islands hydrate', async ({ page }) => {
  await page.goto('lab/');
  const island = page.locator('.island-check');
  await expect(island).toHaveAttribute('data-hydrated', 'true');
  const button = island.getByRole('button');
  await button.click();
  await button.click();
  await expect(button).toHaveText('Clicked 2 times');
});

test('theme toggle cycles and survives a reload', async ({ page }) => {
  await page.goto('');
  const toggle = page.getByRole('button', { name: /^Theme:/ });
  await expect(toggle).toHaveText('Theme: auto');

  await toggle.click();
  await expect(toggle).toHaveText('Theme: light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: /^Theme:/ })).toHaveText('Theme: dark');
});
