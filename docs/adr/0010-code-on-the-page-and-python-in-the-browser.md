# 10. Code on the page is the code that ran; Python runs in the browser on request

- Status: proposed
- Date: 2026-09-30

## Context

The coding track and the last foundations article show real analysis code. Code pasted into
an article drifts from the code that produced the numbers, and a reader cannot tell. Some
examples are worth running, but Python in the browser is large, and heavy samplers do not run
there at all.

## Decision (proposed)

- **Highlighting at build time.** Code blocks are rendered by Expressive Code (Shiki), with
  no client JavaScript. Its theme uses only the site's tokens (ADR 0006): ink for code,
  ink-soft for comments, signal for literals, noise/model for keywords. No new colours.
- **Code is included, not pasted.** A remark plugin (built on `remark-code-import`) includes
  a named region of a source file (`# region: name` … `# endregion`) at a pinned revision and
  records its SHA-256. The build fails when the source changes and the page has not been
  updated.
- **Every runnable snippet is tested.** Its output is recorded; a unit test runs it under
  Pyodide in Node and compares.
- **Python on request.** Pyodide runs in a Web Worker (Comlink) with a CodeMirror 6 editor,
  both loaded only when the reader presses Run, so pages stay inside the up-front JS budget.
  Pyodide is served from the site (a pinned copy) rather than a CDN.
- **Heavy runs are shown, not rerun.** Sampler output is shown as recorded, with its hash and
  its provenance (who ran it, with which tool), next to a small version the browser can run.

## Open questions

- Whether the token-only highlighting theme is legible enough, or needs an exception to
  ADR 0006.
- The size of the self-hosted Pyodide copy on GitHub Pages.
