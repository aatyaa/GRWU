/**
 * Where to draw the line (A Peak Is Only a Candidate). A matched filter that maximises over
 * the signal's unknown phase reports ρ = |z|, the length of a two-component Gaussian vector:
 * Rayleigh-distributed in noise alone, Rician when a signal of strength ρ₀ is present.
 * Checked against scipy (`special.i0e`, `stats.rice`) in tests/unit/detection.test.ts.
 */

/** e^{−x} I₀(x): the modified Bessel function of order zero, scaled so it never overflows. */
export function i0e(x: number): number {
  const a = Math.abs(x);
  if (a < 15) {
    // I₀(x) = Σ (x²/4)^k / (k!)², every term positive.
    const q = (a * a) / 4;
    let term = 1;
    let sum = 1;
    for (let k = 1; k < 200 && term > 1e-17 * sum; k++) {
      term *= q / (k * k);
      sum += term;
    }
    return sum * Math.exp(-a);
  }
  // Large x: e^{−x} I₀(x) ≈ (2πx)^{−1/2} Σ ((2k−1)!!)² / (k! (8x)^k), stopped at its smallest term.
  let term = 1;
  let sum = 1;
  for (let k = 1; k < 60; k++) {
    const next = (term * (2 * k - 1) ** 2) / (8 * k * a);
    if (next > term || next < 1e-17 * sum) break;
    term = next;
    sum += term;
  }
  return sum / Math.sqrt(2 * Math.PI * a);
}

/** Density of the filter's score in noise alone: ρ e^{−ρ²/2}. */
export function noisePdf(rho: number): number {
  return rho <= 0 ? 0 : rho * Math.exp(-0.5 * rho * rho);
}

/** Density of the score when a signal of strength ρ₀ is present (Rice). */
export function signalPdf(rho: number, rho0: number): number {
  if (rho <= 0) return 0;
  return rho * Math.exp(-0.5 * (rho - rho0) ** 2) * i0e(rho * rho0);
}

/** Chance that noise alone scores above t: e^{−t²/2}. */
export function falseAlarm(t: number): number {
  return Math.exp(-0.5 * t * t);
}

/** Chance that a signal of strength ρ₀ scores above t (Marcum's Q₁), by Simpson's rule. */
export function detection(t: number, rho0: number): number {
  const hi = Math.max(t, rho0) + 12;
  if (t >= hi) return 0;
  const n = 2000;
  const h = (hi - t) / n;
  let s = signalPdf(t, rho0) + signalPdf(hi, rho0);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * signalPdf(t + i * h, rho0);
  return Math.min(1, (s * h) / 3);
}
