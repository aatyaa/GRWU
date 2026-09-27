# 5. The Depth Lens is built on native HTML

- Status: accepted (amended 2026-09-27: two layers, the code layer was dropped)
- Date: 2026-09-27

## Context

Every idea is told as a story, and each has a mathematical layer underneath, in the form
the talks use: the claim, what may be assumed, a numbered derivation with the step it
turns on, and what it means. A reader needs to open that layer in place, open all of them
at once, and jump to one from a margin note. Article text is static HTML with a 20 KB
JavaScript budget, and it must work with a keyboard, a screen reader and find-in-page.

A third, code layer (Python run in the page with Pyodide) was built and then dropped by
the project owner: the essays are about figures and ideas, not about a notebook.

## Decision

- Each mathematical layer is a native `<details data-layer="math">` (`<MathLayer>`). It
  opens and closes without JavaScript, and assistive technology already knows how to
  announce it.
- Small custom elements in `src/elements/` add the rest:
  - `<grwu-depth-dial>` opens every layer ("With the mathematics") or none ("Story only")
    and remembers the choice (the `depth` store, in localStorage).
  - `<grwu-unfold>` animates with View Transitions and opens when a link targets it.
  - `<grwu-eq>` links equation terms to their definitions and to figures.
- A layer the address points to (`#m1`) stays open whatever the depth.
- Margin notes (`<Peek>`) use CSS anchor positioning on wide screens. Elsewhere they sit
  inline after their paragraph.
- New platform features only enhance. Without View Transitions a layer simply opens.
  Without anchor positioning a peek stays inline. With reduced motion there is no animation.

## Consequences

- The layers cost no framework JavaScript; the custom elements are a few KB.
- A closed layer is still in the page, so it is indexed and, where browsers support it,
  opened by find-in-page.
- Islands inside a closed layer hydrate only when it is opened (`client:visible`).
