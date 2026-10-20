import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      '@track': fileURLToPath(new URL('./private/track', import.meta.url)),
    },
  },
  test: {
    // The gated track's tests live in the private repository when it is cloned (ADR 0007).
    include: ['tests/unit/**/*.test.ts', 'private/track/tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
