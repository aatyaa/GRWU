import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const pages = [
  { path: '', heading: 'How do we know this was two black holes?' },
  { path: 'about/', heading: 'About GRWU' },
  { path: 'start/', heading: 'Start here' },
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
  for (const title of [
    'The Shape of Error',
    'Hidden in the Noise',
    'What the Wrong Model Knows',
    'From Strain to Source',
  ]) {
    await expect(cards.getByRole('link', { name: new RegExp(title) })).toBeVisible();
  }
});

test('the home page lists the further articles', async ({ page }) => {
  await page.goto('');
  const more = page.locator('section[aria-labelledby="more-title"] .card');
  await expect(more.getByRole('link', { name: /Almost None of It/ })).toBeVisible();
  await expect(more.getByRole('link', { name: /Laplace Closes the Circle/ })).toBeVisible();
});

test('the home page presents the ringdown track', async ({ page }) => {
  await page.goto('');
  const track = page.locator('#ringdown-track');
  await expect(track.getByRole('heading', { level: 2 })).toHaveText('Heavier Than Its Parents');
  await expect(track.locator('.track__chapters > li')).toHaveCount(9);
  await expect(track.getByRole('link', { name: /Weighing the Ring/ })).toHaveAttribute(
    'href',
    /ringdown\/weighing-the-ring\/$/,
  );
  await track.getByRole('link', { name: 'I have a code' }).click();
  await expect(page).toHaveURL(/ringdown\/$/);
});

test('the start page lists the foundations series and the symbols', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('start/');
  await expect(page.locator('.series > li')).toHaveCount(5);
  await expect(page.locator('.glossary > div').first()).toBeVisible();
  await expect(page.locator('#term-spin dt')).toContainText('dimensionless spin');
  await expectNoA11yViolations(page);
});

test('the home page presents every track', async ({ page }) => {
  await page.goto('');
  const start = page.locator('#start');
  await expect(start.locator('.start__list > li')).toHaveCount(5);
  await expect(start.getByRole('link', { name: /Start the foundations/ })).toHaveAttribute(
    'href',
    /start\/$/,
  );
  await expect(page.locator('#ringdown-track .track__next')).toContainText('The Code Behind It');
  const open = page.locator('#open-tracks .open__card');
  await expect(open).toHaveCount(5);
  for (const project of ['mcmc-demo', 'MatchedFiltering', 'ringdown', 'anesthetic']) {
    await expect(page.locator('#open-tracks').getByRole('link', { name: project })).toBeVisible();
  }
});

test('the learning components answer, explain and tally', async ({ page }) => {
  await page.goto('lab/');
  const predict = page.locator('.predict');
  await predict.scrollIntoViewIfNeeded();
  await expect(predict).toHaveAttribute('data-hydrated', 'true');
  await expect(predict.getByText('Half: the frequency')).toHaveCount(0);
  await predict.getByLabel('half the frequency').check();
  await expect(predict.getByText('Half: the frequency')).toBeVisible();

  const check = page.locator('.check');
  await check.scrollIntoViewIfNeeded();
  await expect(check).toHaveAttribute('data-hydrated', 'true');
  await check.getByLabel('About 10').check();
  await expect(check.locator('.choice').first()).toHaveAttribute('data-correct', 'false');
  await check.getByLabel('About 31').check();
  await check.getByLabel('19 Hz').check();
  await expect(check).toHaveAttribute('data-right', '2');
  await expect(check.locator('.check__tally')).toContainText('2 of 2 right');

  await expect(page.locator('a.term[href$="start/#term-spin"]')).toHaveText('its spin');
  await expect(page.locator('.prepares a')).toHaveCount(2);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoA11yViolations(page);
  }
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
