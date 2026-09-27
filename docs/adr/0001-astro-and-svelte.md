# 1. Astro with Svelte islands

- Status: accepted
- Date: 2026-09-27

## Context

GRWU pages are long-form articles: mostly text, with a handful of heavy interactive
figures (live DSP on real data, audio, 3D, in-browser Python). Research on interactive
articles shows authoring cost is the main obstacle, and mobile readers pay for every
kilobyte of JavaScript.

## Decision

Use Astro (static output) for pages and content, MDX for articles, and Svelte 5 for
interactive figures, hydrated as islands with `client:visible`. Lightweight in-prose
interactions are framework-free custom elements in `src/elements/`. Shared state between
islands will use nanostores.

Alternatives considered: SvelteKit (every route ships JavaScript; built for apps rather
than articles) and Next.js with React (larger runtime, more setup for static content).

## Consequences

- Article text ships no JavaScript; each figure pays only for itself.
- Content collections give typed, validated front matter for every article.
- Islands are isolated, so cross-figure state must go through a shared store.
- Astro 7 is new (June 2026). We avoid depending on its Markdown plugin pipeline (see
  ADR 3).
