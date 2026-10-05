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

test('Every Signal Is a Chord: tones, aliases, windows and real detector noise', async ({
  page,
}) => {
  await page.goto('articles/every-signal-is-a-chord/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every Signal Is a Chord');

  const mixer = page.locator('.tone-mixer');
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer).toHaveAttribute('data-hydrated', 'true');
  await expect(mixer).toHaveAttribute('data-peaks', '5,12,30');
  await mixer.getByRole('checkbox', { name: 'Tone 3' }).uncheck();
  await expect(mixer).toHaveAttribute('data-peaks', '5,12');

  const scope = page.locator('.aliasing');
  await scope.scrollIntoViewIfNeeded();
  await expect(scope).toHaveAttribute('data-hydrated', 'true');
  await scope.getByLabel(/Frequency of the tone/).fill('45');
  await scope.getByLabel(/Samples per second/).fill('64');
  await expect(scope).toHaveAttribute('data-alias', '19');
  await expect(scope).toHaveAttribute('data-aliased', 'true');

  const lab = page.locator('.window-lab');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-hydrated', 'true');
  const rectangle = Number(await lab.getAttribute('data-leak'));
  await lab.getByLabel(/Hann/).check();
  await expect(lab).toHaveAttribute('data-window', 'hann');
  expect(Number(await lab.getAttribute('data-leak'))).toBeLessThan(rectangle - 20);

  const psd = page.locator('.psd');
  await psd.scrollIntoViewIfNeeded();
  await expect(psd).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  const quiet = Number(await psd.getAttribute('data-quietest'));
  expect(quiet).toBeGreaterThan(50);
  expect(quiet).toBeLessThan(600);
  const segments = await psd.getAttribute('data-segments');
  await psd.getByLabel('4 s').check();
  await expect(psd).not.toHaveAttribute('data-segments', segments!);
  await expect(psd).toHaveAttribute('data-state', 'ready');

  const ex = page
    .locator('.exercise')
    .filter({ has: page.getByRole('heading', { name: /Where does a tone end up/ }) });
  await ex.scrollIntoViewIfNeeded();
  await expect(ex).toHaveAttribute('data-hydrated', 'true');
  await ex.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('def alias(f, fs):\n    return abs(f - fs * round(f / fs))\n');
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex).toHaveAttribute('data-state', 'passed', { timeout: 150_000 });

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoA11yViolations(page);
  }
});

test('How Sure Is Sure?: a sampler walks, intervals differ, correlated samples overstate', async ({
  page,
}) => {
  await page.goto('articles/how-sure-is-sure/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('How Sure Is Sure?');

  const sampler = page.locator('.sampler');
  await sampler.scrollIntoViewIfNeeded();
  await expect(sampler).toHaveAttribute('data-hydrated', 'true');
  await sampler.getByLabel(/Step size/).fill('0.05');
  const timid = Number(await sampler.getAttribute('data-acceptance'));
  expect(timid).toBeGreaterThan(0.75);
  await sampler.getByLabel(/Step size/).fill('3');
  expect(Number(await sampler.getAttribute('data-acceptance'))).toBeLessThan(0.3);

  const intervals = page.locator('.intervals');
  await intervals.scrollIntoViewIfNeeded();
  await expect(intervals).toHaveAttribute('data-hydrated', 'true');
  await intervals.getByLabel('very').check();
  await expect(intervals).toHaveAttribute('data-shape', '1');
  const et = Number(await intervals.getAttribute('data-et-width'));
  const hd = Number(await intervals.getAttribute('data-hdi-width'));
  expect(hd).toBeLessThan(et);

  const sigma = page.locator('.sigma');
  await sigma.scrollIntoViewIfNeeded();
  await expect(sigma).toHaveAttribute('data-hydrated', 'true');
  await sigma.getByLabel(/remembers/).fill('0');
  expect(Number(await sigma.getAttribute('data-ratio'))).toBeLessThan(1.3);
  await sigma.getByLabel(/remembers/).fill('0.95');
  expect(Number(await sigma.getAttribute('data-ratio'))).toBeGreaterThan(3);

  const ex = page
    .locator('.exercise')
    .filter({ has: page.getByRole('heading', { name: /Quote a credible interval/ }) });
  await ex.scrollIntoViewIfNeeded();
  await expect(ex).toHaveAttribute('data-hydrated', 'true');
  await ex.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(
    'import numpy as np\nlo, hi = np.quantile(samples, [0.05, 0.95])\n',
  );
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex).toHaveAttribute('data-state', 'passed', { timeout: 150_000 });

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoA11yViolations(page);
  }
});

test('Fitting a Ring in Noise: the fit finds the valley, injections calibrate the error bar', async ({
  page,
}) => {
  await page.goto('articles/fitting-a-ring-in-noise/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fitting a Ring in Noise');

  const fit = page.locator('.ring-fit');
  await fit.scrollIntoViewIfNeeded();
  await expect(fit).toHaveAttribute('data-hydrated', 'true');
  await expect(fit).toHaveAttribute('data-fitted', 'false');
  const before = Number(await fit.getAttribute('data-chi2'));
  await fit.getByRole('button', { name: 'Fit it for me' }).click();
  await expect(fit).toHaveAttribute('data-fitted', 'true');
  const after = Number(await fit.getAttribute('data-chi2'));
  expect(after).toBeLessThan(before);
  expect(Math.abs(after - 1)).toBeLessThan(0.25);
  await fit.getByRole('button', { name: 'Reset' }).click();
  await fit.getByLabel(/Frequency/).fill('300');
  await expect(fit).toHaveAttribute('data-f', '300.0');

  const injections = page.locator('.injections');
  await injections.scrollIntoViewIfNeeded();
  await expect(injections).toHaveAttribute('data-done', 'true', { timeout: 60_000 });
  const spread = Number(await injections.getAttribute('data-spread'));
  const reported = Number(await injections.getAttribute('data-reported'));
  expect(Math.abs(spread / reported - 1)).toBeLessThan(0.2);
  expect(Math.abs(Number(await injections.getAttribute('data-mean')) - 250)).toBeLessThan(2);
  await injections.getByLabel('loud').check();
  await expect(injections).toHaveAttribute('data-level', 'loud');
  await expect(injections).toHaveAttribute('data-done', 'true', { timeout: 60_000 });
  expect(Number(await injections.getAttribute('data-spread'))).toBeLessThan(spread / 1.5);

  const ex = page
    .locator('.exercise')
    .filter({ has: page.getByRole('heading', { name: /Score a fit/ }) });
  await ex.scrollIntoViewIfNeeded();
  await expect(ex).toHaveAttribute('data-hydrated', 'true');
  await ex.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(
    'import numpy as np\ndef reduced_chi2(data, model, sigma, k):\n    return np.sum(((data - model) / sigma) ** 2) / (len(data) - k)\n',
  );
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex).toHaveAttribute('data-state', 'passed', { timeout: 150_000 });

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoA11yViolations(page);
  }
});

test('From Data File to Claim: the trail, a broken link, honest digits', async ({ page }) => {
  await page.goto('articles/from-data-file-to-claim/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('From Data File to Claim');

  const steps = page.locator('#claim [data-step]');
  await steps.nth(4).scrollIntoViewIfNeeded();
  await expect(page.locator('#claim')).toHaveAttribute('data-active', '4');
  await expect(page.locator('.claim-trail .s4')).toBeVisible();

  const link = page.locator('.break-link');
  await link.scrollIntoViewIfNeeded();
  await expect(link).toHaveAttribute('data-hydrated', 'true');
  const quiet = Number(await link.getAttribute('data-claim-f'));
  await link.getByLabel(/16,384 samples/).check();
  await expect(link).toHaveAttribute('data-claim-f', String(4 * quiet));
  await link.getByLabel(/One byte changes/).check();
  await expect(link).toHaveAttribute('data-hash', 'ready', { timeout: 30_000 });
  await expect(link).toHaveAttribute('data-original-ok', 'true');
  await expect(link).toHaveAttribute('data-flipped-ok', 'false');

  const seeds = page.locator('.seed-spread');
  await seeds.scrollIntoViewIfNeeded();
  await expect(seeds).toHaveAttribute('data-hydrated', 'true');
  const wide = Number(await seeds.getAttribute('data-spread'));
  await seeds.getByLabel('100,000').check();
  await expect(seeds).toHaveAttribute('data-n', '100000');
  expect(Number(await seeds.getAttribute('data-spread'))).toBeLessThan(wide / 4);

  const ex = page
    .locator('.exercise')
    .filter({ has: page.getByRole('heading', { name: /Read a posterior file/ }) });
  await ex.scrollIntoViewIfNeeded();
  await expect(ex).toHaveAttribute('data-hydrated', 'true');
  await ex.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(
    'import numpy as np\nsamples = np.genfromtxt("posterior.csv", delimiter=",", names=True)\nmass = samples["final_mass"]\nmedian = np.median(mass)\nlo, hi = np.quantile(mass, [0.05, 0.95])\n',
  );
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex).toHaveAttribute('data-state', 'passed', { timeout: 150_000 });

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoA11yViolations(page);
  }
});
