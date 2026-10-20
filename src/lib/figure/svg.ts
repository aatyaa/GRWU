/** Path strings for figures drawn at build time or in islands. */

export type Scale = (v: number) => number;

/** A polyline through (x_i, y_i). Non-finite points break the line. */
export function linePath(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  x: Scale,
  y: Scale,
  digits = 1,
): string {
  let d = '';
  let pen = false;
  for (let i = 0; i < xs.length; i++) {
    const px = x(xs[i]);
    const py = y(ys[i]);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${px.toFixed(digits)},${py.toFixed(digits)}`;
    pen = true;
  }
  return d;
}

/** A closed band between lower and upper series (for min/max envelopes). */
export function bandPath(
  xs: ArrayLike<number>,
  lo: ArrayLike<number>,
  hi: ArrayLike<number>,
  x: Scale,
  y: Scale,
): string {
  let d = '';
  for (let i = 0; i < xs.length; i++)
    d += `${i ? 'L' : 'M'}${x(xs[i]).toFixed(1)},${y(hi[i]).toFixed(1)}`;
  for (let i = xs.length - 1; i >= 0; i--) d += `L${x(xs[i]).toFixed(1)},${y(lo[i]).toFixed(1)}`;
  return `${d}Z`;
}

/** Evenly spaced times for n samples starting at t0. */
export function times(n: number, t0: number, dt: number): number[] {
  return Array.from({ length: n }, (_, i) => t0 + i * dt);
}

/** Linear map from [d0, d1] to [r0, r1]. */
export function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  const k = (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * k;
}

/** Log10 map from [d0, d1] to [r0, r1]. */
export function log(d0: number, d1: number, r0: number, r1: number): Scale {
  const a = Math.log10(d0);
  const k = (r1 - r0) / (Math.log10(d1) - a);
  return (v) => r0 + (Math.log10(v) - a) * k;
}
