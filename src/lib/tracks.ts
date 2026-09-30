/**
 * The site's tracks (ADR 0009): its own research tracks, the open foundations series that
 * leads into them, and open tracks built on others' open-source work.
 */

export type TrackKind = 'flagship' | 'foundations' | 'open';

/** Open-source work a track or an article adapts. */
export interface Credit {
  project: string;
  authors: string;
  url: string;
  /** SPDX identifier, e.g. "MIT". */
  license: string;
}

export interface Track {
  id: string;
  title: string;
  kind: TrackKind;
  /** Behind the access gate (ADR 0007). */
  gated: boolean;
  summary: string;
  credits?: Credit[];
}

export const tracks: Track[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    kind: 'foundations',
    gated: false,
    summary:
      'Five articles for a first-year student: the physics, statistics and signal analysis that the research tracks rest on, joined up.',
  },
  {
    id: 'ringdown',
    title: 'Heavier Than Its Parents',
    kind: 'flagship',
    gated: true,
    summary:
      'A research track on GW250114: why a one-tone fit weighs the black hole heavier than the two that made it.',
  },
];

/** A foundations article in the series plan, before or after it is written. */
export interface PlannedArticle {
  id: string;
  title: string;
  question: string;
  /** What the article joins: its physics, statistics and signal-analysis ideas. */
  covers: string;
}

/** The foundations series in reading order. Written articles take their text from the collection. */
export const foundations: PlannedArticle[] = [
  {
    id: 'a-bell-that-weighs-itself',
    title: 'A Bell That Weighs Itself',
    question: 'How can a ring tell you what the bell weighs?',
    covers:
      'Oscillation and damping, frequency and decay time, why a black hole has only mass and spin, and how its ring gives both.',
  },
  {
    id: 'every-signal-is-a-chord',
    title: 'Every Signal Is a Chord',
    question: 'How do you take a signal apart into its notes?',
    covers:
      'Sampling and aliasing, Fourier analysis, windows, and the spectrum of the detector noise.',
  },
  {
    id: 'how-sure-is-sure',
    title: 'How Sure Is Sure?',
    question: 'What does “68 ± 3” mean, and what does “four sigma” not mean?',
    covers:
      'Likelihood, prior and posterior, credible intervals, samplers, evidence, and the traps in counting sigmas.',
  },
  {
    id: 'fitting-a-ring-in-noise',
    title: 'Fitting a Ring in Noise',
    question: 'When does a fit that looks right give the wrong answer?',
    covers:
      'Models and residuals, when to start the fit, one tone or two, and testing an analysis on an answer you already know.',
  },
  {
    id: 'from-data-file-to-claim',
    title: 'From Data File to Claim',
    question: 'What does the work actually look like, day to day?',
    covers:
      'Fetching open data, reading a posterior, computing a number you can trace, and checking your code against a reference.',
  },
];
