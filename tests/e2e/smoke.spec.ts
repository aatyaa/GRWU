import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const pages = [
  { path: '', heading: 'How do we know this was two black holes?' },
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

test('the home page lists the articles as cards', async ({ page }) => {
  await page.goto('');
  const cards = page.locator('#articles .card');
  await expect(cards).toHaveCount(4);
  await expect(cards.getByRole('link', { name: /The Shape of Error/ })).toBeVisible();
  // Planned articles are named but not linked.
  await expect(cards.getByText('What the Wrong Model Knows')).toBeVisible();
  await expect(cards.getByRole('link', { name: /What the Wrong Model Knows/ })).toHaveCount(0);
});

test('the signal under the scene is a map of the articles', async ({ page }) => {
  await page.goto('');
  const stage = page.locator('grwu-binary-hero .ovh');
  await expect(stage).toHaveAttribute('data-hero-ready', /.*/);
  await expect(stage).not.toHaveAttribute('data-hero-error', /.*/);
  const map = page.getByRole('navigation', { name: 'The signal, part by part' });
  await expect(map.getByRole('link')).toHaveCount(4);
  await map.getByRole('link', { name: /The merger/ }).focus();
  await expect(stage).toHaveAttribute('data-seg', 'merger');
  await map.getByRole('link', { name: /The noise/ }).click();
  await expect(page).toHaveURL(/articles\/the-shape-of-error\/$/);
});

test('the home page lets the reader try each move', async ({ page }) => {
  await page.goto('');
  const scroll = page.locator('.demo.scroll');
  await scroll.scrollIntoViewIfNeeded();
  await expect(scroll).toHaveAttribute('data-hydrated', 'true');
  await expect(scroll).toHaveAttribute('data-step', '0');
  await scroll.locator('.demo-steps').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(scroll).toHaveAttribute('data-step', '2');

  const drag = page.locator('.demo.drag');
  await expect(drag).toHaveAttribute('data-hydrated', 'true');
  const before = await drag.getAttribute('data-slope');
  await drag.getByRole('slider', { name: 'The movable point' }).focus();
  await page.keyboard.press('Home');
  await expect(drag).not.toHaveAttribute('data-slope', before ?? '');

  const math = page.locator('details.how__math');
  await math.locator('summary').click();
  await expect(math).toHaveAttribute('open', '');
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
