import { rfft } from './fft';
import { hann } from './window';

export interface WelchOptions {
  sampleRate: number;
  /** Samples per segment; a power of two. */
  nperseg: number;
  /** Samples shared by consecutive segments. Default: half a segment. */
  noverlap?: number;
  /** How segment periodograms are combined. Median resists glitches. Default: mean. */
  average?: 'mean' | 'median';
}

export interface Psd {
  freqs: Float64Array;
  /** One-sided power spectral density, in (input unit)^2 / Hz. */
  psd: Float64Array;
  segments: number;
}

/**
 * Welch's PSD estimate with scipy.signal.welch's defaults: periodic Hann window, each segment's
 * mean removed, density scaling, one-sided (doubled except at DC and Nyquist).
 */
export function welch(x: ArrayLike<number>, options: WelchOptions): Psd {
  const { sampleRate, nperseg } = options;
  const noverlap = options.noverlap ?? Math.floor(nperseg / 2);
  const average = options.average ?? 'mean';
  if (nperseg > x.length) {
    throw new RangeError(`nperseg (${nperseg}) is longer than the signal (${x.length})`);
  }
  if (noverlap < 0 || noverlap >= nperseg) {
    throw new RangeError(`noverlap must be in [0, nperseg), got ${noverlap}`);
  }

  const step = nperseg - noverlap;
  const segments = Math.floor((x.length - noverlap) / step);
  const bins = nperseg / 2 + 1;
  const window = hann(nperseg);
  let windowPower = 0;
  for (const w of window) windowPower += w * w;
  const scale = 1 / (sampleRate * windowPower);

  const periodograms = new Float64Array(segments * bins);
  const segment = new Float64Array(nperseg);
  for (let s = 0; s < segments; s++) {
    const start = s * step;
    let mean = 0;
    for (let i = 0; i < nperseg; i++) mean += x[start + i];
    mean /= nperseg;
    for (let i = 0; i < nperseg; i++) segment[i] = (x[start + i] - mean) * window[i];

    const { re, im } = rfft(segment);
    const row = s * bins;
    for (let k = 0; k < bins; k++) {
      const power = (re[k] * re[k] + im[k] * im[k]) * scale;
      periodograms[row + k] = k > 0 && k < bins - 1 ? 2 * power : power;
    }
  }

  const psd = new Float64Array(bins);
  if (average === 'mean') {
    for (let s = 0; s < segments; s++) {
      for (let k = 0; k < bins; k++) psd[k] += periodograms[s * bins + k];
    }
    for (let k = 0; k < bins; k++) psd[k] /= segments;
  } else {
    const column = new Float64Array(segments);
    const bias = medianBias(segments);
    for (let k = 0; k < bins; k++) {
      for (let s = 0; s < segments; s++) column[s] = periodograms[s * bins + k];
      psd[k] = median(column) / bias;
    }
  }

  const freqs = new Float64Array(bins);
  for (let k = 0; k < bins; k++) freqs[k] = (k * sampleRate) / nperseg;
  return { freqs, psd, segments };
}

/** Sorts a copy and takes the middle value (the mean of the two middle values for even n). */
export function median(values: ArrayLike<number>): number {
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Bias of the median of n chi-squared(2) periodograms relative to their mean
 * (scipy.signal._spectral_py._median_bias).
 */
export function medianBias(n: number): number {
  let sum = 0;
  for (let k = 1; k <= Math.floor((n - 1) / 2); k++) sum += 1 / (2 * k + 1) - 1 / (2 * k);
  return 1 + sum;
}
