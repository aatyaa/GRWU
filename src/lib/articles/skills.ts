/**
 * "Almost None of It Is About Gravitational Waves": a toy inspiral–merger–ringdown waveform
 * for an equal-mass black-hole binary, in units of the total mass M (G = c = 1). It is an
 * illustration assembled from the three regimes, not a waveform model:
 *   inspiral   leading-order (Newtonian) chirp, up to the innermost stable circular orbit
 *   merger     a smooth blend of frequency and amplitude over the last 25 M
 *   ringdown   the (2,2,0) quasinormal mode of the remnant (M_f ≈ 0.95 M, spin ≈ 0.69)
 * Because vacuum general relativity has no scale but M, the same curve serves every mass:
 * times scale with M and frequencies with 1/M.
 */
import { T_SUN } from '~/lib/dsp/chirp';

const ETA = 0.25; // symmetric mass ratio of an equal-mass binary
/** GW frequency at the innermost stable circular orbit, × M. */
export const F_ISCO = 1 / (6 ** 1.5 * Math.PI);
/** Remnant (2,2,0) ringdown: frequency × M and damping time / M (M_f = 0.95 M, Mω = 0.5326 − 0.0808i). */
export const F_RING = 0.5326 / (2 * Math.PI * 0.95);
export const TAU_RING = 0.95 / 0.0808;
/** The merger stretch before the peak, in M. */
export const T_MERGE = 25;

const smooth = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

/** Newtonian time to coalescence (in M) from a frequency f·M, for this mass ratio. */
export function tauNewtonian(fM: number): number {
  return (5 / (256 * ETA)) * (Math.PI * fM) ** (-8 / 3);
}

/** GW cycles from frequency f·M to coalescence, at leading order. */
export function cyclesNewtonian(fM: number): number {
  const mc = ETA ** (3 / 5); // chirp mass / M
  return (1 / (32 * Math.PI ** (8 / 3))) * (mc * fM) ** (-5 / 3);
}

export interface ToyWaveform {
  /** Time in units of M, peak at 0. */
  t: number[];
  h: number[];
  /** Instantaneous GW frequency × M. */
  f: number[];
  /** Cycles in the merger and ringdown, until the ring has faded to 5%. */
  lateCycles: number;
}

export function toyWaveform(from = -420, to = 60, dt = 0.25): ToyWaveform {
  const tIsco = -T_MERGE;
  const tc = tIsco + tauNewtonian(F_ISCO);
  const aIsco = (Math.PI * F_ISCO) ** (2 / 3);
  const aPeak = 1.6 * aIsco;
  const t: number[] = [];
  const h: number[] = [];
  const f: number[] = [];
  let phase = 0;
  let lateCycles = 0;
  for (let ti = from; ti <= to; ti += dt) {
    let fi: number;
    let ai: number;
    if (ti <= tIsco) {
      fi = (1 / Math.PI) * (5 / (256 * ETA * (tc - ti))) ** (3 / 8);
      ai = (Math.PI * fi) ** (2 / 3);
    } else if (ti < 0) {
      const u = smooth((ti - tIsco) / (0 - tIsco));
      fi = F_ISCO + (F_RING - F_ISCO) * u;
      ai = aIsco + (aPeak - aIsco) * u;
    } else {
      fi = F_RING;
      ai = aPeak * Math.exp(-ti / TAU_RING);
    }
    phase += 2 * Math.PI * fi * dt;
    if (ti > tIsco && ai > 0.05 * aPeak) lateCycles += fi * dt;
    t.push(Number(ti.toFixed(3)));
    h.push(Number((ai * Math.cos(phase)).toFixed(4)));
    f.push(Number(fi.toFixed(5)));
  }
  return { t, h, f, lateCycles: Number(lateCycles.toFixed(2)) };
}

/** Seconds per unit of M, for a total mass in solar masses. */
export const secondsPerM = (mass: number) => mass * T_SUN;
