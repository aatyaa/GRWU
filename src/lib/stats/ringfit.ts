/**
 * Least-squares fit of one damped tone, y(t) = e^(−t/τ) (a cos 2πft + b sin 2πft), to data.
 * For a fixed frequency and damping time the model is linear in a and b, which are solved
 * exactly; f and τ are found by a grid search refined with Nelder–Mead. Checked against
 * scipy.optimize.curve_fit (tests/fixtures/foundations.json). With white Gaussian noise of
 * known spread this is the maximum-likelihood fit.
 */

export interface RingFit {
  /** Frequency, Hz. */
  f: number;
  /** Damping time, s. */
  tau: number;
  a: number;
  b: number;
  /** Amplitude √(a² + b²) and phase φ, with the model written A e^(−t/τ) cos(2πft + φ). */
  amplitude: number;
  phase: number;
  /** Residual sum of squares. */
  rss: number;
}

/** The best amplitudes for a given frequency and damping time, and what they leave over. */
export function amplitudes(
  t: ArrayLike<number>,
  y: ArrayLike<number>,
  f: number,
  tau: number,
): { a: number; b: number; rss: number } {
  let cc = 0;
  let ss = 0;
  let cs = 0;
  let yc = 0;
  let ys = 0;
  let yy = 0;
  for (let i = 0; i < t.length; i++) {
    const env = Math.exp(-t[i] / tau);
    const c = env * Math.cos(2 * Math.PI * f * t[i]);
    const s = env * Math.sin(2 * Math.PI * f * t[i]);
    cc += c * c;
    ss += s * s;
    cs += c * s;
    yc += y[i] * c;
    ys += y[i] * s;
    yy += y[i] * y[i];
  }
  const det = cc * ss - cs * cs;
  if (!(Math.abs(det) > 1e-300)) return { a: 0, b: 0, rss: yy };
  const a = (yc * ss - ys * cs) / det;
  const b = (ys * cc - yc * cs) / det;
  return { a, b, rss: Math.max(0, yy - a * yc - b * ys) };
}

/** Model values at times t. */
export function ringModel(
  t: ArrayLike<number>,
  fit: Pick<RingFit, 'f' | 'tau' | 'a' | 'b'>,
): Float64Array {
  return Float64Array.from({ length: t.length }, (_, i) => {
    const env = Math.exp(-t[i] / fit.tau);
    return (
      env *
      (fit.a * Math.cos(2 * Math.PI * fit.f * t[i]) + fit.b * Math.sin(2 * Math.PI * fit.f * t[i]))
    );
  });
}

function nelderMead(
  fn: (p: number[]) => number,
  start: number[],
  scale: number[],
  iterations = 400,
): number[] {
  const n = start.length;
  let simplex = [start, ...scale.map((s, i) => start.map((v, j) => (i === j ? v + s : v)))];
  let values = simplex.map(fn);
  for (let it = 0; it < iterations; it++) {
    const order = values.map((_, i) => i).sort((i, j) => values[i] - values[j]);
    simplex = order.map((i) => simplex[i]);
    values = order.map((i) => values[i]);
    if (Math.abs(values[n] - values[0]) <= 1e-14 * (Math.abs(values[0]) + 1e-300)) break;
    const centroid = start.map((_, j) => simplex.slice(0, n).reduce((s, p) => s + p[j], 0) / n);
    const along = (k: number) => centroid.map((c, j) => c + k * (simplex[n][j] - c));
    const reflected = along(-1);
    const fr = fn(reflected);
    if (fr < values[0]) {
      const expanded = along(-2);
      const fe = fn(expanded);
      [simplex[n], values[n]] = fe < fr ? [expanded, fe] : [reflected, fr];
    } else if (fr < values[n - 1]) {
      [simplex[n], values[n]] = [reflected, fr];
    } else {
      const contracted = along(0.5);
      const fc = fn(contracted);
      if (fc < values[n]) {
        [simplex[n], values[n]] = [contracted, fc];
      } else {
        simplex = simplex.map((p) => p.map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])));
        values = simplex.map(fn);
      }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return simplex[best];
}

export interface FitRange {
  fMin: number;
  fMax: number;
  tauMin: number;
  tauMax: number;
  /** Grid points per axis before refinement. */
  grid?: number;
}

export function fitRing(t: ArrayLike<number>, y: ArrayLike<number>, range: FitRange): RingFit {
  const { fMin, fMax, tauMin, tauMax, grid = 40 } = range;
  let best = { f: fMin, lnTau: Math.log(tauMin), rss: Infinity };
  for (let i = 0; i < grid; i++) {
    const f = fMin + ((fMax - fMin) * i) / (grid - 1);
    for (let j = 0; j < grid; j++) {
      const lnTau = Math.log(tauMin) + ((Math.log(tauMax) - Math.log(tauMin)) * j) / (grid - 1);
      const { rss } = amplitudes(t, y, f, Math.exp(lnTau));
      if (rss < best.rss) best = { f, lnTau, rss };
    }
  }
  const objective = ([f, lnTau]: number[]) => amplitudes(t, y, f, Math.exp(lnTau)).rss;
  const [f, lnTau] = nelderMead(
    objective,
    [best.f, best.lnTau],
    [(fMax - fMin) / grid, Math.log(tauMax / tauMin) / grid],
  );
  const tau = Math.exp(lnTau);
  const { a, b, rss } = amplitudes(t, y, f, tau);
  return { f, tau, a, b, amplitude: Math.hypot(a, b), phase: Math.atan2(-b, a), rss };
}

/** Invert a small symmetric positive-definite matrix by Gauss–Jordan elimination. */
function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    const p = a[c][c];
    if (!(Math.abs(p) > 0)) throw new RangeError('singular matrix');
    for (let j = 0; j < 2 * n; j++) a[c][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = a[r][c];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= k * a[c][j];
    }
  }
  return a.map((row) => row.slice(n));
}

/**
 * One-sigma error bars of a fit in white noise of known spread σ: the square roots of the
 * diagonal of the inverse Fisher matrix, (JᵀJ / σ²)⁻¹, with J the model's derivatives with
 * respect to f, τ, A and φ at the best fit. This is what curve_fit reports with absolute_sigma.
 */
export function ringErrors(
  t: ArrayLike<number>,
  fit: Pick<RingFit, 'f' | 'tau' | 'amplitude' | 'phase'>,
  sigma: number,
): { f: number; tau: number; amplitude: number; phase: number } {
  const { f, tau, amplitude: A, phase } = fit;
  const fisher = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  for (let i = 0; i < t.length; i++) {
    const env = Math.exp(-t[i] / tau);
    const theta = 2 * Math.PI * f * t[i] + phase;
    const c = env * Math.cos(theta);
    const s = env * Math.sin(theta);
    const d = [-A * s * 2 * Math.PI * t[i], (A * c * t[i]) / (tau * tau), c, -A * s];
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 4; k++) fisher[j][k] += (d[j] * d[k]) / (sigma * sigma);
  }
  const cov = invert(fisher);
  const [ef, etau, eA, ephi] = cov.map((row, i) => Math.sqrt(row[i]));
  return { f: ef, tau: etau, amplitude: eA, phase: ephi };
}
