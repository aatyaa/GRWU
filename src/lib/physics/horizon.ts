/**
 * Horizons as thermodynamics, for Only Ever Forwards: the area of a Kerr horizon and the
 * entropy it carries (Bekenstein and Hawking), its surface gravity and temperature, the angular
 * velocity of the horizon, what the area theorem allows a merger to radiate, and how a hole
 * hotter than the sky evaporates.
 *
 * Kerr quantities without units are in GM/c² = 1. The formulas are checked against identities
 * they do not use (Smarr's relation, and the first law by finite differences), against the
 * published temperature of a solar-mass hole, and against scipy through tests/fixtures/waves.json.
 */
import { M_SUN_KG } from './blackhole';
import { C } from './relativity';

/** CODATA 2022, as scipy.constants gives them (h, k_B and c exact). */
const G = 6.674_3e-11;
const HBAR = 6.626_070_15e-34 / (2 * Math.PI);
export const K_B = 1.380_649e-23;
/** The temperature of the microwave sky today, K (Fixsen 2009). */
export const T_CMB = 2.7255;
/** The Planck length, m. */
export const PLANCK_LENGTH = Math.sqrt((HBAR * G) / C ** 3);

const root = (chi: number) => Math.sqrt(1 - chi * chi);

/** Area of the outer horizon, 4π (r₊² + a²) = 8π (1 + √(1 − χ²)), in (GM/c²)². */
export function horizonArea(chi: number): number {
  return 8 * Math.PI * (1 + root(chi));
}

/** Surface gravity, (r₊ − r₋) / 2(r₊² + a²) = √(1 − χ²) / 2(1 + √(1 − χ²)), in c⁴/GM. */
export function surfaceGravity(chi: number): number {
  return root(chi) / (2 * (1 + root(chi)));
}

/** Angular velocity of the horizon, a / (r₊² + a²) = χ / 2(1 + √(1 − χ²)), in c³/GM. */
export function horizonOmega(chi: number): number {
  return chi / (2 * (1 + root(chi)));
}

/**
 * Christodoulou's irreducible mass, √(A / 16π) in units of M: what is left once all the spin's
 * energy has been taken out. No classical process can lower it.
 */
export function irreducibleMass(chi: number): number {
  return Math.sqrt(horizonArea(chi) / (16 * Math.PI));
}

/** Horizon area in m² of a hole of the given mass (kg) and spin. */
export function horizonAreaSI(massKg: number, chi = 0): number {
  return horizonArea(chi) * ((G * massKg) / (C * C)) ** 2;
}

/** Bekenstein–Hawking entropy, A c³ / 4Għ = A / 4ℓ_P², in units of k_B. */
export function entropy(massKg: number, chi = 0): number {
  return horizonAreaSI(massKg, chi) / (4 * PLANCK_LENGTH ** 2);
}

/** Hawking temperature, ħκ / 2πck_B, in kelvin: ħc³ / 8πGMk_B without spin. */
export function hawkingTemperature(massKg: number, chi = 0): number {
  const kappa = (surfaceGravity(chi) * C ** 4) / (G * massKg);
  return (HBAR * kappa) / (2 * Math.PI * C * K_B);
}

/** The mass (kg) of a non-spinning hole at temperature T (K). */
export function massAtTemperature(kelvin: number): number {
  return (HBAR * C ** 3) / (8 * Math.PI * G * K_B * kelvin);
}

/**
 * Heat capacity of a non-spinning hole, c² dM/dT = −8πGM²k_B/ħc, in units of k_B: exactly
 * −2 S. Feed it energy and it cools.
 */
export function heatCapacity(massKg: number): number {
  return -2 * entropy(massKg);
}

/**
 * Lifetime (s) of a non-spinning hole radiating photons only into empty space,
 * 5120 π G² M³ / ħc⁴. The other massless particles shorten it by a factor of order one.
 */
export function evaporationTime(massKg: number): number {
  return (5120 * Math.PI * G * G * massKg ** 3) / (HBAR * C ** 4);
}

/** The mass (kg) that evaporates, photons only, in a time t (s). */
export function massEvaporatingIn(seconds: number): number {
  return Math.cbrt((seconds * HBAR * C ** 4) / (5120 * Math.PI * G * G));
}

/**
 * The least final mass the area theorem allows when holes m₁ and m₂ (spins χ₁, χ₂) merge into
 * one of spin χ_f: the final area may not be smaller than the two areas together. Any unit of
 * mass.
 */
export function minimumFinalMass(m1: number, m2: number, chi1 = 0, chi2 = 0, chiF = 0): number {
  const before = m1 * m1 * (1 + root(chi1)) + m2 * m2 * (1 + root(chi2));
  return Math.sqrt(before / (1 + root(chiF)));
}

/** The largest share of the total mass a merger can radiate without shrinking the area. */
export function maximumRadiated(m1: number, m2: number, chi1 = 0, chi2 = 0, chiF = 0): number {
  return 1 - minimumFinalMass(m1, m2, chi1, chi2, chiF) / (m1 + m2);
}

/** Entropy (units of k_B) of a hole of the given mass in solar masses. */
export function entropySun(massSun: number, chi = 0): number {
  return entropy(massSun * M_SUN_KG, chi);
}
