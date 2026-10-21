/**
 * Build-time data for "Run It Yourself": posterior samples drawn the way a sampler returns
 * them, for a parameter the data pin down (the practice chirp's chirp mass) and for one they
 * say nothing about (the phase), each against its flat prior. Node only.
 */
import { chirpMassScan } from '~/lib/articles/route';
import { quantile } from '~/lib/stats/intervals';
import { mulberry32 } from '~/lib/stats/random';

export interface SampledParameter {
  name: string;
  unit: string;
  /** The flat prior's range, which is also the histogram's. */
  lo: number;
  hi: number;
  /** Fraction of the samples in each of the equal bins between lo and hi. */
  bins: number[];
  samples: number;
  p5: number;
  median: number;
  p95: number;
}

const SAMPLES = 4000;
const BINS = 60;
const round = (v: number, digits = 4) => Number(v.toPrecision(digits));

function summarise(
  name: string,
  unit: string,
  lo: number,
  hi: number,
  values: number[],
): SampledParameter {
  const counts = new Array<number>(BINS).fill(0);
  for (const v of values) counts[Math.min(BINS - 1, Math.floor(((v - lo) / (hi - lo)) * BINS))]++;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    name,
    unit,
    lo,
    hi,
    bins: counts.map((c) => round(c / values.length, 4)),
    samples: values.length,
    p5: round(quantile(sorted, 0.05), 5),
    median: round(quantile(sorted, 0.5), 5),
    p95: round(quantile(sorted, 0.95), 5),
  };
}

let cache: { chirpMass: SampledParameter; phase: SampledParameter } | undefined;

/**
 * The chirp mass's posterior on a flat prior, with ln L = ρ²/2 from the matched-filter scan
 * (as in From Strain to Source), sampled by inverting its cumulative distribution; and a phase
 * the data cannot see, whose samples are its prior's.
 */
export function sampledPosteriors() {
  if (cache) return cache;
  const scan = chirpMassScan();
  const lo = scan.mc[0];
  const hi = scan.mc[scan.mc.length - 1];
  const best = Math.max(...scan.snr);
  const snrAt = (mc: number) => {
    let i = 1;
    while (i < scan.mc.length - 1 && scan.mc[i] < mc) i++;
    const u = (mc - scan.mc[i - 1]) / (scan.mc[i] - scan.mc[i - 1]);
    return scan.snr[i - 1] * (1 - u) + scan.snr[i] * u;
  };
  const n = 3000;
  const grid = Array.from({ length: n }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / n);
  const weight = grid.map((mc) => Math.exp((snrAt(mc) ** 2 - best ** 2) / 2));
  const cdf: number[] = [];
  let total = 0;
  for (const w of weight) cdf.push((total += w));
  const uniform = mulberry32(5202);
  const masses = Array.from({ length: SAMPLES }, () => {
    const target = uniform() * total;
    let a = 0;
    let b = n - 1;
    while (a < b) {
      const m = (a + b) >> 1;
      if (cdf[m] < target) a = m + 1;
      else b = m;
    }
    return grid[a] + (uniform() - 0.5) * ((hi - lo) / n);
  });
  const phases = Array.from({ length: SAMPLES }, () => uniform() * 2 * Math.PI);
  cache = {
    chirpMass: summarise('chirp mass', 'solar masses', lo, hi, masses),
    phase: summarise('phase', 'radians', 0, 2 * Math.PI, phases),
  };
  return cache;
}
