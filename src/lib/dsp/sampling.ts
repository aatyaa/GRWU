/**
 * Recording a signal as samples, and what sampling does to frequencies above half the rate.
 * Checked against the peak of numpy.fft.rfft of sampled tones (tests/fixtures/foundations.json).
 */

/** The frequency a tone of frequency f appears at when sampled at rate fs: folded into [0, fs/2]. */
export function aliasFrequency(f: number, fs: number): number {
  return Math.abs(f - fs * Math.round(f / fs));
}

/** n samples of cos(2π f t + phase) taken at rate fs. */
export function sampleCosine(f: number, fs: number, n: number, phase = 0): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.cos((2 * Math.PI * f * i) / fs + phase);
  return out;
}
