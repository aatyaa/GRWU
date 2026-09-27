# 3. Math rendered by our own component, at build time

- Status: accepted
- Date: 2026-09-27

## Context

The Math depth layer needs equations whose terms are colour-linked to figures and prose
(hovering a term highlights its element in the figure). Astro 7 moved Markdown and MDX
processing to a new Rust pipeline, so remark/rehype math plugins are a compatibility risk.

## Decision

Render equations with an `<Eq>` component that calls KaTeX at build time, with MathML
output for screen readers. Terms are tagged with `data-term` through KaTeX's
`\htmlData`, so styling and linking do not depend on the Markdown pipeline.

## Consequences

- Equations cost no client JavaScript.
- Authors write `<Eq>` in MDX instead of `$…$`.
- Linking behaviour lives in our components, where it can be tested.
