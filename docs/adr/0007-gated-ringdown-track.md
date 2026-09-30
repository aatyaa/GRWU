# 7. The ringdown track is private at the source and gated on the site

- Status: accepted (the gate itself is built when the track is finished)
- Date: 2026-09-30

## Context

One track teaches an unpublished paper by the project owner, section by section, with its
own figures drawn from its own data. It will be on the site, but only for readers the
owner lets in: a reader asks for access, the request reaches the owner by email, and the
owner replies with a way in.

The site is static on GitHub Pages and the repository is public. Anything committed here
can be read on GitHub, so a gate on the page alone would lock nothing.

## Decision

- The track's sources (articles, their components, the paper's figure data) live in a
  private companion repository, `aatyaa/GRWU-private`, cloned at `private/` and ignored
  by git. Its `track/` folder holds the site sources; `paper/` holds the paper package,
  which is reference material and is never built.
- The site reads it through the `ringdown` content collection (`private/track/articles`),
  the `/ringdown/<slug>/` route and the `@track` alias. Vitest and Playwright pick up the
  track's tests from `private/track/tests/` when the folder exists. Without it the
  collection is empty and every public build, test and preview is unaffected.
- The track's pages are `noindex`.
- The gate, when the track is finished: the deploy workflow clones the private repository
  with a read-only secret and encrypts each track page at build time (AES-GCM, key derived
  from an access code with PBKDF2). A visitor sees the title, a summary and an access
  request form, which reaches the owner by email; the owner replies with the code, and
  the page decrypts in the browser.

## Consequences

- Public CI never sees the track; it is checked where the private folder is present
  (Claude Code sessions, the owner's machine, and the deploy job once the gate exists).
- An access code can be passed on. Rotating it means changing one secret and redeploying.
- The paper's numbers and figures are not reproduced from public data here: the track
  draws the paper's own figure data, exported by `private/track/scripts/export_figdata.py`.
