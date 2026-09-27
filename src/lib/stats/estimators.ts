/** The estimators the articles compare: each is the minimiser of a different cost. */

export function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Minimiser of the largest miss: halfway between the extremes. */
export function midrange(values: readonly number[]): number {
  return (Math.min(...values) + Math.max(...values)) / 2;
}

export interface Line {
  slope: number;
  intercept: number;
}

/** Ordinary least squares for y = slope * x + intercept (the normal equations, solved). */
export function fitLine(xs: readonly number[], ys: readonly number[]): Line {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/** Sum of squared misses of a line: the quantity least squares minimises. */
export function sumOfSquares(xs: readonly number[], ys: readonly number[], line: Line): number {
  let total = 0;
  for (let i = 0; i < xs.length; i++) total += (ys[i] - (line.slope * xs[i] + line.intercept)) ** 2;
  return total;
}

/** Normal probability density. */
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/**
 * Exact distribution of the total of `n` fair six-sided dice: probabilities for totals
 * n..6n, by repeated convolution.
 */
export function diceTotals(n: number): { totals: number[]; probabilities: number[] } {
  let dist = [1];
  for (let k = 0; k < n; k++) {
    const next = new Array(dist.length + 5).fill(0);
    dist.forEach((p, i) => {
      for (let face = 0; face < 6; face++) next[i + face] += p / 6;
    });
    dist = next;
  }
  return { totals: dist.map((_, i) => n + i), probabilities: dist };
}

/**
 * Linear least squares for any model linear in its parameters: y ≈ Σ θ_j f_j(x). Solves the
 * normal equations AᵀA θ = Aᵀy by Gaussian elimination (fine for the handful of columns the
 * figures use). Returns θ.
 */
export function fitLinear(
  basis: readonly ((x: number) => number)[],
  xs: readonly number[],
  ys: readonly number[],
): number[] {
  const m = basis.length;
  const ata = Array.from({ length: m }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i < xs.length; i++) {
    const row = basis.map((f) => f(xs[i]));
    for (let a = 0; a < m; a++) {
      for (let b = 0; b < m; b++) ata[a][b] += row[a] * row[b];
      ata[a][m] += row[a] * ys[i];
    }
  }
  for (let col = 0; col < m; col++) {
    let pivot = col;
    for (let r = col + 1; r < m; r++)
      if (Math.abs(ata[r][col]) > Math.abs(ata[pivot][col])) pivot = r;
    [ata[col], ata[pivot]] = [ata[pivot], ata[col]];
    for (let r = 0; r < m; r++) {
      if (r === col) continue;
      const factor = ata[r][col] / ata[col][col];
      for (let c = col; c <= m; c++) ata[r][c] -= factor * ata[col][c];
    }
  }
  return ata.map((row, i) => row[m] / row[i]);
}
