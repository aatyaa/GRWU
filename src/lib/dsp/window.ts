/**
 * Hann window of length n.
 *
 * `periodic` (the default, for spectral analysis) matches scipy.signal.get_window('hann', n);
 * `periodic: false` gives the symmetric window, scipy.signal.windows.hann(n, sym=True).
 */
export function hann(n: number, { periodic = true } = {}): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1;
    return w;
  }
  const period = periodic ? n : n - 1;
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / period);
  return w;
}

/**
 * Tukey (tapered cosine) window: flat in the middle, with a fraction `alpha` of its length
 * tapered by half a Hann window. alpha = 0 is a rectangle, alpha = 1 a Hann window. Matches
 * scipy.signal.get_window(('tukey', alpha), n) (periodic) and scipy.signal.windows.tukey.
 */
export function tukey(n: number, alpha = 0.5, { periodic = true } = {}): Float64Array {
  if (n <= 1 || alpha <= 0) return new Float64Array(n).fill(1);
  if (alpha >= 1) return hann(n, { periodic });
  const m = periodic ? n + 1 : n;
  const width = Math.floor((alpha * (m - 1)) / 2);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (i <= width) {
      w[i] = 0.5 * (1 + Math.cos(Math.PI * (-1 + (2 * i) / alpha / (m - 1))));
    } else if (i < m - width - 1) {
      w[i] = 1;
    } else {
      w[i] = 0.5 * (1 + Math.cos(Math.PI * (-2 / alpha + 1 + (2 * i) / alpha / (m - 1))));
    }
  }
  return w;
}
