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
  - `editorial/`: the talks' vocabulary (ADR 0006): `Eyebrow`, `Pull`, `Facts`, `Card`
    (`tone="caveat"` for the warnings nobody writes down), `Figure` (evidence label:
    measured, model, schematic, control; `width="text|medium|wide"`), `Scrolly`.
  - `math/`: `Eq` (KaTeX at build time; tagged terms defined underneath and linked to
    figures through `highlightedTerm`), and the mathematical layer: `MathLayer` with
    `Claim`, `Given`, `Steps`/`Step` (`hinge` marks the step the argument turns on), `Means`.
  - `depth/`: `DepthDial` (story only / with the mathematics) and `Peek` (margin note that
    opens a layer). ADR 0005.
  - `figures/`: the essays' figures. Astro components are static SVG computed at build
    time; Svelte ones are interactive islands (`client:visible`).
  - `brand/`: the AG monogram and the signature. `site/`: header rail, footer, `Title`.
  - `three/`: Threlte scenes from `@threlte/core/webgpu` (WebGPU, WebGL2 fallback).
  - `lab/`: work in progress for later figures (the spectrum figure).
- `src/lib/`: shared TypeScript.
  - `dsp/`: `rfft`/`irfft` (fft.js, power-of-two lengths), `hann`, `welch` (scipy defaults,
    mean or median). Tested against `tests/fixtures/dsp.json`.
  - `data/dataset.ts`: `loadDataset(withBase('data/...'))` fetches meta.json and channels and
    checks SHA-256; `toPhysical()` multiplies by `scale`.
  - `workers/`: `dspWorker()` (Comlink) runs DSP off the main thread.
  - `state/`: nanostores shared by islands (`depth`, `highlightedTerm`, `scrollySteps`,
    `reducedMotion`, `createParams`). `gpu/detect.ts`: WebGPU, else WebGL2.
  - `stats/`: seeded randomness (`mulberry32`, `gaussian`) so every figure draws the same
    sample, and the estimators the essays compare (`mean`, `median`, `midrange`,
    `fitLine`, `fitLinear`, `normalPdf`, `diceTotals`).
  - `figure/pointer.ts`: dragging in SVG units, arrow-key stepping, tweens.
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
- Colour carries meaning (ADR 0006): amber `--signal` is the signal and anything measured;
  blue-grey `--noise`/`--model` is noise, models and schematics (models dashed); red
  `--bias` is bias and disagreement, always labelled; green `--ok` is agreement. Text stays
  in ink. Do not add colours; small text must pass AA on `--ground` and `--surface`.
- Essays are written in the talks' voice: short declarative headings, a pull line per idea,
  history before formalism, and honest limits (a `Card tone="caveat"`). Every figure gets
  an evidence label and a mono caption that says what to look at.
- Interactive figures: draw at real pixel size (`bind:clientWidth`), every draggable handle
  is also a keyboard slider (`stepKey`), and state is exposed as `data-*` attributes.
- Any DSP function must be tested against scipy/gwpy reference output before it is used.
- Every page must pass axe (checked in e2e, light and dark) and respect
  `prefers-reduced-motion`. In Playwright emulate it with `page.emulateMedia()`: the
  `reducedMotion` test option does not take effect with the pinned Chromium.
- Tests wait on figure state (`data-*` attributes), never on timing; the axe helper waits
  for fade-in animations to finish before measuring contrast.
- Keep article pages light: text is static HTML, figures are islands loaded with
  `client:visible`, and heavy libraries (Three.js) load only where needed.
- TypeScript is pinned to 6.x because Astro/Svelte tooling and typescript-eslint do not
  support 7 yet. Playwright is pinned to 1.56.1 to match the Chromium preinstalled in
  Claude Code on the web.
