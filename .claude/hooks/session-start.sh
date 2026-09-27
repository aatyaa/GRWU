#!/bin/bash
# Installs project dependencies when a Claude Code on the web session starts,
# so lint, typecheck, unit and e2e tests can run right away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# JS toolchain (Astro, Svelte, ESLint, Vitest, Playwright). Playwright's Chromium is
# preinstalled in the web environment (PLAYWRIGHT_BROWSERS_PATH), matching the pinned version.
pnpm install --frozen-lockfile --prefer-offline

# Python data pipeline, once it exists.
if [ -f pipeline/pyproject.toml ]; then
  (cd pipeline && uv sync --frozen)
fi
