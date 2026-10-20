# 9. A foundations series and open tracks built on others' work

- Status: accepted
- Date: 2026-09-30

## Context

The ringdown track (ADR 0007) and the coding track planned beside it assume a reader who
already knows what a ringing black hole is, what a spectrum shows and what a posterior
means. The owner wants a first-year university student to reach them. Good open-source
teaching material already exists for some of the steps on the way (interactive MCMC demos,
an introduction to Fourier transforms, matched filtering with audio, ringdown fitting
notebooks), and the owner wants it used, credited, where it saves work.

## Decision

- **Three kinds of track.** `src/lib/tracks.ts` is the registry:
  - _flagship_: the site's own research tracks (the ringdown track and the coding track).
    Original work, tied to GW250114; access-gated as ADR 0007 describes.
  - _foundations_: five open articles for beginners, in reading order, each joining physics,
    statistics and signal analysis: a ring that weighs itself, a signal as a chord, how sure
    is sure, fitting a ring in noise, from a data file to a claim.
  - _open_: tracks built on an open-source project that deserves its own path. Always open.
- **Articles stay in one collection.** Foundations and open-track articles live in
  `src/content/articles/` with `track` set to the track's id. The schema gains:
  - `level` (`beginner`, `core`, `advanced`): the reader the article is written for.
    Foundations articles are `beginner`: school mathematics in the prose, anything beyond it
    in the mathematical layer.
  - `prepares`: the articles or ringdown chapters this one prepares the reader for, so each
    article can say where it leads.
  - `credits`: the open-source work an article adapts, with authors, link and licence.
- **Credit and licences.** Only permissively licensed work (MIT, BSD, Apache-2.0) is adapted
  into the site's code. Every adapted file keeps the original licence notice at its head,
  the article lists the work in `credits`, and `CREDITS.md` lists everything. Copyleft or
  unlicensed work (GPL, CC BY-SA, no licence) is linked or credited as inspiration, never
  copied. Libraries used unmodified (Pyodide under MPL-2.0) are dependencies, not adaptations.
- **One glossary.** Symbols and terms are defined once, in the `glossary` collection
  (`src/content/glossary.json`), with their unit where they have one. Articles link to it
  instead of redefining a symbol differently each time.
- **A start page.** `/start/` lists the foundations series in reading order and says what
  comes after it.

## Consequences

- A beginner has a defined road into the flagship tracks, and the flagship tracks can assume
  what the foundations teach.
- The site can grow by adapting good open work quickly, without ambiguity about whose work
  it is or what its licence allows.
- The site's own licence has to be decided before any adapted code is merged, so that
  combining licences is deliberate.
