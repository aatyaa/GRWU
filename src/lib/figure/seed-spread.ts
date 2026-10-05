/**
 * The made-up posterior of "From Data File to Claim" (a bell centred on 250 Hz, 6 Hz wide),
 * sampled with several seeds. Shared by the SeedSpread figure and the article's text.
 */
import { gaussian, mulberry32 } from '~/lib/stats/random';

export const CENTRE = 250;
export const WIDTH = 6;
export const SEEDS = 20;
export const SIZES = [100, 1000, 10000, 100000];

function medianOf(values: Float64Array): number {
  values.sort();
  const m = values.length >> 1;
  return values.length % 2 ? values[m] : (values[m - 1] + values[m]) / 2;
}

/** The median of n samples, for each of the seeds. */
export function medians(n: number): number[] {
  return Array.from({ length: SEEDS }, (_, s) => {
    const g = gaussian(mulberry32(7000 + s));
    return medianOf(Float64Array.from({ length: n }, () => CENTRE + WIDTH * g()));
  });
}

/** Sample standard deviation: how far the medians wander from seed to seed. */
export function spreadOf(values: readonly number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
}
