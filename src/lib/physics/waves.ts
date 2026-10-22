/**
 * Gravitational waves and what a merger leaves behind, for Only Ever Forwards: how a passing
 * wave moves a ring of free particles in its two polarisations, the power a circular binary
 * radiates (the quadrupole formula), and the mass and spin of the hole two non-spinning holes
 * make, from the numerical-relativity fits of Jiménez-Forteza, Keitel, Husa et al. (UIB2016).
 *
 * The fits are checked against LALSuite's implementation (lalinference.imrtgr.nrutils) through
 * tests/fixtures/waves.json, and against the test-particle limit, where a small body falls from
 * the last stable orbit of a Schwarzschild hole.
 */
import { C } from './relativity';

const G = 6.674_3e-11;

/** c⁵/G in watts: the scale every gravitational luminosity is measured against. */
export const LUMINOSITY_SCALE = C ** 5 / G;

export type Polarisation = 'plus' | 'cross';

/**
 * Where a free particle at (x, y) sits as a wave of strain amplitude h, travelling along z,
 * passes through phase φ. To first order in h: plus stretches x while squeezing y; cross does
 * the same along the diagonals, 45° round.
 */
export function ringPoint(
  x: number,
  y: number,
  h: number,
  polarisation: Polarisation,
  phase: number,
): { x: number; y: number } {
  const s = (h / 2) * Math.cos(phase);
  return polarisation === 'plus'
    ? { x: x * (1 + s), y: y * (1 - s) }
    : { x: x + s * y, y: y + s * x };
}

/**
 * Power radiated by two masses (kg) on a circular orbit of separation r (m), from Einstein's
 * quadrupole formula: (32/5) G⁴ m₁² m₂² (m₁ + m₂) / c⁵ r⁵ (Peters and Mathews, 1963).
 */
export function binaryLuminosity(m1: number, m2: number, r: number): number {
  return ((32 / 5) * G ** 4 * (m1 * m2) ** 2 * (m1 + m2)) / (C ** 5 * r ** 5);
}

/** The chirp mass, (m₁m₂)^(3/5) / (m₁ + m₂)^(1/5), in the units of the masses. */
export function chirpMass(m1: number, m2: number): number {
  return (m1 * m2) ** 0.6 / (m1 + m2) ** 0.2;
}

/** Symmetric mass ratio η = m₁m₂/(m₁ + m₂)² of a binary with mass ratio q = m₂/m₁. */
export function symmetricMassRatio(q: number): number {
  return q / (1 + q) ** 2;
}

/**
 * Share of the total mass radiated by two non-spinning holes with mass ratio q (UIB2016 v2,
 * Eq. 28 of LIGO-P1600270-v4 with no spin): a quartic in η whose linear term,
 * (1 − 2√2/3) η, is the energy a test particle radiates falling in from the last stable orbit.
 */
export function radiatedFraction(q: number): number {
  const eta = symmetricMassRatio(q);
  const a2 = 0.560_990_413_531_337_4;
  const a3 = -0.846_675_637_644_04;
  const a4 = 3.145_145_224_278_187;
  return (1 - (2 / 3) * Math.SQRT2) * eta + a2 * eta ** 2 + a3 * eta ** 3 + a4 * eta ** 4;
}

/** Mass of the final hole as a share of the total, 1 − the radiated share. */
export function finalMassFraction(q: number): number {
  return 1 - radiatedFraction(q);
}

/**
 * Spin of the hole two non-spinning holes leave (UIB2016 v2, Eq. 16 of LIGO-P1600270-v4 with
 * no spin): the orbital angular momentum kept, whose linear term 2√3 η is that of a test
 * particle at the last stable orbit.
 */
export function finalSpin(q: number): number {
  const eta = symmetricMassRatio(q);
  const a2 = 5.24 * 3.832_634_161_870_857_7;
  const a3 = 1.3 * -9.487_364_155_598_392;
  const a5 = 2.88 * 2.513_487_514_564_837_4;
  return (2 * Math.sqrt(3) * eta + a2 * eta ** 2 + a3 * eta ** 3) / (1 + a5 * eta);
}

/** Planck's constant, J s (exact). */
const H = 6.626_070_15e-34;

/** How many quanta of frequency f (Hz) carry an energy E (J). */
export function quanta(energy: number, frequency: number): number {
  return energy / (H * frequency);
}

/**
 * Entropy per quantum of black-body radiation, 2π⁴ / 45ζ(3) ≈ 3.6, in units of k_B. Thermal
 * radiation is the most disordered form a given energy can take, so the same energy at the same
 * typical frequency, made thermal, would carry about this much per quantum.
 */
export const THERMAL_ENTROPY_PER_QUANTUM = (2 * Math.PI ** 4) / (45 * 1.202_056_903_159_594);
