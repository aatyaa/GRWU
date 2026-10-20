/**
 * How closely two quantities move together. Checked against scipy.stats.pearsonr,
 * scipy.stats.spearmanr and scipy.stats.rankdata (tests/fixtures/foundations.json).
 */

/** Pearson's correlation coefficient. */
export function pearson(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  const n = xs.length;
  if (n !== ys.length || n < 2) throw new RangeError('need two series of equal length ≥ 2');
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/** Ranks from 1, with tied values given the average of their ranks (scipy's "average"). */
export function ranks(values: ArrayLike<number>): Float64Array {
  const n = values.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b]);
  const out = new Float64Array(n);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && values[order[j + 1]] === values[order[i]]) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]] = rank;
    i = j + 1;
  }
  return out;
}

/** Spearman's rank correlation: Pearson's coefficient of the ranks. */
export function spearman(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  return pearson(ranks(xs), ranks(ys));
}
