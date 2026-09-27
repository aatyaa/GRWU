# GRWU

Visual, interactive explanations of gravitational-wave data analysis.

GRWU takes one step of the analysis pipeline at a time, from reading detector data to
measuring a merger, and builds intuition for it on real LIGO and Virgo data in the
browser. Each idea can be opened at three depths: intuition, the mathematics, and the
Python code that computes it. The articles follow the path of the
[Gravitational Wave Open Data Workshop](https://gwosc.org/workshops/), so a reader who
finishes the core track is ready for its data challenges.

The site is under construction. It will be published at
<https://aatyaa.github.io/GRWU/>.

## Development

Requirements: Node.js 22.12 or newer and pnpm 10.

```sh
pnpm install
pnpm dev          # http://localhost:4321/GRWU/
```

| Command         | What it does                                                 |
| --------------- | ------------------------------------------------------------ |
| `pnpm check`    | Lint, typecheck, unit tests, production build and JS budgets |
| `pnpm test:e2e` | Browser tests with accessibility checks (after `pnpm build`) |
| `pnpm format`   | Format the code with Prettier                                |
| `pnpm build`    | Production build into `dist/`                                |

Articles live in `src/content/articles/`. Architecture decisions are recorded in
[`docs/adr/`](docs/adr/). The Python data pipeline that prepares the datasets in
`public/data/` lives in [`pipeline/`](pipeline/).

## Data

Strain data and event catalogues come from the
[Gravitational Wave Open Science Center](https://gwosc.org/). GWOSC data is released under
CC BY 4.0: this research has made use of data or software obtained from the Gravitational
Wave Open Science Center (gwosc.org), a service of the LIGO Scientific Collaboration, the
Virgo Collaboration, and KAGRA.
