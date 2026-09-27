import FFT from 'fft.js';

/** One-sided spectrum of a real signal: bins 0..n/2, as numpy.fft.rfft returns them. */
export interface Spectrum {
  re: Float64Array;
  im: Float64Array;
}

const plans = new Map<number, FFT>();

function plan(n: number): FFT {
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new RangeError(`FFT length must be a power of two (at least 2), got ${n}`);
  }
  let fft = plans.get(n);
  if (!fft) {
    fft = new FFT(n);
    plans.set(n, fft);
  }
  return fft;
}

/**
 * Real-input DFT with numpy's conventions: X_k = sum_j x_j e^(-2 pi i j k / n), k = 0..n/2,
 * with no normalisation. The length must be a power of two.
 */
export function rfft(x: ArrayLike<number>): Spectrum {
  const n = x.length;
  const fft = plan(n);
  const out = new Float64Array(2 * n);
  fft.realTransform(out, x);
  const bins = n / 2 + 1;
  const re = new Float64Array(bins);
  const im = new Float64Array(bins);
  for (let k = 0; k < bins; k++) {
    re[k] = out[2 * k];
    im[k] = out[2 * k + 1];
  }
  return { re, im };
}

/**
 * Inverse of {@link rfft} (numpy.fft.irfft for an even length n): rebuilds the Hermitian
 * spectrum, ignoring the imaginary parts of the DC and Nyquist bins, and divides by n.
 */
export function irfft(spectrum: Spectrum, n: number): Float64Array {
  const fft = plan(n);
  const half = n / 2;
  if (spectrum.re.length !== half + 1 || spectrum.im.length !== half + 1) {
    throw new RangeError(`a length-${n} signal needs ${half + 1} spectrum bins`);
  }
  const full = new Float64Array(2 * n);
  full[0] = spectrum.re[0];
  full[2 * half] = spectrum.re[half];
  for (let k = 1; k < half; k++) {
    const re = spectrum.re[k];
    const im = spectrum.im[k];
    full[2 * k] = re;
    full[2 * k + 1] = im;
    full[2 * (n - k)] = re;
    full[2 * (n - k) + 1] = -im;
  }
  const out = new Float64Array(2 * n);
  fft.inverseTransform(out, full);
  const x = new Float64Array(n);
  for (let j = 0; j < n; j++) x[j] = out[2 * j];
  return x;
}
