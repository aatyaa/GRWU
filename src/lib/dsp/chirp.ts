/**
 * The toy leading-order (Newtonian) chirp of pipeline/grwu_pipeline/chirp.py, ported line by
 * line and checked against the pipeline's own output (tests/unit/chirp.test.ts). No merger,
 * no ringdown, no detector response: a known signal to teach with.
 */

/** G · M_sun / c³ in seconds. */
export const T_SUN = 4.925490947641267e-6;

/** Gravitational-wave frequency (Hz) a time `tau` (s) before coalescence. */
export function chirpFrequency(tau: number, chirpMass: number): number {
  const mc = chirpMass * T_SUN;
  return ((5 / (256 * tau)) ** (3 / 8) * mc ** (-5 / 8)) / Math.PI;
}

/** Seconds left when the signal reaches `frequency`. */
export function timeToCoalescence(frequency: number, chirpMass: number): number {
  const mc = chirpMass * T_SUN;
  return (5 / 256) * (Math.PI * frequency) ** (-8 / 3) * mc ** (-5 / 3);
}

/** Chirp mass of two component masses: the combination the leading-order phase depends on. */
export function chirpMassOf(m1: number, m2: number): number {
  return (m1 * m2) ** (3 / 5) / (m1 + m2) ** (1 / 5);
}

export interface ChirpOptions {
  sampleRate: number;
  n: number;
  mergerTime: number;
  chirpMass: number;
  fStart: number;
  fEnd: number;
  phase?: number;
  taperStart?: number;
  taperEnd?: number;
}

/** h(t) ∝ f(t)^(2/3) cos Φ(t) between fStart and fEnd, with raised-cosine tapers. */
export function newtonianChirp(options: ChirpOptions): Float64Array {
  const { sampleRate, n, mergerTime, chirpMass, fStart, fEnd } = options;
  const phase = options.phase ?? 0;
  const taperStart = options.taperStart ?? 0.1;
  const taperEnd = options.taperEnd ?? 0.004;
  const mc = chirpMass * T_SUN;
  const tFirst = mergerTime - timeToCoalescence(fStart, chirpMass);
  const tLast = mergerTime - timeToCoalescence(fEnd, chirpMass);
  const h = new Float64Array(n);
  const active: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    if (t < tFirst || t > tLast) continue;
    const tau = mergerTime - t;
    const f = chirpFrequency(tau, chirpMass);
    const phi = phase - 2 * (5 * mc) ** (-5 / 8) * tau ** (5 / 8);
    h[i] = f ** (2 / 3) * Math.cos(phi);
    active.push(i);
  }
  const dt = 1 / sampleRate;
  const nStart = Math.min(Math.round(taperStart / dt), active.length);
  const nEnd = Math.min(Math.round(taperEnd / dt), active.length - nStart);
  const rise = (k: number, m: number) => 0.5 * (1 - Math.cos((Math.PI * k) / Math.max(m, 1)));
  for (let k = 0; k < nStart; k++) h[active[k]] *= rise(k, nStart);
  for (let k = 0; k < nEnd; k++) h[active[active.length - 1 - k]] *= rise(k, nEnd);
  return h;
}
