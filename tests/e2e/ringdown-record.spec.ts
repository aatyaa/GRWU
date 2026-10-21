import { webcrypto as crypto } from 'node:crypto';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

// The reading record of the gated track (ADR 0011), against a stand-in for the sealed files:
// a test code that opens a test chapter, so no real code or article appears here. The form
// service is intercepted; nothing leaves the browser.

const CODE = 'RD-99-TEST-CODE-ABCD';
const CHAPTER = 'weighing-the-ring';
const SECRET = 'A sentence only an accepted reader can see.';

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

async function sealedFixture() {
  const enc = new TextEncoder();
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const contentKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const article = `<article class="prose"><h1>Test chapter</h1><p class="secret">${SECRET}</p></article>`;
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    contentKey,
    enc.encode(JSON.stringify({ article, styles: [], modules: [] })),
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', enc.encode(CODE), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, kek, raw);
  return {
    keys: {
      iterations: 1000,
      entries: { '99': { salt: b64(salt), iv: b64(wrapIv), data: b64(new Uint8Array(wrapped)) } },
    },
    box: { iv: b64(iv), data: b64(new Uint8Array(data)) },
  };
}

/** Serves the stand-in sealed files and collects what is posted to the form service. */
async function stage(page: Page, service: { ok: boolean }) {
  const fixture = await sealedFixture();
  const records: Record<string, string>[] = [];
  await page.route('**/ringdown-sealed/keys.json', (route) =>
    route.fulfill({ json: fixture.keys }),
  );
  await page.route(`**/ringdown-sealed/${CHAPTER}.json`, (route) =>
    route.fulfill({ json: fixture.box }),
  );
  await page.route('https://api.web3forms.com/submit', async (route: Route) => {
    if (!service.ok) return route.fulfill({ status: 503, json: { success: false } });
    records.push(route.request().postDataJSON() as Record<string, string>);
    return route.fulfill({ json: { success: true } });
  });
  return records;
}

async function enterCode(page: Page) {
  const gate = page.locator('grwu-sealed');
  await expect(gate).toHaveAttribute('data-state', 'locked');
  await gate.getByLabel('Access code').fill(CODE);
  await gate.getByRole('button', { name: 'Open' }).click();
  return gate;
}

async function acceptTerms(page: Page) {
  const gate = page.locator('grwu-sealed');
  await expect(gate).toHaveAttribute('data-state', 'terms');
  await gate.getByLabel('Your full name').fill('Ada Lovelace');
  await gate.getByLabel('Your email').fill('ada@example.org');
  await gate.getByLabel('I have read these terms and I accept them.').check();
  await gate.getByRole('button', { name: 'Accept and open' }).click();
}

test('a first reading needs the terms accepted, and is recorded with the reader', async ({
  page,
}) => {
  const records = await stage(page, { ok: true });
  await page.goto(`ringdown/${CHAPTER}/`);
  const gate = await enterCode(page);
  await expect(gate).toHaveAttribute('data-state', 'terms');
  await expect(page.locator('.secret')).toHaveCount(0);

  // An incomplete name is refused before anything is sent.
  await gate.getByLabel('Your full name').fill('Ada');
  await gate.getByLabel('Your email').fill('ada@example.org');
  await gate.getByLabel('I have read these terms and I accept them.').check();
  await gate.getByRole('button', { name: 'Accept and open' }).click();
  await expect(gate.locator('[data-terms-problem]')).toBeVisible();
  expect(records).toHaveLength(0);

  await gate.getByLabel('Your full name').fill('Ada Lovelace');
  await gate.getByRole('button', { name: 'Accept and open' }).click();
  await expect(page.locator('.secret')).toHaveText(SECRET);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    event: 'Accepted the terms and opened a chapter',
    name: 'Ada Lovelace',
    email: 'ada@example.org',
    access_code_number: '99',
  });
  expect(records[0].terms_sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(records[0])).not.toContain(CODE);

  // The chapter carries the reader's name.
  await expect(page.locator('article[data-unsealed]')).toHaveAttribute(
    'data-reader',
    'Ada Lovelace',
  );
  await expect(page.locator('.sealed-notice')).toContainText(
    'reading copy for Ada Lovelace (code 99)',
  );
  await expect(page.locator('.sealed-watermark')).toHaveCount(1);
});

test('a chapter whose opening cannot be recorded stays closed until it can', async ({ page }) => {
  const service = { ok: false };
  const records = await stage(page, service);
  await page.goto(`ringdown/${CHAPTER}/`);
  await enterCode(page);
  await acceptTerms(page);
  const gate = page.locator('grwu-sealed');
  await expect(gate).toHaveAttribute('data-state', 'unrecorded');
  await expect(page.locator('.secret')).toHaveCount(0);

  service.ok = true;
  await gate.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.secret')).toHaveText(SECRET);
  expect(records).toHaveLength(1);
});

test('the acceptance is recorded once: returning is not recorded again', async ({ page }) => {
  const records = await stage(page, { ok: true });
  await page.goto(`ringdown/${CHAPTER}/`);
  await enterCode(page);
  await acceptTerms(page);
  await expect(page.locator('.secret')).toHaveText(SECRET);
  expect(records).toHaveLength(1);

  // Seeing one chapter is seeing the track: later visits open directly, with the reader's
  // name still on the page, and send nothing.
  await page.reload();
  await expect(page.locator('.secret')).toHaveText(SECRET);
  await expect(page.locator('.sealed-notice')).toContainText('Ada Lovelace');
  await page.goto('ringdown/');
  await expect(page.locator('grwu-sealed')).toHaveAttribute('data-state', 'open');
  expect(records).toHaveLength(1);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the terms pass axe in ${colorScheme} mode`, async ({ page }) => {
    await stage(page, { ok: true });
    await page.emulateMedia({ colorScheme });
    await page.goto(`ringdown/${CHAPTER}/`);
    const gate = await enterCode(page);
    await expect(gate).toHaveAttribute('data-state', 'terms');
    await expectNoA11yViolations(page);
  });
}
