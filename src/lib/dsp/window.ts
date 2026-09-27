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
