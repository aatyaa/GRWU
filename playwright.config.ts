import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const port = 4321;
const base = process.env.BASE_PATH ?? '/GRWU/';
const baseURL = `http://localhost:${port}${base}`;
const PRIVATE_E2E = 'private/track/tests/e2e';

// Tests run against the production build (`pnpm build` first), served by `astro preview`.
// Navigate with relative paths ('about/', not '/about/') so the base path is kept.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // The gated track's tests, from the private repository when it is cloned (ADR 0007).
    ...(existsSync(PRIVATE_E2E)
      ? [
          { name: 'desktop-ringdown', testDir: PRIVATE_E2E, use: { ...devices['Desktop Chrome'] } },
          { name: 'mobile-ringdown', testDir: PRIVATE_E2E, use: { ...devices['Pixel 7'] } },
        ]
      : []),
  ],
  webServer: {
    // --ignore-lock keeps the server in the foreground: Astro 7 otherwise detaches
    // `astro preview` into the background when it detects an AI agent, and Playwright
    // then sees the process exit.
    command: `pnpm exec astro preview --port ${port} --ignore-lock`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
