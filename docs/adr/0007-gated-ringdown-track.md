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
- The gate: `pnpm seal:ringdown` (a full build with the private folder, then
  `scripts/seal-ringdown.mjs`) encrypts each track page's `<article>` with a fresh AES-GCM
  content key and wraps that key once per access code (PBKDF2-SHA256). The ciphertext
  (`public/ringdown-sealed/`) and the compiled scripts and styles those articles load
  (`public/ringdown-assets/`) are committed here; the codes are not. Public builds, which
  have no private folder, serve shells: title, summary and a code box (`<grwu-sealed>`,
  `src/elements/sealed.ts`) that decrypts the article in the browser and remembers the code
  in that browser.
- Each reader gets their own code (`scripts/ringdown-codes.mjs`, kept in
  `private/access/`). Revoking one means marking it and sealing again.
- Access requests go through a form service (Web3Forms) that emails the owner, so the site
  never shows an address; its public key is `PUBLIC_ACCESS_FORM_KEY`.

## Consequences

- Public CI never sees the track's sources and needs no secret; the track is checked where
  the private folder is present. After any change to the track, seal again and commit.
- A code can be passed on; the ciphertext is public, so codes must stay long and random.
- The compiled figure components (no data: that travels inside the encrypted article) are
  readable, as are the titles and summaries.
- The paper's numbers and figures are not reproduced from public data here: the track
  draws the paper's own figure data, exported by `private/track/scripts/export_figdata.py`.
