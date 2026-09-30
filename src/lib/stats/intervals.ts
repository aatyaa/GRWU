/**
 * Summaries of a posterior drawn as samples: quantiles and the two usual credible intervals.
 * Checked against numpy.quantile and a brute-force highest-density search
 * (tests/fixtures/foundations.json).
 */

function sorted(values: ArrayLike<number>): Float64Array {
  if (values.length === 0) throw new RangeError('no samples');
  return Float64Array.from(values).sort();
}

function quantileOfSorted(x: Float64Array, p: number): number {
  if (p < 0 || p > 1) throw new RangeError(`probability must be in [0, 1], got ${p}`);
  const h = (x.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, x.length - 1);
  return x[lo] + (h - lo) * (x[hi] - x[lo]);
}

/** numpy.quantile with its default (linear) interpolation. */
export function quantile(values: ArrayLike<number>, p: number): number {
  return quantileOfSorted(sorted(values), p);
}

/** The interval leaving (1 - mass) / 2 of the samples on each side. */
export function equalTailed(values: ArrayLike<number>, mass: number): [number, number] {
  const x = sorted(values);
  const tail = (1 - mass) / 2;
  return [quantileOfSorted(x, tail), quantileOfSorted(x, 1 - tail)];
}

/**
 * The highest-density interval: the shortest interval holding floor(mass * n) + 1 of the n
 * sorted samples, as arviz.hdi computes it. For a skewed posterior it is shorter than the
 * equal-tailed interval and shifted towards the peak.
 */
export function hdi(values: ArrayLike<number>, mass: number): [number, number] {
  if (mass <= 0 || mass >= 1) throw new RangeError(`mass must be in (0, 1), got ${mass}`);
  const x = sorted(values);
  const inc = Math.floor(mass * x.length);
  let best = 0;
  for (let i = 1; i < x.length - inc; i++) {
    if (x[i + inc] - x[i] < x[best + inc] - x[best]) best = i;
  }
  return [x[best], x[best + inc]];
}
