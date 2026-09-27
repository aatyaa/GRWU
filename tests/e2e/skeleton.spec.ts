import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

// Figures are islands that hydrate when scrolled into view.
async function spectrumReady(page: Page) {
  const figure = page.locator('figure.spectrum');
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute('data-state', 'ready');
  return figure;
}

async function ringReady(page: Page) {
  const ring = page.locator('figure.ring');
  await ring.scrollIntoViewIfNeeded();
  await expect(ring).toHaveAttribute('data-backend', /^(webgpu|webgl2)$/);
  return ring;
}

test.beforeEach(async ({ page }) => {
  await page.goto('lab/skeleton/');
});

test('a link to a section opens it on arrival, whatever the depth', async ({ page }) => {
  // A fresh load (not a hash change): the depth dial must not close the target.
  await page.goto('about/');
  await page.goto('lab/skeleton/#code-welch');
  await expect(page.locator('details#code-welch')).toHaveAttribute('open', '');
  await expect(page.locator('details#math-welch')).not.toHaveAttribute('open');
});

test('computes the spectrum in the browser and follows its controls', async ({ page }) => {
  const figure = await spectrumReady(page);
  // 32 s of toy data in 4 s segments that overlap by half.
  await expect(figure).toHaveAttribute('data-dataset', 'toy-chirp');
  await expect(figure).toHaveAttribute('data-segments', '15');
  await expect(figure.locator('path.data')).toHaveAttribute('d', /^M[\d.]+,[\d.]+L/);

  const slider = figure.getByRole('slider', { name: /Segment length/ });
  await expect(slider).toHaveAttribute('aria-valuetext', '4 seconds');
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(figure).toHaveAttribute('data-segments', '31');
  await expect(figure.locator('figcaption')).toContainText('31 segments of 2 s');

  await figure.getByRole('radio', { name: 'median' }).check();
  await expect(figure).toHaveAttribute('data-state', 'ready');

  await figure.getByRole('combobox', { name: /^Data/ }).selectOption('gw150914-h1');
  await expect(figure).toHaveAttribute('data-dataset', 'gw150914-h1');
  await expect(figure.getByRole('img', { name: /LIGO Hanford/ })).toBeVisible();
  await expect(figure.getByRole('button', { name: 'Listen to the chirp alone' })).toHaveCount(0);
});

test('plays the data as sound, and stops', async ({ page }) => {
  const figure = await spectrumReady(page);
  await figure.getByRole('button', { name: 'Listen to the data' }).click();
  await expect(figure).toHaveAttribute('data-audio', 'playing');
  await figure.getByRole('button', { name: 'Stop' }).click();
  await expect(figure).toHaveAttribute('data-audio', 'idle');
});

test('links the equation and the figure both ways', async ({ page }) => {
  const figure = await spectrumReady(page);
  await page.locator('#math-welch > summary').click();
  const term = page.locator('#math-welch .katex-html [data-term="psd"]');

  await term.hover();
  await expect(figure).toHaveAttribute('data-highlight', 'psd');
  await page.locator('h1').hover();
  await expect(figure).toHaveAttribute('data-highlight', '');

  await figure.locator('svg').hover();
  await expect(term).toHaveClass(/is-highlighted/);
  await expect(figure.locator('.spectrum__readout')).toContainText(/Hz: .* × 10/);

  // The legend makes the same link from the keyboard.
  await page.locator('h1').hover();
  await page.getByRole('button', { name: /Ŝ\(f\), the estimate/ }).focus();
  await expect(figure).toHaveAttribute('data-highlight', 'psd');
});

test('the depth dial opens every section at that depth and is remembered', async ({ page }) => {
  const math = page.locator('details#math-welch');
  const code = page.locator('details#code-welch');
  await expect(math).not.toHaveAttribute('open');

  await page.getByRole('radio', { name: 'Math', exact: true }).check();
  await expect(math).toHaveAttribute('open', '');
  await expect(code).not.toHaveAttribute('open');

  await page.getByRole('radio', { name: 'Code', exact: true }).check();
  await expect(code).toHaveAttribute('open', '');

  await page.reload();
  await expect(page.getByRole('radio', { name: 'Code', exact: true })).toBeChecked();
  await expect(math).toHaveAttribute('open', '');
  await expect(code).toHaveAttribute('open', '');

  await page.getByRole('radio', { name: 'Intuition', exact: true }).check();
  await expect(math).not.toHaveAttribute('open');
  await expect(code).not.toHaveAttribute('open');
});

test('a section unfolds from the keyboard', async ({ page }) => {
  await page.locator('#math-welch > summary').focus();
  await page.keyboard.press('Enter');
  const math = page.locator('details#math-welch');
  await expect(math).toHaveAttribute('open', '');
  await expect(math.locator('.katex-mathml math')).toBeAttached();
  await page.keyboard.press('Enter');
  await expect(math).not.toHaveAttribute('open');
});

test('the margin peek opens the section it previews', async ({ page }) => {
  await page.getByRole('link', { name: /mean over k/ }).click();
  await expect(page).toHaveURL(/#math-welch$/);
  await expect(page.locator('details#math-welch')).toHaveAttribute('open', '');
});

test('the code panel shows the figure’s live settings', async ({ page }) => {
  const figure = await spectrumReady(page);
  await page.locator('#code-welch > summary').click();
  const code = page.locator('.code-panel pre');
  await code.scrollIntoViewIfNeeded();
  await expect(code).toContainText('nperseg=16384');
  await figure.getByRole('slider', { name: /Segment length/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(code).toContainText('nperseg=32768');
  await expect(page.getByRole('button', { name: 'Run in Python' })).toBeEnabled();
});

test('the 3D ring renders, pauses and follows the theme', async ({ page }) => {
  const ring = await ringReady(page);
  await expect(ring.locator('canvas')).toBeVisible();
  await ring.getByRole('button', { name: 'Pause' }).click();
  await expect(ring.getByRole('button', { name: 'Play' })).toBeVisible();

  await expect(ring).toHaveAttribute('data-color', /^rgb/);
  const light = await ring.getAttribute('data-color');
  const toggle = page.getByRole('button', { name: /^Theme:/ });
  await toggle.click();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(ring).not.toHaveAttribute('data-color', light ?? '');
});

test.describe('with reduced motion', () => {
  // emulateMedia, not test.use({ reducedMotion }): the option does not reach this Chromium.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
  });

  test('the ring starts paused and sections still unfold', async ({ page }) => {
    const ring = await ringReady(page);
    await expect(ring.getByRole('button', { name: 'Play' })).toBeVisible();
    await page.locator('#math-welch > summary').click();
    await expect(page.locator('details#math-welch')).toHaveAttribute('open', '');
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes axe in ${colorScheme} mode with every section open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.getByRole('radio', { name: 'Code', exact: true }).check();
    await spectrumReady(page);
    const code = page.locator('.code-panel pre');
    await code.scrollIntoViewIfNeeded();
    await expect(code).toContainText('signal.welch');
    await ringReady(page);
    await expectNoA11yViolations(page);
  });
}

test.describe('Python in the page', () => {
  // Pyodide, numpy and scipy come from jsDelivr, so this needs the network (CI sets it).
  test.skip(!process.env.PLAYWRIGHT_NETWORK, 'set PLAYWRIGHT_NETWORK=1 to run');
  test.skip(({ isMobile }) => isMobile, 'the worker is the same on every device');
  test.describe.configure({ timeout: 180_000 });

  test('scipy reproduces the figure', async ({ page }) => {
    await spectrumReady(page);
    await page.locator('#code-welch > summary').click();
    const panel = page.locator('.code-panel');
    await panel.getByRole('button', { name: 'Run in Python' }).click();
    await expect(panel).toHaveAttribute('data-state', 'done', { timeout: 150_000 });
    const worst = Number(await panel.getAttribute('data-agreement'));
    expect(worst).toBeLessThan(1e-6);
    await expect(panel).toContainText("scipy and this page's TypeScript agree");
  });
});
