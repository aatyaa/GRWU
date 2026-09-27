# 5. The Depth Lens is built on native HTML

- Status: accepted
- Date: 2026-09-27

## Context

Every idea is offered at three depths: intuition, math and code. A reader needs to open a
deeper layer in place, set a depth once for every section, and jump to a layer from a
margin note. Article text is static HTML with a 20 KB JavaScript budget, and it must work
with a keyboard, a screen reader and find-in-page.

## Decision

- Each deeper layer is a native `<details data-layer="math|code">` (`<Unfold>`). It opens
  and closes without JavaScript, and assistive technology already knows how to announce it.
- Small custom elements in `src/elements/` add the rest:
  - `<grwu-depth-dial>` opens every layer at or above the chosen depth and remembers the
    choice (the `depth` store, in localStorage).
  - `<grwu-unfold>` animates with View Transitions and opens when a link targets it.
  - `<grwu-eq>` links equation terms to figures.
- A layer the address points to (`#math-welch`) stays open whatever the depth.
- Margin notes (`<Peek>`) use CSS anchor positioning on wide screens. Elsewhere they sit
  inline after their paragraph.
- New platform features only enhance. Without View Transitions a layer simply opens.
  Without anchor positioning a peek stays inline. With reduced motion there is no animation.

## Consequences

- The layers cost no framework JavaScript; the custom elements are a few KB.
- A closed layer is still in the page, so it is indexed and, where browsers support it,
  opened by find-in-page.
- Islands inside a closed layer hydrate only when it is opened (`client:visible`).
