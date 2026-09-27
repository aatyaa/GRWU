# 6. The visual identity comes from the author's talks

- Status: accepted
- Date: 2026-09-27

## Context

The project owner's talks (The Shape of Error, The Straightest Path, What the Wrong Model
Knows, and the handbook From Strain to Source) already have a mature editorial identity and
a way of telling data analysis as a story. GRWU should read as the same voice, not as a
generic documentation site.

## Decision

- Type: Instrument Serif for headings, numbers and pull lines; Archivo for text; IBM Plex
  Mono for every label, caption, axis and readout. Self-hosted through Fontsource, Latin
  subset.
- Colour carries fixed meaning: amber is the signal and anything measured; blue-grey is
  noise, models and schematics (models dashed); red is bias and disagreement, always
  labelled; green is agreement. Text stays in ink.
- The palette is the talks' own, darkened just enough for small text to pass WCAG AA on
  both the ground and the surface.
- Every figure says what kind of picture it is: measured, model, schematic or control.
- Figures are hand-built SVG at real pixel size (so labels stay legible on a phone), build
  themselves up in the order of the argument, and expose their state as `data-*`
  attributes for tests.
- The AG monogram and the author's signature carry the byline, as in the talks.

## Consequences

- One component set (`components/editorial`, `components/math`, `components/figures`)
  covers what the talks draw by hand, so each new essay is mostly writing and figures.
- Tests measure contrast after figures finish fading in, not during.
