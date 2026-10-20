# 10. Practice in the page: Python in the browser, checked exercises

- Status: accepted
- Date: 2026-09-30

## Context

Each article should let the reader practise, not only read: write real code against the
lesson's data and be told, precisely, what is still wrong. The owner asked for the strongest
current libraries at their newest stable versions, working together, and only free, open-source
tools and services. The site is static on GitHub Pages.

Compared: Pyodide, PyScript, JupyterLite, marimo, Thebe with mybinder.org, Colab, Kaggle,
Replit, StackBlitz WebContainers, Sandpack; Monaco and CodeMirror 6; Quarto Live, futurecoder,
DataCamp Light, otter-grader; friendly-traceback and the Raspberry Pi Foundation's
python-friendly-error-messages; Python Tutor, birdseye and snoop.

## Decision

- **Runtime: Pyodide 314.0.7** (Python 3.14.2; numpy 2.4.6, scipy 1.18.0, matplotlib 3.10.8
  as built for it) in a Web Worker, loaded on the first Run. PyScript adds a layer we do not
  need; JupyterLite and marimo are whole applications, heavy and foreign to the page; Colab,
  Kaggle, Replit and WebContainers are not open source.
- **Self-hosted, verified.** `scripts/pyodide-assets.mjs` (run by `pnpm dev`, `build` and
  `test`) copies the core from the pinned npm package and the scientific packages from the
  matching GitHub release into `public/pyodide/` (git-ignored), checking every file's SHA-256
  against Pyodide's lock file; snoop 0.6.1 and cheap-repr 0.5.2 come from PyPI, pinned by
  hash. CI, the tests and readers run the same files, with no CDN in the way.
- **Editor: CodeMirror 6** (codemirror 6.0.2, view 6.43.13, state 6.7.6, lang-python 6.2.1;
  one copy of the state package): accessible, works on phones, about 150 kB with the error
  explainer, loaded with the exercise. Monaco is 2–5 MB and poor on mobile. Highlighting uses
  only the site's tokens (ADR 0006).
- **Exercises** follow Quarto Live's model (hidden setup, starter, hints, solution, checker)
  and futurecoder's teaching (small steps, feedback that says what is wrong, hints one at a
  time, the solution after a try). A checker is Python defining `check(ns, output)` that raises
  `Feedback("…")`. Definitions live in `src/lib/exercises/`; `<Exercise>` renders one.
- **Errors for beginners:** the Raspberry Pi Foundation's python-friendly-error-messages 0.8.0
  (Apache-2.0, Pyodide-first), using its browser build (aliased in `astro.config.mjs`; its Node
  build has broken imports), with Python's own traceback, reduced to the reader's frames, one
  click away. friendly-traceback was set aside: last released in 2022, no Python 3.14.
- **Step through:** snoop records every line and value. birdseye needs a Flask server;
  Python Tutor's current code is not published.
- **Stop:** terminates the worker; the next Run starts a fresh one from the browser's cache.
  An interrupt through SharedArrayBuffer would need cross-origin isolation, which GitHub Pages
  cannot declare and a service-worker workaround would impose on every page.
- **Progress** (code and solved state) is kept in IndexedDB on the reader's device only
  (idb-keyval 6.3.0). No accounts, nothing sent.
- **Heavy work** (samplers on JAX, the ringdown package) does not run in Pyodide; where a
  track needs it, it links to mybinder.org as an optional extra, not as the practice itself.

## Consequences

- Every exercise is tested in CI through the same runner the reader uses, under Pyodide in
  Node: its solution must pass, every listed wrong answer must be turned down with feedback,
  and the starter must not pass (`tests/unit/exercises.test.ts`). Browser behaviour (checking,
  hints, errors, Stop, saved progress, axe in both themes) is in `tests/e2e/practice.spec.ts`.
- The first Run downloads about 6 MB of Python, plus numpy (3 MB) or scipy (14 MB) only when
  imported; later runs come from the cache. Pages that only read pay nothing.
- The build fetches the Pyodide release once per machine (cached in `.cache/pyodide/`).
