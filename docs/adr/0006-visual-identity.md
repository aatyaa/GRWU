# 6. The visual identity comes from the author's talks

- Status: accepted (amended 2026-09-27: MLU-Explain layout, black-hole hero)
- Date: 2026-09-27

## Context

The project owner's talks (The Shape of Error, The Straightest Path, What the Wrong Model
Knows, and the handbook From Strain to Source) show what the articles should cover and how
deep they should go. A first attempt copied their slide layout (deck rails, act eyebrows,
mono labels, fact rows); the owner rejected it. The site should look like MLU-Explain, more
polished: web articles, not pages from a presentation.

## Decision

- Layout follows MLU-Explain: a home page of article cards; articles with a centred title,
  a question, a byline, then prose and scrollytelling sections where a sticky figure
  follows the text. No slide furniture.
- The home page opens on the GW250114 scene from the overture of What the Wrong Model
  Knows: two black holes orbiting, lensing the star field and merging, driven by the real
  event's frequency and phase. Only the scene is reused, not the talk's text or layout.
- Type: Instrument Serif for headings and pull lines; Archivo for text and captions; IBM
  Plex Mono only inside figures (axes, readouts). Self-hosted through Fontsource, Latin
  subset.
- Colour carries fixed meaning: amber is the signal and anything measured; blue-grey is
  noise, models and schematics (models dashed); red is bias and disagreement, always
  labelled; green is agreement. Text stays in ink.
- The palette is the talks' own, darkened just enough for small text to pass WCAG AA on
  both the ground and the surface.
- Figures are hand-built SVG at real pixel size (so labels stay legible on a phone), build
  themselves up in the order of the argument, and expose their state as `data-*`
  attributes for tests.
- The AG monogram and the author's signature carry the byline, as in the talks.

## Consequences

- One component set (`components/editorial`, `components/math`, `components/figures`)
  covers what the talks draw by hand, so each new essay is mostly writing and figures.
- Tests measure contrast after figures finish fading in, not during.
