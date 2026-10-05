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
  /** The question the track answers, shown on its card. */
  question: string;
  summary: string;
  /** Planned tracks are shown as coming; live ones link to `path`. */
  status: 'planned' | 'live';
  /** Route under the site's base, e.g. "start/". */
  path?: string;
  credits?: Credit[];
}

export const tracks: Track[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    kind: 'foundations',
    gated: false,
    question: 'New to this? What do you need before the research?',
    summary:
      'Five articles for a first-year student: the physics, statistics and signal analysis that the research tracks rest on, joined up.',
    status: 'live',
    path: 'start/',
  },
  {
    id: 'ringdown',
    title: 'Heavier Than Its Parents',
    kind: 'flagship',
    gated: true,
    question: 'Why does a one-tone fit weigh the black hole heavier than its parents?',
    summary:
      'A research track on GW250114: why a one-tone fit weighs the black hole heavier than the two that made it.',
    status: 'live',
    path: 'ringdown/',
  },
  {
    id: 'code',
    title: 'The Code Behind It',
    kind: 'flagship',
    gated: true,
    question: 'How does each number in the ringdown track come out of the data?',
    summary:
      'The ringdown track again, chapter by chapter, through the code: from public posterior samples to every claim, and how the tools that made them work inside.',
    status: 'planned',
  },
  {
    id: 'samplers',
    title: 'How a Sampler Walks',
    kind: 'open',
    gated: false,
    question: 'How does a computer map a posterior it cannot write down?',
    summary:
      'Random-walk Metropolis, Hamiltonian Monte Carlo and NUTS, watched step by step on shapes you choose.',
    status: 'planned',
    credits: [
      {
        project: 'mcmc-demo',
        authors: 'Chi Feng',
        url: 'https://github.com/chi-feng/mcmc-demo',
        license: 'MIT',
      },
    ],
  },
  {
    id: 'fourier',
    title: 'Fourier, Drawn',
    kind: 'open',
    gated: false,
    question: 'How can any shape be built from circles?',
    summary: 'The Fourier transform from spinning circles to sound, before any formula.',
    status: 'planned',
    credits: [
      {
        project: 'An Interactive Introduction to Fourier Transforms',
        authors: 'Jez Swanson',
        url: 'https://github.com/Jezzamonn/fourier',
        license: 'MIT',
      },
    ],
  },
  {
    id: 'matched-filtering',
    title: 'Listening for a Chirp',
    kind: 'open',
    gated: false,
    question: 'How do you hear a signal quieter than the noise?',
    summary:
      'Matched filtering with a microphone and with LIGO data: the detector as an ear, and why knowing the tune lets you hear it.',
    status: 'planned',
    credits: [
      {
        project: 'MatchedFiltering',
        authors: 'Mike Boyle',
        url: 'https://github.com/moble/MatchedFiltering',
        license: 'MIT',
      },
    ],
  },
  {
    id: 'first-ringdown-fit',
    title: 'Your First Ringdown Fit',
    kind: 'open',
    gated: false,
    question: 'What does it take to fit the ring of a real black hole yourself?',
    summary:
      'A quasinormal-mode fit to GW150914 with the ringdown package, step by step, and how to read what it returns.',
    status: 'planned',
    credits: [
      {
        project: 'ringdown',
        authors: 'Maximiliano Isi and Will M. Farr',
        url: 'https://github.com/maxisi/ringdown',
        license: 'MIT',
      },
    ],
  },
  {
    id: 'nested-sampling',
    title: 'Counting With Nested Sampling',
    kind: 'open',
    gated: false,
    question: 'How do you weigh a whole model, not just its best fit?',
    summary:
      'Nested sampling replayed live: how it climbs the likelihood, and how that climb becomes the evidence used to compare models.',
    status: 'planned',
    credits: [
      {
        project: 'anesthetic',
        authors: 'Will Handley and contributors',
        url: 'https://github.com/handley-lab/anesthetic',
        license: 'MIT',
      },
    ],
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
    question: 'How do you read a ring buried in noise, and how do you know the answer is honest?',
    covers:
      'Least squares, the reduced χ², where an error bar comes from, and testing an analysis on signals whose answer you already know.',
  },
  {
    id: 'from-data-file-to-claim',
    title: 'From Data File to Claim',
    question: 'What does the work actually look like, day to day?',
    covers:
      'Fetching open data, reading a posterior, computing a number you can trace, and checking your code against a reference.',
  },
];
