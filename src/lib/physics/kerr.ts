/**
 * A Kerr black hole as a ringdown analysis sees it: the quasinormal modes a remnant of given
 * mass and spin rings with, the inverse map from a measured ring back to mass and spin, the
 * area of its horizon, and the redshift between the source and the detector.
 *
 * Frequencies come from the fits of Berti, Cardoso & Will, Phys. Rev. D 73, 064030 (2006),
 * Table VIII: the parametrisation single-mode analyses invert. tests/unit/kerr.test.ts checks
 * them against exact values from the qnm package (tests/fixtures/kerr.json); they agree to
 * about 2% in frequency and 3% in quality factor for spins up to 0.99.
 *
 * Masses are in solar masses. A mass inferred from a ring in the detector is a detector-frame
 * mass: the ring arrives stretched by 1 + z, exactly as if the black hole were 1 + z heavier.
 */
import { T_SUN } from '~/lib/dsp/chirp';

export { T_SUN };

/** G · M_sun / c² in kilometres: half the Schwarzschild radius of one solar mass. */
export const R_SUN_KM = 1.4766250614046494;

/** Quadrupole modes (l = m = 2): the fundamental and its first two overtones. */
export type Mode = '220' | '221' | '222';

export const MODES: readonly Mode[] = ['220', '221', '222'];

interface BertiFit {
  /** M · ω = f1 + f2 (1 − χ)^f3 */
  f: readonly [number, number, number];
  /** Q = π f τ = q1 + q2 (1 − χ)^q3 */
  q: readonly [number, number, number];
}

const BERTI: Record<Mode, BertiFit> = {
  '220': { f: [1.5251, -1.1568, 0.1292], q: [0.7, 1.4187, -0.499] },
  '221': { f: [1.3673, -1.026, 0.1628], q: [0.1, 0.5436, -0.4731] },
  '222': { f: [1.3223, -1.0257, 0.186], q: [-0.1, 0.4206, -0.4256] },
};

/**
 * The shape of a mode, independent of mass: its angular frequency in units of 1/M and its
 * quality factor Q = π f τ, how many cycles it rings through (times π) while its amplitude
 * falls by e. Both depend on the spin alone; the mass only sets the scale.
 */
export function modeShape(mode: Mode, chi: number): { mOmega: number; quality: number } {
  const { f, q } = BERTI[mode];
  const x = 1 - chi;
  return { mOmega: f[0] + f[1] * x ** f[2], quality: q[0] + q[1] * x ** q[2] };
}

export interface Ring {
  /** Frequency in Hz. */
  f: number;
  /** Damping time in seconds: the amplitude falls by e in one tau. */
  tau: number;
}

/** How a black hole of this mass (M_sun) and spin rings in the given mode. */
export function ringOf(mode: Mode, mass: number, chi: number): Ring {
  const { mOmega, quality } = modeShape(mode, chi);
  const f = mOmega / (2 * Math.PI * mass * T_SUN);
  return { f, tau: quality / (Math.PI * f) };
}

export interface KerrBlackHole {
  /** Mass in M_sun, in the frame the ring was measured in. */
  mass: number;
  /** Dimensionless spin, 0 ≤ χ < 1. */
  chi: number;
}

/**
 * The black hole that rings at frequency f (Hz) with damping time tau (s) in the given mode,
 * by inverting the fit in closed form: the quality factor Q = π f τ fixes the spin, then the
 * frequency fixes the mass. Null when no spinning Kerr black hole rings that way: Q below the
 * non-spinning value (2.12 for the fundamental) would need χ < 0.
 */
export function blackHoleOf(f: number, tau: number, mode: Mode = '220'): KerrBlackHole | null {
  const { f: fit, q } = BERTI[mode];
  const quality = Math.PI * f * tau;
  const base = (quality - q[0]) / q[1];
  if (!(base >= 1) || !Number.isFinite(base)) return null;
  const x = base ** (1 / q[2]); // 1 − χ, in (0, 1]
  const mOmega = fit[0] + fit[1] * x ** fit[2];
  return { mass: mOmega / (2 * Math.PI * f * T_SUN), chi: 1 - x };
}

/**
 * Area of the event horizon in units of (G M_sun / c²)², the unit the area law is written in:
 * A = 8π M² (1 + √(1 − χ²)). A non-spinning hole has 16π M²; spin shrinks it, to 8π M² at χ = 1.
 */
export function horizonArea(mass: number, chi: number): number {
  return 8 * Math.PI * mass * mass * (1 + Math.sqrt(1 - chi * chi));
}

/** The mass a detector infers for a source of this mass at redshift z. */
export function detectorFrameMass(sourceMass: number, z: number): number {
  return sourceMass * (1 + z);
}

/** The source-frame mass behind a detector-frame one. Areas scale with the square. */
export function sourceFrameMass(detectorMass: number, z: number): number {
  return detectorMass / (1 + z);
}
