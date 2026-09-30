import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

// The public side of the gated ringdown track (ADR 0007): the teaser and the locked articles.
// Unlocking is tested where the access codes are, in the private repository.

test('the track page lists the articles and asks for a code', async ({ page }) => {
  await page.goto('ringdown/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Heavier Than Its Parents');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('grwu-sealed')).toHaveAttribute('data-state', 'locked');
  await expect(page.locator('.track__list li').first()).toBeVisible();
});

test('an article stays locked, and a wrong code is refused', async ({ page }) => {
  await page.goto('ringdown/three-masses/');
  const gate = page.locator('grwu-sealed');
  await expect(gate).toHaveAttribute('data-state', 'locked');
  await expect(page.locator('.trajectory')).toHaveCount(0);
  await gate.getByLabel('Access code').fill('RD-01-AAAA-BBBB-CCCC');
  await gate.getByRole('button', { name: 'Open' }).click();
  await expect(gate).toHaveAttribute('data-state', 'wrong');
  await expect(gate.getByRole('alert')).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the locked pages pass axe in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const path of ['ringdown/', 'ringdown/three-masses/']) {
      await page.goto(path);
      await expect(page.locator('grwu-sealed')).toHaveAttribute('data-state', 'locked');
      await expectNoA11yViolations(page);
    }
  });
}
