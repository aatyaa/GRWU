# GRWU

Interactive essays on gravitational-wave data analysis, by Attia A. Gadallah.

Each essay takes one idea, tells the story of how it came to be needed, and lets the reader
move the figures until the idea is theirs: why errors have a shape, how a template pulls a
merger out of noise a hundred times louder, and how a confident fit can be wrong. Every idea
has a mathematical layer underneath that opens in place. The figures run on real LIGO and
Virgo data in the browser, and the look and voice come from the author's talks (see
[ADR 0006](docs/adr/0006-visual-identity.md)).

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
