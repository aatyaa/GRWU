# GRWU

Interactive articles that teach gravitational-wave data analysis, in the spirit of
MLU-Explain. Real LIGO/Virgo data is analysed in the browser; each idea is offered at
three depths (intuition, math, code). The site is English-only; conversations with the
project owner are in Egyptian Arabic.

## Stack

- Astro 7 (static output) + Svelte 5 islands + MDX, TypeScript 6 (strict), pnpm, Node 22.
- Hosted on GitHub Pages at `https://aatyaa.github.io/GRWU/` (base path `/GRWU/`).
- Decisions and their reasons live in `docs/adr/`. Read them before changing the stack.

## Commands

```sh
pnpm dev          # dev server at http://localhost:4321/GRWU/ (drafts visible)
pnpm check        # lint + typecheck + unit tests + build + JS budgets: run before every push
pnpm test:e2e     # Playwright + axe against the production build (run `pnpm build` first)
pnpm format       # Prettier
```

Data pipeline (Python, uv), run from `pipeline/`:

```sh
uv run pytest                     # tests, including "committed outputs are current"
uv run ruff check . && uv run ruff format --check .
uv run grwu-pipeline synthetic    # regenerate public/data/synthetic/toy-chirp/
uv run grwu-pipeline fixtures     # regenerate tests/fixtures/dsp.json
```

- `grwu-pipeline fetch` needs gwosc.org, which Claude Code on the web blocks by default.
  Run the **Data** workflow on GitHub instead; it pushes a `data/<event>-<run>` branch.
- `BASE_PATH=/GRWU/pr-preview/pr-3/ pnpm build` builds for a PR preview; `SHOW_DRAFTS=1`
  includes draft articles.
- Astro 7 detaches `astro preview` into the background when it detects an AI agent. Use
  `pnpm exec astro preview --ignore-lock` to keep it in the foreground (Playwright does).

## Layout

- `src/content/articles/<slug>/index.mdx`: articles; schema in `src/content.config.ts`.
  `status: draft` articles are hidden from production builds.
- `src/pages/`: routes. `lab/` is a noindex workbench for components.
- `src/components/`: Astro and Svelte components. `src/elements/`: framework-free custom
  elements for lightweight in-prose interactions.
- `src/lib/`: shared TypeScript (content helpers, URL helpers; later DSP, data, workers).
- `src/styles/tokens.css`: design tokens, including the concept colour grammar.
- `tests/unit/` (Vitest), `tests/e2e/` (Playwright + axe), `tests/fixtures/` (scipy
  reference outputs, generated).
- `public/data/`: datasets as `<channel>.f32` (little-endian float32, stored as
  physical / `scale`) plus `meta.json`; see `docs/adr/0004-data-format.md`.
- `pipeline/`: the Python data pipeline (`grwu_pipeline/`, tests in `pipeline/tests/`).

## Conventions

- Internal links go through `withBase()` from `src/lib/url.ts`; never hard-code `/GRWU/`.
  In Playwright tests navigate with relative paths (`page.goto('about/')`).
- Concept colours (`--c-data`, `--c-signal`, `--c-template`, `--c-snr`, `--c-glitch`,
  `--c-noise`) are fixed per concept across the whole site. Prose text stays in ink; the
  colour goes on a marker next to it. The pairings validated for colour-blind safety are
  listed in `tokens.css`; do not add concept colours without re-running that check.
- Any DSP function must be tested against scipy/gwpy reference output before it is used.
- Every page must pass axe (checked in e2e, light and dark) and respect
  `prefers-reduced-motion`.
- Keep article pages light: text is static HTML, figures are islands loaded with
  `client:visible`, and heavy libraries (Three.js, Pyodide) load only where needed.
- TypeScript is pinned to 6.x because Astro/Svelte tooling and typescript-eslint do not
  support 7 yet. Playwright is pinned to 1.56.1 to match the Chromium preinstalled in
  Claude Code on the web.
