import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

// Python runs in the browser (ADR 0010): the first start loads Pyodide from the site.
test.describe.configure({ timeout: 180_000 });

async function exercise(page: Page, name: RegExp): Promise<Locator> {
  const ex = page.locator('.exercise').filter({ has: page.getByRole('heading', { name }) });
  await ex.scrollIntoViewIfNeeded();
  await expect(ex).toHaveAttribute('data-hydrated', 'true');
  return ex;
}

async function typeCode(page: Page, ex: Locator, code: string) {
  const editor = ex.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  // One insertion, like a paste, so the editor's auto-indent does not re-indent the code.
  await page.keyboard.insertText(code);
}

test('an exercise checks an answer, explains a wrong one and remembers a solved one', async ({
  page,
}) => {
  await page.goto('lab/');
  const ex = await exercise(page, /How long does a ring last/);

  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex).toHaveAttribute('data-state', 'failed', { timeout: 120_000 });
  await expect(ex.locator('.exercise__verdict')).toContainText('still returns nothing');

  await typeCode(page, ex, 'def quality_factor(f, tau):\n    return f * tau\n');
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex).toHaveAttribute('data-state', 'failed');
  await expect(ex.locator('.exercise__verdict')).toContainText('Q is π times it');

  await ex.getByRole('button', { name: 'Show a hint' }).click();
  await expect(ex.locator('.exercise__hint')).toHaveCount(1);
  await ex.getByRole('button', { name: 'Show the solution' }).click();
  await expect(ex.locator('.exercise__solution')).toContainText('math.pi * f * tau');

  await typeCode(
    page,
    ex,
    'import math\ndef quality_factor(f, tau):\n    return math.pi * f * tau\n',
  );
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex).toHaveAttribute('data-state', 'passed');
  await expect(ex).toHaveAttribute('data-solved', 'true');

  await page.reload();
  const again = await exercise(page, /How long does a ring last/);
  await expect(again).toHaveAttribute('data-solved', 'true');
  await expect(again.locator('.cm-content')).toContainText('math.pi * f * tau');
  await again.getByRole('button', { name: 'Reset' }).click();
  await expect(again.locator('.cm-content')).toContainText('return ...');

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoA11yViolations(page);
  }
});

test('errors are explained, runaway code can be stopped, and scipy works', async ({ page }) => {
  await page.goto('lab/');
  const ex = await exercise(page, /How long does a ring last/);

  await typeCode(page, ex, 'prnt("hello")\n');
  await ex.getByRole('button', { name: 'Run' }).click();
  await expect(ex).toHaveAttribute('data-state', 'error', { timeout: 120_000 });
  await expect(ex.locator('.exercise__friendly')).toBeVisible();
  await expect(ex.locator('.exercise__error')).toContainText('NameError');

  await typeCode(page, ex, 'while True:\n    pass\n');
  await ex.getByRole('button', { name: 'Run' }).click();
  await expect(ex).toHaveAttribute('data-state', 'running');
  await ex.getByRole('button', { name: 'Stop' }).click();
  await expect(ex).toHaveAttribute('data-state', 'stopped');

  const welch = await exercise(page, /Find the hidden tone/);
  await typeCode(
    page,
    welch,
    'from scipy import signal\nimport numpy as np\nfreqs, psd = signal.welch(x, fs=fs, nperseg=512)\npeak = freqs[np.argmax(psd)]\nprint(peak)\n',
  );
  await welch.getByRole('button', { name: 'Check' }).click();
  await expect(welch).toHaveAttribute('data-state', 'passed', { timeout: 150_000 });
  await expect(welch.locator('.exercise__stdout')).toContainText('40.0');
});
