# GRWU

Interactive articles that teach gravitational-wave data analysis, in the spirit of
MLU-Explain: web articles with scrollytelling and figures the reader moves, not slides.
Real LIGO/Virgo data drives the figures; each idea has an optional mathematical layer that
opens in place. The talks by Attia A. Gadallah are the guide for what an article covers and
how deep it goes, not for its layout. The site is English-only; conversations with the
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
uv run grwu-pipeline fixtures     # regenerate tests/fixtures/dsp.json and kerr.json
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
  - `hero/BinaryHero.astro`: the home page's GW250114 black-hole scene (ADR 0006).
    `<grwu-binary-hero>` loads `lib/hero/engine.js` (vendored WebGL1 lensing engine with a
    2D fallback) and `public/data/gw250114-overture.json` only near the viewport, and stops
    rendering off screen. State is exposed as `data-hero-*`; `?hero=<seconds>` freezes it. The
    recorded signal under it is a map of the articles (`segments`: noise, inspiral, merger,
    ringdown); pointing at a part sets `data-seg` and jumps the scene there.
  - `editorial/`: `Pull`, `Card` (`tone="caveat"`), `Figure` (small centred caption;
    `width="text|medium|wide"`), `Scrolly` (sticky figure driven by the steps beside it;
    the figure island reads `scrollySteps[id]`).
  - `math/`: `Eq` (KaTeX at build time; tagged terms defined underneath and linked to
    figures through `highlightedTerm`), and the mathematical layer: `MathLayer` with
    `Claim`, `Given`, `Steps`/`Step` (`hinge` marks the step the argument turns on), `Means`.
  - `figures/`: the essays' figures. Astro components are static SVG computed at build
    time; Svelte ones are interactive islands (`client:visible`).
  - `brand/`: the AG monogram and the signature. `site/`: header, footer, card `Thumb`s.
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
  - `articles/`: build-time computations behind each article's figures (Node only, cached):
    `hidden.ts` (GW150914 whitening, the toy-chirp matched filter), `wrong.ts` (two-tone
    ringdown fits at every start time), `route.ts` (noise budget, H1/L1 alignment, chirp-mass
    scan). Figures that only switch states read the scrolly's `data-active` in CSS, no JS.
  - `dsp/chirp.ts`: the pipeline's Newtonian chirp, ported and checked against its injection.
  - `dsp/models.ts`: analytic noise models (Advanced LIGO design PSD). `audio/play.ts`:
    plays 4096 Hz data through Web Audio. `format.ts`: `8.0 × 10⁻²⁴`-style numbers.
  - `physics/kerr.ts`: Kerr quasinormal modes (Berti fits for 220, 221, 222), the closed-form
    inverse from a ring (f, τ) to mass and spin, horizon area, detector and source frames.
    Checked against the qnm package through `tests/fixtures/kerr.json`.
- `src/styles/tokens.css`: design tokens, including the concept colour grammar.
- `tests/unit/` (Vitest), `tests/e2e/` (Playwright + axe), `tests/fixtures/` (scipy and qnm
  reference outputs, generated).
- `public/data/`: datasets as `<channel>.f32` (little-endian float32, stored as
  physical / `scale`) plus `meta.json`; see `docs/adr/0004-data-format.md`.
- `pipeline/`: the Python data pipeline (`grwu_pipeline/`, tests in `pipeline/tests/`).
- `private/` (git-ignored): clone of the private `aatyaa/GRWU-private` repository. Its
  `track/` holds the access-gated ringdown track (collection `ringdown`, route
  `/ringdown/<slug>/`, alias `@track`); its `paper/` is reference only. See ADR 0007. Commit
  track work inside `private/`, never in this repository.

## Conventions

- Internal links go through `withBase()` from `src/lib/url.ts`; never hard-code `/GRWU/`.
  In Playwright tests navigate with relative paths (`page.goto('about/')`).
- Colour carries meaning (ADR 0006): amber `--signal` is the signal and anything measured;
  blue-grey `--noise`/`--model` is noise, models and schematics (models dashed); red
  `--bias` is bias and disagreement, always labelled; green `--ok` is agreement. Text stays
  in ink. Do not add colours; small text must pass AA on `--ground` and `--surface`.
- Articles read like MLU-Explain, not like a deck: plain section headings, prose that
  walks the reader through a scrollytelling figure or a figure they move, a short caption
  that says what to look at. No eyebrows, act numbers, fact rows or mono labels on prose.
  Keep the talks' substance: history before formalism and honest limits.
- Interactive figures: draw at real pixel size (`bind:clientWidth`), every draggable handle
  is also a keyboard slider (`stepKey`), and state is exposed as `data-*` attributes.
- Any DSP function must be tested against scipy/gwpy reference output before it is used, and
  any black-hole physics against the qnm package (or another independent reference).
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
