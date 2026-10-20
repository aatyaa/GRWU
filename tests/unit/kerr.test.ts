import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/kerr.json';
import {
  blackHoleOf,
  detectorFrameMass,
  horizonArea,
  MODES,
  modeShape,
  ringOf,
  sourceFrameMass,
  type Mode,
} from '~/lib/physics/kerr';

/** Worst relative error of the Berti fits against the exact modes, spins 0 to 0.99. */
const FIT_ACCURACY: Record<Mode, { frequency: number; quality: number }> = {
  '220': { frequency: 0.02, quality: 0.01 },
  '221': { frequency: 0.02, quality: 0.02 },
  '222': { frequency: 0.02, quality: 0.03 },
};

describe('modeShape', () => {
  for (const mode of MODES) {
    it(`follows the exact ${mode} mode of the qnm package`, () => {
      const exact = fixtures.modes[mode];
      fixtures.spins.forEach((chi, i) => {
        const { mOmega, quality } = modeShape(mode, chi);
        const exactQuality = exact.omega_re[i] / (2 * exact.omega_im[i]);
        expect(Math.abs(mOmega / exact.omega_re[i] - 1)).toBeLessThan(FIT_ACCURACY[mode].frequency);
        expect(Math.abs(quality / exactQuality - 1)).toBeLessThan(FIT_ACCURACY[mode].quality);
      });
    });
  }

  it('rings higher with spin, and each overtone dies faster than the one before', () => {
    for (let i = 1; i < fixtures.spins.length; i++) {
      const chi = fixtures.spins[i];
      expect(modeShape('220', chi).mOmega).toBeGreaterThan(
        modeShape('220', fixtures.spins[i - 1]).mOmega,
      );
      const [t0, t1, t2] = MODES.map((mode) => ringOf(mode, 60, chi).tau);
      expect(t1).toBeLessThan(t0);
      expect(t2).toBeLessThan(t1);
    }
  });
});

describe('ringOf', () => {
  it('puts the remnant of GW150914 near 250 Hz and 4 ms', () => {
    // About 68 M_sun (detector frame) with spin 0.69: Abbott et al., PRL 116, 221101 (2016).
    const { f, tau } = ringOf('220', 68, 0.69);
    expect(f).toBeGreaterThan(245);
    expect(f).toBeLessThan(260);
    expect(tau).toBeGreaterThan(3.8e-3);
    expect(tau).toBeLessThan(4.3e-3);
  });

  it('scales with mass: twice the mass rings an octave lower for twice as long', () => {
    const light = ringOf('220', 30, 0.5);
    const heavy = ringOf('220', 60, 0.5);
    expect(heavy.f).toBeCloseTo(light.f / 2, 10);
    expect(heavy.tau).toBeCloseTo(light.tau * 2, 12);
  });

  it('cannot tell a redshifted source from a heavier one nearby', () => {
    const z = 0.3;
    const far = ringOf('220', 50, 0.7);
    const heavier = ringOf('220', detectorFrameMass(50, z), 0.7);
    expect(heavier.f).toBeCloseTo(far.f / (1 + z), 10);
    expect(heavier.tau).toBeCloseTo(far.tau * (1 + z), 12);
  });
});

describe('blackHoleOf', () => {
  it('inverts ringOf for every mode, mass and spin', () => {
    for (const mode of MODES) {
      for (const mass of [10, 62.5, 150]) {
        for (const chi of [0, 0.2, 0.69, 0.9, 0.99]) {
          const { f, tau } = ringOf(mode, mass, chi);
          const hole = blackHoleOf(f, tau, mode);
          expect(hole).not.toBeNull();
          expect(hole!.mass).toBeCloseTo(mass, 8);
          expect(hole!.chi).toBeCloseTo(chi, 10);
        }
      }
    }
  });

  it('refuses rings no spinning Kerr black hole makes', () => {
    // The fundamental of a non-spinning hole has Q = 0.7 + 1.4187; a lower Q needs χ < 0.
    const f = 250;
    expect(blackHoleOf(f, 2.1187 / (Math.PI * f))!.chi).toBeCloseTo(0, 12);
    expect(blackHoleOf(f, 2.0 / (Math.PI * f))).toBeNull();
    expect(blackHoleOf(0, 4e-3)).toBeNull();
    expect(blackHoleOf(Number.NaN, 4e-3)).toBeNull();
  });
});

describe('horizonArea', () => {
  it('is 16πM² without spin and 8πM² at extremal spin', () => {
    expect(horizonArea(10, 0)).toBeCloseTo(16 * Math.PI * 100, 9);
    expect(horizonArea(10, 1)).toBeCloseTo(8 * Math.PI * 100, 9);
  });

  it('shrinks as the spin grows at fixed mass', () => {
    const areas = [0, 0.3, 0.6, 0.9, 0.99].map((chi) => horizonArea(60, chi));
    for (let i = 1; i < areas.length; i++) expect(areas[i]).toBeLessThan(areas[i - 1]);
  });
});

describe('frames', () => {
  it('round-trips between source and detector frame', () => {
    expect(sourceFrameMass(detectorFrameMass(42, 0.2), 0.2)).toBeCloseTo(42, 12);
  });

  it('leaves mass ratios unchanged', () => {
    const z = 0.15;
    const ratio = sourceFrameMass(80, z) / sourceFrameMass(64, z);
    expect(ratio).toBeCloseTo(80 / 64, 12);
  });
});
