/**
 * The ring of "Fitting a Ring in Noise": one damped tone in white noise, sampled at 4096 Hz.
 * Shared by its figures (RingFit, InjectionTest) and by the article's text, which computes its
 * numbers from the same seeded noise at build time, so prose and figures cannot drift apart.
 */
import { gaussian, mulberry32 } from '~/lib/stats/random';
import { fitRing, ringErrors, ringModel, type FitRange } from '~/lib/stats/ringfit';

export const FS = 4096;
export const N = 160;
/** Four knobs: frequency, damping time, amplitude, phase. */
export const KNOBS = 4;
export const SIGMA = 0.15;
export const TRUTH = { f: 250, tau: 0.004, amplitude: 1, phase: 0.4 };
export const RANGE: FitRange = { fMin: 150, fMax: 350, tauMin: 0.001, tauMax: 0.012 };
/** Noise spreads for the injection test, quiet to loud. */
export const LEVELS = [
  { id: 'quiet', label: 'quiet', sigma: 0.3 },
  { id: 'medium', label: 'as before', sigma: 0.15 },
  { id: 'loud', label: 'loud', sigma: 0.075 },
] as const;
export type Level = (typeof LEVELS)[number]['id'];
export const INJECTIONS = 300;

export const times = Float64Array.from({ length: N }, (_, i) => i / FS);
export const clean = ringModel(times, {
  f: TRUTH.f,
  tau: TRUTH.tau,
  a: TRUTH.amplitude * Math.cos(TRUTH.phase),
  b: -TRUTH.amplitude * Math.sin(TRUTH.phase),
});

/** The one noisy ring the reader fits. */
export function ringData(): Float64Array {
  const g = gaussian(mulberry32(4));
  return Float64Array.from(clean, (v) => v + SIGMA * g());
}

export const reducedChi2 = (rss: number, sigma = SIGMA) => rss / (sigma * sigma) / (N - KNOBS);

/** Signal-to-noise ratio of the clean ring in white noise of spread sigma. */
export const snr = (sigma: number) => Math.sqrt(clean.reduce((s, v) => s + v * v, 0)) / sigma;

/** The error bar on frequency that one fit reports, at the truth. */
export const reportedError = (sigma: number) => ringErrors(times, TRUTH, sigma).f;

/** A generator of injection fits for one loudness: the same seeded noise every time. */
export function injector(level: Level): () => number {
  const index = LEVELS.findIndex((l) => l.id === level);
  const sigma = LEVELS[index].sigma;
  const g = gaussian(mulberry32(1000 + index));
  return () => {
    const y = Float64Array.from(clean, (v) => v + sigma * g());
    return fitRing(times, y, { ...RANGE, grid: 8 }).f;
  };
}

/** Mean and sample standard deviation. */
export function summary(values: readonly number[]): { mean: number; spread: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const spread = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
  return { mean, spread };
}
