/**
 * One-sided PSD (1/Hz) of Advanced LIGO at zero-detuned high-power design sensitivity.
 * Analytic fit from Mishra, Arun, Iyer & Sathyaprakash (2010), arXiv:1005.0304; the same
 * curve the data pipeline uses for synthetic noise (pipeline/grwu_pipeline/noise.py).
 * Meaningful above about 10 Hz.
 */
export function aligoDesignPsd(f: number): number {
  const x = f / 215;
  return (
    1e-49 *
    (10 ** (16 - 4 * (f - 7.9) ** 2) +
      2.4e-62 * x ** -50 +
      0.08 * x ** -4.69 +
      (123.35 * (1 - 0.23 * x ** 2 + 0.0764 * x ** 4)) / (1 + 0.17 * x ** 2))
  );
}
