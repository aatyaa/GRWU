/**
 * Whitening and the matched filter, in the pipeline's conventions (pipeline/grwu_pipeline/
 * chirp.py): h~(f) = dt · DFT(h), and the noise-weighted inner product
 *   (a|b) = 4 Re Σ a~(f) b~*(f) / S(f) df   over fLow ≤ f ≤ fHigh.
 * Lengths must be powers of two (see fft.ts).
 */
import { irfft, rfft, type Spectrum } from './fft';

export type PsdFunction = (f: number) => number;

export interface Band {
  sampleRate: number;
  psd: PsdFunction;
  fLow: number;
  fHigh?: number;
}

function inBand(f: number, { fLow, fHigh, sampleRate }: Band): boolean {
  return f >= fLow && f <= (fHigh ?? sampleRate / 2) && f > 0 && f < sampleRate / 2;
}

/** (a|b) for two real series of the same length. */
export function innerProduct(a: ArrayLike<number>, b: ArrayLike<number>, band: Band): number {
  const n = a.length;
  const dt = 1 / band.sampleRate;
  const df = band.sampleRate / n;
  const A = rfft(a);
  const B = rfft(b);
  let sum = 0;
  for (let k = 0; k < A.re.length; k++) {
    const f = k * df;
    if (!inBand(f, band)) continue;
    sum += (A.re[k] * B.re[k] + A.im[k] * B.im[k]) / band.psd(f);
  }
  return 4 * sum * dt * dt * df;
}

/** Optimal SNR of a template in noise with the given PSD: √(h|h). */
export function optimalSnr(h: ArrayLike<number>, band: Band): number {
  return Math.sqrt(innerProduct(h, h, band));
}

/**
 * Divides the spectrum by the noise amplitude, √(S · fs / 2), so noise with PSD S comes out
 * with unit variance per sample over the full band; bins outside the band are zeroed.
 */
export function whiten(x: ArrayLike<number>, band: Band): Float64Array {
  const n = x.length;
  const df = band.sampleRate / n;
  const X = rfft(x);
  const out: Spectrum = { re: new Float64Array(X.re.length), im: new Float64Array(X.im.length) };
  for (let k = 0; k < X.re.length; k++) {
    const f = k * df;
    if (!inBand(f, band)) continue;
    const amplitude = Math.sqrt((band.psd(f) * band.sampleRate) / 2);
    out.re[k] = X.re[k] / amplitude;
    out.im[k] = X.im[k] / amplitude;
  }
  return irfft(out, n);
}

/**
 * Matched-filter SNR as a function of the template's lag: element j is |z| / σ for the
 * template shifted later by j samples (circularly; j > n/2 means an earlier shift). The
 * phase of the signal is unknown, so both quadratures are used and the magnitude is taken.
 * Pure noise gives values of order 1; a matching signal peaks near its optimal SNR.
 */
export function matchedFilter(
  data: ArrayLike<number>,
  template: ArrayLike<number>,
  band: Band,
): Float64Array {
  const n = data.length;
  const dt = 1 / band.sampleRate;
  const df = band.sampleRate / n;
  const D = rfft(data);
  const H = rfft(template);
  const cos: Spectrum = { re: new Float64Array(D.re.length), im: new Float64Array(D.re.length) };
  const sin: Spectrum = { re: new Float64Array(D.re.length), im: new Float64Array(D.re.length) };
  for (let k = 0; k < D.re.length; k++) {
    const f = k * df;
    if (!inBand(f, band)) continue;
    const s = band.psd(f);
    // D · H* / S, and the same times −i for the quadrature template.
    const re = (D.re[k] * H.re[k] + D.im[k] * H.im[k]) / s;
    const im = (D.im[k] * H.re[k] - D.re[k] * H.im[k]) / s;
    cos.re[k] = re;
    cos.im[k] = im;
    sin.re[k] = im;
    sin.im[k] = -re;
  }
  // Σ_k over one side, as a time series: Re Σ Z_k e^{2πikj/n} = (n/2) · irfft(Z)_j, so
  // z_j = 4 · dt² · df · (n/2) · irfft(Z)_j = 2 · dt · irfft(Z)_j.
  const zc = irfft(cos, n);
  const zs = irfft(sin, n);
  const sigma = optimalSnr(template, band);
  const snr = new Float64Array(n);
  for (let j = 0; j < n; j++) snr[j] = (2 * dt * Math.hypot(zc[j], zs[j])) / sigma;
  return snr;
}

/** Index of the largest value (for long series, where Math.max(...x) overflows the stack). */
export function argmax(x: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < x.length; i++) if (x[i] > x[best]) best = i;
  return best;
}

/** A PSD function from sampled values, interpolated linearly in frequency (held at the ends). */
export function interpolatePsd(freqs: ArrayLike<number>, psd: ArrayLike<number>): PsdFunction {
  const f0 = freqs[0];
  const df = freqs[1] - freqs[0];
  const last = freqs.length - 1;
  return (f) => {
    const x = (f - f0) / df;
    if (x <= 0) return psd[0];
    if (x >= last) return psd[last];
    const i = Math.floor(x);
    const u = x - i;
    return psd[i] * (1 - u) + psd[i + 1] * u;
  };
}
