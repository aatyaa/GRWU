# 8. Figures are drawn with d3 modules and move with Svelte's motion

- Status: accepted
- Date: 2026-09-30

## Context

The ringdown track (ADR 0007) grew fifteen figures. Some were Svelte islands drawn at real
pixel size; others were static SVG computed at build time and scaled to the column, which on
a phone shrank their labels to a few pixels, against ADR 0006. Each figure had its own
hand-rolled scales, ticks and label placement, and states changed by toggling opacity, so a
reader saw figures jump rather than change. The owner asked for figures that are a work of
science and of craft.

## Decision

- Scales, ticks, shapes and binning come from the d3 modules `d3-scale`, `d3-shape`,
  `d3-array` and `d3-format` (small, tree-shaken, no DOM). d3 computes; Svelte renders. No
  d3 selections, no charting framework: every mark is still hand-placed SVG, so ADR 0006's
  colour grammar and typography apply unchanged.
- Transitions between states use `Tween` and `prefersReducedMotion` from `svelte/motion`.
  Data arrays tween point by point, so a curve morphs when the reader moves a slider or a
  scrollytelling step changes the state. With reduced motion every tween has zero duration.
- The ringdown track's figures share a small kit (`private/track/components/chart/`): a
  sized frame, axes with nice ticks, bands and lines that tween, and a label placer that
  keeps annotations from colliding. Every figure is an island drawn at its real width;
  scrollytelling figures read `scrollySteps` instead of CSS state classes.
- Each chapter opens on the event itself: the reconstructed GW250114 ring drawn in the home
  page's space palette, with the part of the signal that chapter is about lit.

## Consequences

- Figures cost a little client JavaScript (d3 modules are a few kB each, loaded with the
  islands), still inside the per-page budget, which counts up-front scripts.
- Labels stay legible at any width, and tests can wait on the same `data-*` state as before.
- The public essays keep their figures; they can adopt the kit later.
