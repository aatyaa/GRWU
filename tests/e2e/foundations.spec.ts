import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

test.describe.configure({ timeout: 180_000 });

test('A Bell That Weighs Itself: rings respond, the ring weighs the black hole', async ({
  page,
}) => {
  await page.goto('articles/a-bell-that-weighs-itself/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A Bell That Weighs Itself');

  const spring = page.locator('.spring-lab');
  await spring.scrollIntoViewIfNeeded();
  await expect(spring).toHaveAttribute('data-hydrated', 'true');
  const tau = await spring.getAttribute('data-tau');
  await spring.getByLabel(/Friction/).fill('1.2');
  await expect(spring).not.toHaveAttribute('data-tau', tau!);

  const kerr = page.locator('.kerr-ring');
  await kerr.scrollIntoViewIfNeeded();
  await expect(kerr).toHaveAttribute('data-hydrated', 'true');
  await expect(kerr).toHaveAttribute('data-read-mass', '60.00');
  await kerr.getByLabel(/Redshift/).fill('0.5');
  await expect(kerr).toHaveAttribute('data-read-mass', '90.00');

  const predict = page.locator('.predict');
  await predict.scrollIntoViewIfNeeded();
  await predict.getByLabel('half that frequency').check();
  await expect(predict.getByText(/twice the mass, half the frequency/)).toBeVisible();

  const ex = page
    .locator('.exercise')
    .filter({ has: page.getByRole('heading', { name: /Weigh a black hole/ }) });
  await ex.scrollIntoViewIfNeeded();
  await expect(ex).toHaveAttribute('data-hydrated', 'true');
  await ex.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(
    'def mass_from_ring(f, chi):\n    return m_omega(chi) / (2 * math.pi * f) / T_SUN\n',
  );
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex).toHaveAttribute('data-state', 'passed', { timeout: 150_000 });

  await expect(page.locator('.prepares a')).toHaveCount(3);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoA11yViolations(page);
  }
});
