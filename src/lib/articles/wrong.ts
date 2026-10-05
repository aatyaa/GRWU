/**
 * "What the Wrong Model Knows": a ringdown built from two decaying tones, fitted with a
 * template that has one tone (or both), at every start time. Computed at build time.
 *
 * The toy follows The Shape of Error, Act V: the quantity we want is read from the slow
 * tone's pitch (for a black hole of given spin the ring's frequency is inversely
 * proportional to its mass), its true value is 60, and it never changes.
 */
import { gaussian, mulberry32 } from '~/lib/stats/random';

export const TRUTH = 60;
const FS = 16384; // samples per second
const SLOW = { f: 250, tau: 4.0e-3, a: 1.0, phase: 0.3 };
const FAST = { f: 205, tau: 1.0e-3, a: 1.6, phase: 1.9 };
const NOISE = 0.02;
const T_END = 12e-3;

/** The second tone's pitch and decay are tied to the first, as the theory ties overtones. */
const RATIO = { f: FAST.f / SLOW.f, tau: FAST.tau / SLOW.tau };

const tone = (t: number, p: { f: number; tau: number; a: number; phase: number }) =>
  p.a * Math.exp(-t / p.tau) * Math.cos(2 * Math.PI * p.f * t + p.phase);

export interface Ring {
  t: number[];
  data: number[];
  slow: number[];
  fast: number[];
  noise: number;
}

let ringCache: Ring | undefined;
export const SEED = 7;

export function ring(seed = SEED): Ring {
  if (ringCache && seed === SEED) return ringCache;
  const draw = gaussian(mulberry32(seed));
  const t: number[] = [];
  const data: number[] = [];
  const slow: number[] = [];
  const fast: number[] = [];
  for (let i = 0; i / FS <= T_END; i++) {
    const ti = i / FS;
    const s = tone(ti, SLOW);
    const q = tone(ti, FAST);
    t.push(ti);
    slow.push(s);
    fast.push(q);
    data.push(s + q + NOISE * draw());
  }
  const out = { t, data, slow, fast, noise: NOISE };
  if (seed === SEED) ringCache = out;
  return out;
}

interface Solved {
  chi2: number;
  coef: number[];
}

/** Least squares for the linear amplitudes at a fixed pitch and decay (variable projection). */
function solve(t: number[], y: number[], f: number, tau: number, tones: 1 | 2): Solved {
  const pitches =
    tones === 1
      ? [[f, tau]]
      : [
          [f, tau],
          [f * RATIO.f, tau * RATIO.tau],
        ];
  const k = 2 * pitches.length;
  const G = Array.from({ length: k }, () => new Float64Array(k));
  const r = new Float64Array(k);
  const col = new Float64Array(k);
  for (let i = 0; i < t.length; i++) {
    pitches.forEach(([pf, pt], m) => {
      const env = Math.exp(-t[i] / pt);
      col[2 * m] = env * Math.cos(2 * Math.PI * pf * t[i]);
      col[2 * m + 1] = env * Math.sin(2 * Math.PI * pf * t[i]);
    });
    for (let a = 0; a < k; a++) {
      r[a] += col[a] * y[i];
      for (let b = 0; b < k; b++) G[a][b] += col[a] * col[b];
    }
  }
  // Gaussian elimination on the small normal equations.
  const M = G.map((row, a) => [...row, r[a]]);
  for (let p = 0; p < k; p++) {
    let best = p;
    for (let q = p + 1; q < k; q++) if (Math.abs(M[q][p]) > Math.abs(M[best][p])) best = q;
    [M[p], M[best]] = [M[best], M[p]];
    for (let q = p + 1; q < k; q++) {
      const factor = M[q][p] / M[p][p];
      for (let c = p; c <= k; c++) M[q][c] -= factor * M[p][c];
    }
  }
  const coef = new Array<number>(k).fill(0);
  for (let p = k - 1; p >= 0; p--) {
    let s = M[p][k];
    for (let c = p + 1; c < k; c++) s -= M[p][c] * coef[c];
    coef[p] = s / M[p][p];
  }
  let chi2 = 0;
  for (let i = 0; i < t.length; i++) {
    const m = model(t[i], f, tau, tones, coef);
    chi2 += ((y[i] - m) / NOISE) ** 2;
  }
  return { chi2, coef };
}

function model(t: number, f: number, tau: number, tones: 1 | 2, coef: number[]): number {
  let v = 0;
  const pitches =
    tones === 1
      ? [[f, tau]]
      : [
          [f, tau],
          [f * RATIO.f, tau * RATIO.tau],
        ];
  pitches.forEach(([pf, pt], m) => {
    const env = Math.exp(-t / pt);
    v +=
      env *
      (coef[2 * m] * Math.cos(2 * Math.PI * pf * t) +
        coef[2 * m + 1] * Math.sin(2 * Math.PI * pf * t));
  });
  return v;
}

export interface Fit {
  f: number;
  tau: number;
  answer: number;
  /** One-sigma error bar on the answer, from the curvature of χ² in the pitch. */
  error: number;
  chi2dof: number;
  /** How far the answer is from the truth, in its own error bars. */
  off: number;
}

/** Best pitch and decay by a coarse grid, a fine grid around it, and the profile for σ. */
export function fitTones(t: number[], y: number[], tones: 1 | 2): Fit & { coef: number[] } {
  let best = { f: 0, tau: 0, chi2: Infinity, coef: [] as number[] };
  const search = (f0: number, f1: number, df: number, t0: number, t1: number, dt: number) => {
    for (let f = f0; f <= f1 + 1e-9; f += df) {
      for (let tau = t0; tau <= t1 + 1e-12; tau += dt) {
        const s = solve(t, y, f, tau, tones);
        if (s.chi2 < best.chi2) best = { f, tau, chi2: s.chi2, coef: s.coef };
      }
    }
  };
  search(215, 285, 2.5, 1e-3, 9e-3, 0.3e-3);
  const coarse = { ...best };
  search(coarse.f - 2.5, coarse.f + 2.5, 0.1, coarse.tau - 0.3e-3, coarse.tau + 0.3e-3, 0.02e-3);
  // Profile χ² in the pitch (minimised over the decay), and a parabola for its curvature.
  const profile = (f: number) => {
    let low = Infinity;
    for (let tau = best.tau - 0.4e-3; tau <= best.tau + 0.4e-3; tau += 0.02e-3) {
      low = Math.min(low, solve(t, y, f, tau, tones).chi2);
    }
    return low;
  };
  const h = 0.2;
  const curvature = (profile(best.f + h) + profile(best.f - h) - 2 * best.chi2) / (h * h);
  const sigmaF = 1 / Math.sqrt(Math.max(curvature / 2, 1e-12));
  const answer = (TRUTH * SLOW.f) / best.f;
  const error = (answer * sigmaF) / best.f;
  const dof = t.length - (2 * tones + 2);
  return {
    f: best.f,
    tau: best.tau,
    answer,
    error,
    chi2dof: best.chi2 / dof,
    off: (answer - TRUTH) / error,
    coef: best.coef,
  };
}

export interface ScanPoint {
  start: number;
  one: Fit;
  two: Fit;
  /** Each template's best curve over the fitted window, for drawing. */
  curveOne: number[];
  curveTwo: number[];
}

let scanCache: ScanPoint[] | undefined;

/** Both templates fitted from every start time between the peak and 6 ms. */
export function scan(seed = SEED): ScanPoint[] {
  if (scanCache && seed === SEED) return scanCache;
  const r = ring(seed);
  const out: ScanPoint[] = [];
  for (let k = 0; k <= 24; k++) {
    const start = k * 0.25e-3;
    const from = Math.round(start * FS);
    const t = r.t.slice(from);
    const y = r.data.slice(from);
    const one = fitTones(t, y, 1);
    const two = fitTones(t, y, 2);
    const every = 3;
    const curve = (fit: typeof one, tones: 1 | 2) =>
      r.t
        .map((ti, i) =>
          i >= from && i % every === 0
            ? Number(model(ti, fit.f, fit.tau, tones, fit.coef).toFixed(4))
            : NaN,
        )
        .filter((_, i) => i % every === 0);
    const strip = ({ f, tau, answer, error, chi2dof, off }: Fit): Fit => ({
      f,
      tau,
      answer,
      error,
      chi2dof,
      off,
    });
    out.push({
      start,
      one: strip(one),
      two: strip(two),
      curveOne: curve(one, 1),
      curveTwo: curve(two, 2),
    });
  }
  if (seed === SEED) scanCache = out;
  return out;
}
