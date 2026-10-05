/**
 * Build-time numbers for "Fitting a Ring in Noise", computed from the same seeded ring and
 * noise as its figures (lib/figure/ring-in-noise.ts). Node only (Astro frontmatter).
 */
import {
  INJECTIONS,
  LEVELS,
  N,
  KNOBS,
  RANGE,
  TRUTH,
  injector,
  reducedChi2,
  reportedError,
  ringData,
  snr,
  summary,
  times,
  SIGMA,
} from '~/lib/figure/ring-in-noise';
import { fitRing, ringErrors } from '~/lib/stats/ringfit';

const y = ringData();
const best = fitRing(times, y, RANGE);

export const fitting = {
  truth: TRUTH,
  dof: N - KNOBS,
  best: {
    f: best.f,
    tauMs: best.tau * 1000,
    chi2: reducedChi2(best.rss),
    error: ringErrors(times, best, SIGMA).f,
  },
  chi2Spread: Math.sqrt(2 / (N - KNOBS)),
  levels: Object.fromEntries(
    LEVELS.map((level) => {
      const next = injector(level.id);
      const answers = Array.from({ length: INJECTIONS }, next);
      return [
        level.id,
        { ...summary(answers), reported: reportedError(level.sigma), snr: snr(level.sigma) },
      ];
    }),
  ) as Record<
    (typeof LEVELS)[number]['id'],
    { mean: number; spread: number; reported: number; snr: number }
  >,
};
