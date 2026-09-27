# 2. GitHub Pages with PR previews

- Status: accepted
- Date: 2026-09-27

## Context

The site is static. The project owner reviews every change, often from a phone, so each
pull request needs a live preview.

## Decision

Publish to GitHub Pages from the `gh-pages` branch:

- Pushes to `main` build with base `/GRWU/` and deploy to the root of `gh-pages`
  (JamesIves/github-pages-deploy-action, with `clean-exclude: pr-preview/`).
- Each pull request builds with base `/GRWU/pr-preview/pr-<n>/` and drafts visible, and is
  deployed to that folder by rossjrw/pr-preview-action, which removes it when the PR
  closes.
- The base path comes from the `BASE_PATH` environment variable at build time.

Alternatives considered: Cloudflare Pages (built-in previews and custom headers, but a
second account) and Vercel/Netlify (tighter free tiers).

## Consequences

- No accounts beyond GitHub; Pages must be enabled once (source: `gh-pages`, root).
- `public/.nojekyll` is required so GitHub Pages serves Astro's `_astro/` folder.
- GitHub Pages cannot set custom headers. If cross-origin isolation is ever needed
  (multi-threaded WebAssembly), use coi-serviceworker or move hosting; the build does not
  depend on the host.
- Preview pages are marked `noindex`.
