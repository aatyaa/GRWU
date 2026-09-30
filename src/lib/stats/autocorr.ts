import { irfft, rfft } from '~/lib/dsp/fft';

/**
 * How much a chain of samples remembers itself, and how many independent samples it is worth.
 * Follows emcee.autocorr (Sokal's automatic window) and is checked against it
 * (tests/fixtures/foundations.json).
 */

/** Normalised autocorrelation of a series at lags 0..n-1, computed with an FFT. */
export function autocorrelation(x: ArrayLike<number>): Float64Array {
  const n = x.length;
  if (n < 2) throw new RangeError('need at least two samples');
  let m = 1;
  while (m < n) m *= 2;
  m *= 2;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  const padded = new Float64Array(m);
  for (let i = 0; i < n; i++) padded[i] = x[i] - mean;
  const { re, im } = rfft(padded);
  const power = new Float64Array(re.length);
  for (let k = 0; k < re.length; k++) power[k] = re[k] * re[k] + im[k] * im[k];
  const circular = irfft({ re: power, im: new Float64Array(re.length) }, m);
  const acf = new Float64Array(n);
  for (let i = 0; i < n; i++) acf[i] = circular[i] / circular[0];
  return acf;
}

/**
 * Integrated autocorrelation time: roughly, how many steps apart two samples must be to count
 * as independent. Summed up to the first lag M with M ≥ c τ(M).
 */
export function integratedTime(x: ArrayLike<number>, c = 5): number {
  const acf = autocorrelation(x);
  let sum = 0;
  let tau = 1;
  for (let m = 0; m < acf.length; m++) {
    sum += acf[m];
    tau = 2 * sum - 1;
    if (m >= c * tau) return tau;
  }
  return tau;
}

/** Effective sample size: the number of independent samples a correlated chain is worth. */
export function effectiveSampleSize(x: ArrayLike<number>, c = 5): number {
  return x.length / integratedTime(x, c);
}
