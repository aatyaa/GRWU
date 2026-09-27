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
- `PLAYWRIGHT_NETWORK=1 pnpm test:e2e` also runs the tests that fetch Pyodide from jsDelivr.
  jsDelivr is blocked in Claude Code on the web, so these run in CI.
- Astro 7 detaches `astro preview` into the background when it detects an AI agent. Use
  `pnpm exec astro preview --ignore-lock` to keep it in the foreground (Playwright does).

## Layout

- `src/content/articles/<slug>/index.mdx`: articles; schema in `src/content.config.ts`.
  `status: draft` articles are hidden from production builds.
- `src/pages/`: routes. `lab/` is a noindex workbench for components.
- `src/components/`: Astro and Svelte components. `src/elements/`: framework-free custom
  elements for lightweight in-prose interactions.
  - `depth/`: the Depth Lens (ADR 0005). `<Unfold layer="math|code">` is a native
    `<details data-layer>`; `<DepthDial>` opens every layer at the chosen depth and
    remembers it; `<Peek>` previews a layer in the margin (anchor positioning, inline
    fallback).
  - `math/Eq.astro`: KaTeX at build time. Tag terms with `\htmlData{term=<id>}{...}` and list
    them in `terms` with a concept colour; they link to figures through `highlightedTerm`.
  - `three/`: Threlte scenes from `@threlte/core/webgpu` (WebGPU, WebGL2 fallback).
  - `lab/`: figures of the `/lab/skeleton` workbench, the models for article figures.
- `src/lib/`: shared TypeScript.
  - `dsp/`: `rfft`/`irfft` (fft.js, power-of-two lengths), `hann`, `welch` (scipy defaults,
    mean or median). Tested against `tests/fixtures/dsp.json`.
  - `data/dataset.ts`: `loadDataset(withBase('data/...'))` fetches meta.json and channels and
    checks SHA-256; `toPhysical()` multiplies by `scale`.
  - `workers/`: `dspWorker()` (Comlink) runs DSP off the main thread; `python/`'s
    `pythonWorker()` runs Pyodide in a worker, loading the runtime from jsDelivr on first
    use. The Pyodide npm version pins the runtime version; keep them equal.
  - `state/`: nanostores shared by islands (`depth`, `highlightedTerm`, `reducedMotion`,
    `createParams`). `gpu/detect.ts`: WebGPU, else WebGL2.
  - `dsp/models.ts`: analytic noise models (Advanced LIGO design PSD). `audio/play.ts`:
    plays 4096 Hz data through Web Audio. `format.ts`: `8.0 × 10⁻²⁴`-style numbers.
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
  `prefers-reduced-motion`. In Playwright emulate it with `page.emulateMedia()`: the
  `reducedMotion` test option does not take effect with the pinned Chromium.
- Figures expose their state as `data-*` attributes (`data-state="ready"`, `data-segments`,
  `data-highlight`) so tests wait on state, not on timing.
- Keep article pages light: text is static HTML, figures are islands loaded with
  `client:visible`, and heavy libraries (Three.js, Pyodide) load only where needed.
- TypeScript is pinned to 6.x because Astro/Svelte tooling and typescript-eslint do not
  support 7 yet. Playwright is pinned to 1.56.1 to match the Chromium preinstalled in
  Claude Code on the web.
