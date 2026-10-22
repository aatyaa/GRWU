import { describe, expect, it } from 'vitest';
import fx from '../fixtures/waves.json';
import { M_SUN_KG, extractable, kerrIsco } from '~/lib/physics/blackhole';
import {
  T_CMB,
  entropy,
  entropySun,
  evaporationTime,
  hawkingTemperature,
  heatCapacity,
  horizonArea,
  horizonOmega,
  irreducibleMass,
  massAtTemperature,
  massEvaporatingIn,
  maximumRadiated,
  minimumFinalMass,
  surfaceGravity,
} from '~/lib/physics/horizon';
import { amplification, evolveMode } from '~/lib/physics/hyperbolic';
import { JULIAN_YEAR } from '~/lib/physics/relativity';
import {
  THERMAL_ENTROPY_PER_QUANTUM,
  binaryLuminosity,
  chirpMass,
  finalMassFraction,
  finalSpin,
  radiatedFraction,
  ringPoint,
  symmetricMassRatio,
} from '~/lib/physics/waves';

const close = (a: number, b: number, rtol: number) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rtol * Math.abs(b) + 1e-14);

describe('horizons', () => {
  it('match the Kerr area, surface gravity and angular velocity from scipy', () => {
    for (const ref of fx.kerr) {
      close(horizonArea(ref.chi), ref.area, 1e-12);
      close(surfaceGravity(ref.chi), ref.kappa, 1e-12);
      close(horizonOmega(ref.chi), ref.omega, 1e-12);
    }
  });

  it("obey Smarr's relation, M = 2ΩJ + κA/4π, which none of the formulas uses", () => {
    for (const chi of [0, 0.2, 0.5, 0.69, 0.9, 0.999]) {
      close(
        2 * horizonOmega(chi) * chi + (surfaceGravity(chi) * horizonArea(chi)) / (4 * Math.PI),
        1,
        1e-13,
      );
    }
  });

  it('obey the first law, dM = (κ/8π) dA + Ω dJ, by finite differences', () => {
    // A(M, J) = M² A(χ) with χ = J/M²: vary M at fixed J and J at fixed M.
    const area = (m: number, j: number) => m * m * horizonArea(j / (m * m));
    const h = 1e-6;
    for (const chi of [0.1, 0.5, 0.69, 0.9]) {
      const dAdM = (area(1 + h, chi) - area(1 - h, chi)) / (2 * h);
      const dAdJ = (area(1, chi + h) - area(1, chi - h)) / (2 * h);
      // At fixed J: 1 = (κ/8π) ∂A/∂M. At fixed M: 0 = (κ/8π) ∂A/∂J + Ω.
      close((surfaceGravity(chi) / (8 * Math.PI)) * dAdM, 1, 1e-8);
      expect(
        Math.abs((surfaceGravity(chi) / (8 * Math.PI)) * dAdJ + horizonOmega(chi)),
      ).toBeLessThan(1e-8);
    }
  });

  it('give the irreducible mass the second article stores in the spin', () => {
    for (const chi of [0, 0.5, 0.9, 1]) close(irreducibleMass(chi), 1 - extractable(chi), 1e-12);
  });

  it('have the temperature and entropy scipy gives, sixty nanokelvin and 10⁷⁷ for the Sun', () => {
    for (const ref of fx.holes) {
      const kg = ref.mass_sun * M_SUN_KG;
      close(entropy(kg), ref.entropy, 1e-9);
      close(hawkingTemperature(kg), ref.temperature, 1e-9);
    }
    close(hawkingTemperature(M_SUN_KG), 6.17e-8, 0.01);
  });

  it('cool as they grow, with a heat capacity of exactly −2S', () => {
    expect(hawkingTemperature(2 * M_SUN_KG)).toBeLessThan(hawkingTemperature(M_SUN_KG));
    close(heatCapacity(M_SUN_KG), -2 * entropy(M_SUN_KG), 1e-15);
    // C = dM/dT in units of k_B: compare with a finite difference of T(M).
    const kg = 10 * M_SUN_KG;
    const dT = hawkingTemperature(kg * (1 + 1e-6)) - hawkingTemperature(kg * (1 - 1e-6));
    const c2 = 299_792_458 ** 2;
    close((2e-6 * kg * c2) / dT / 1.380_649e-23, heatCapacity(kg), 1e-6);
  });

  it('are as hot as the sky at about the mass of the Moon', () => {
    const kg = massAtTemperature(T_CMB);
    close(hawkingTemperature(kg), T_CMB, 1e-12);
    expect(kg).toBeGreaterThan(3e22);
    expect(kg).toBeLessThan(1e23);
  });

  it('evaporate in 2 × 10⁶⁷ years for a solar mass, photons only', () => {
    const years = evaporationTime(M_SUN_KG) / JULIAN_YEAR;
    expect(years).toBeGreaterThan(2.0e67);
    expect(years).toBeLessThan(2.2e67);
    close(massEvaporatingIn(evaporationTime(1e12)), 1e12, 1e-12);
  });

  it('let two equal holes radiate at most 1 − 1/√2 of their mass, less if the remnant spins', () => {
    close(maximumRadiated(10, 10), 1 - Math.SQRT1_2, 1e-14);
    close(minimumFinalMass(10, 10), Math.sqrt(200), 1e-14);
    expect(maximumRadiated(10, 10, 0, 0, 0.69)).toBeLessThan(maximumRadiated(10, 10));
    // A final area equal to the sum: the bound is exactly saturated.
    const mf = minimumFinalMass(33.6, 32.2, 0.1, 0.2, 0.68);
    close(entropySun(mf, 0.68), entropySun(33.6, 0.1) + entropySun(32.2, 0.2), 1e-12);
  });
});

describe('waves', () => {
  it('stretch a ring one way and squeeze it the other, keeping its area to first order', () => {
    const h = 1e-4;
    const p = ringPoint(1, 0, h, 'plus', 0);
    const q = ringPoint(0, 1, h, 'plus', 0);
    close(p.x, 1 + h / 2, 1e-15);
    close(q.y, 1 - h / 2, 1e-15);
    expect(Math.abs(p.x * q.y - 1)).toBeLessThan(h * h);
  });

  it('in two polarisations 45° apart', () => {
    // Cross on a ring is plus on the same ring turned by 45°.
    const h = 0.2;
    const r = Math.SQRT1_2;
    for (const phase of [0, 1, 2.5]) {
      const cross = ringPoint(r, r, h, 'cross', phase);
      const plus = ringPoint(1, 0, h, 'plus', phase);
      close(Math.hypot(cross.x, cross.y), plus.x, 1e-12);
    }
  });

  it('carry off Peters and Mathews power, and the chirp mass is symmetric', () => {
    // Twice the separation, a 32nd of the power.
    const m = 30 * M_SUN_KG;
    close(binaryLuminosity(m, m, 2e6) / binaryLuminosity(m, m, 1e6), 1 / 32, 1e-12);
    close(chirpMass(30, 30), 30 / 2 ** 0.2, 1e-12);
    close(chirpMass(36, 29), chirpMass(29, 36), 1e-15);
  });

  it('leave the remnant LALSuite gives for two non-spinning holes', () => {
    for (const ref of fx.remnant) {
      close(finalMassFraction(ref.q), ref.final_mass, 1e-12);
      close(finalSpin(ref.q), ref.final_spin, 1e-12);
    }
  });

  it('reduce, for a tiny companion, to a test particle falling from the last stable orbit', () => {
    // Energy radiated: 1 − E_isco = 1 − √(8/9) per unit of the small mass; spin: L_isco = 2√3.
    const q = 1e-6;
    const eta = symmetricMassRatio(q);
    close(radiatedFraction(q) / eta, 1 - Math.sqrt(1 - 2 / (3 * kerrIsco(0))), 1e-5);
    close(finalSpin(q) / eta, 2 * Math.sqrt(3), 1e-4);
  });

  it('radiate far less than the area theorem allows', () => {
    for (const q of [1, 0.5, 0.1]) {
      const bound = maximumRadiated(1, q, 0, 0, finalSpin(q));
      expect(radiatedFraction(q)).toBeLessThan(bound / 3);
    }
  });

  it('carry 3.6 k_B per quantum when thermal', () => {
    close(THERMAL_ENTROPY_PER_QUANTUM, 3.6017, 1e-4);
  });
});

describe('well-posedness', () => {
  it('matches scipy’s matrix exponential, mode by mode', () => {
    for (const ref of fx.amplification) {
      close(amplification(ref.system as 'weak' | 'strong', ref.n, ref.t), ref.growth, 1e-10);
    }
  });

  it('grows like k t in the weak system and stays bounded in the strong one', () => {
    const [u1] = evolveMode('weak', 50, 2, [0, 0], [1, 0]);
    close(Math.hypot(...u1), 100, 1e-12);
    for (const n of [16, 64, 256, 1024]) {
      expect(amplification('strong', n, 7.3)).toBeLessThanOrEqual(Math.sqrt(2.5) + 1e-12);
    }
    expect(amplification('weak', 512, 5)).toBeGreaterThan(2 * amplification('weak', 128, 5));
  });
});
