import { describe, expect, it } from 'vitest';
import fx from '../fixtures/blackholes.json';
import light from '../fixtures/relativity.json';
import {
  CRITICAL_IMPACT,
  accretionEfficiency,
  chandrasekharMass,
  collapseAt,
  collapseAtTau,
  coneSlopes,
  disruptionRadius,
  ergosurface,
  extractable,
  horizonCrossing,
  horizonTide,
  kerrHorizons,
  kerrIsco,
  kerrPhotonOrbit,
  lightRay,
  longestFall,
  tidalStretch,
  whiteDwarf,
  whiteDwarfUnits,
} from '~/lib/physics/blackhole';
import { C, GM_SUN, R_SUN } from '~/lib/physics/relativity';

const close = (a: number, b: number, rtol: number) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rtol * Math.abs(b) + 1e-14);

describe('white dwarfs', () => {
  const wd = fx.white_dwarf;

  it('use the same units as scipy', () => {
    const units = whiteDwarfUnits(wd.mu_e);
    close(units.lengthKm, wd.length_km, 1e-12);
    close(units.massSun, wd.mass_unit_sun, 1e-12);
  });

  it('match scipy for every central density in the fixture', () => {
    wd.x_central.forEach((xc, i) => {
      const star = whiteDwarf(xc, wd.mu_e);
      close(star.mass, wd.mass_sun[i], 1e-6);
      close(star.radius, wd.radius_km[i], 1e-6);
    });
  });

  it('grow heavier and smaller towards the Chandrasekhar mass, and never past it', () => {
    const limit = chandrasekharMass();
    expect(limit).toBeCloseTo(1.457, 2);
    const heavy = whiteDwarf(1e4);
    expect(heavy.mass).toBeLessThan(limit);
    expect(heavy.mass / limit).toBeGreaterThan(0.999);
    expect(whiteDwarf(3).radius).toBeLessThan(whiteDwarf(1).radius);
  });
});

describe('collapse', () => {
  const c = fx.collapse;

  it('matches scipy on both clocks before the horizon', () => {
    c.tau.forEach((tau, i) => {
      const p = collapseAtTau(tau, c.r0);
      close(p.r, c.r[i], 1e-9);
      close(p.t, c.t[i], 1e-8);
    });
  });

  it('crosses the horizon and reaches the centre at the times scipy finds', () => {
    close(horizonCrossing(c.r0), c.tau_horizon, 1e-8);
    expect(collapseAtTau(c.tau_centre + 1, c.r0).r).toBe(0);
    expect(collapseAtTau(c.tau_horizon + 1e-6, c.r0).t).toBe(Infinity);
  });

  it('takes forever on the far-away clock as the surface nears the horizon', () => {
    const eta = 2 * Math.atan(Math.sqrt(c.r0 - 1));
    expect(collapseAt(eta - 1e-3, c.r0).t).toBeGreaterThan(collapseAt(eta - 1e-2, c.r0).t + 2);
  });
});

describe('light cones', () => {
  it('are the null directions of the Eddington–Finkelstein metric', () => {
    for (const r of [0.3, 0.8, 1, 1.5, 4]) {
      for (const s of Object.values(coneSlopes(r))) {
        // −(1 − 1/r) + (2/r) s + (1 + 1/r) s² = 0 for dr/dt̃ = s.
        expect(-(1 - 1 / r) + (2 / r) * s + (1 + 1 / r) * s * s).toBeCloseTo(0, 12);
      }
    }
    expect(coneSlopes(1).outward).toBe(0);
    expect(coneSlopes(0.5).outward).toBeLessThan(0);
  });
});

describe('Kerr', () => {
  it('matches scipy for horizons, orbits, efficiency and extractable energy', () => {
    for (const k of fx.kerr) {
      const h = kerrHorizons(k.chi)!;
      close(h.outer, k.r_plus, 1e-12);
      close(h.inner, k.r_minus, 1e-9);
      close(kerrIsco(k.chi, true), k.isco_pro, 1e-9);
      close(kerrIsco(k.chi, false), k.isco_retro, 1e-9);
      close(kerrPhotonOrbit(k.chi, true), k.photon_pro, 1e-9);
      close(kerrPhotonOrbit(k.chi, false), k.photon_retro, 1e-9);
      close(accretionEfficiency(k.chi), k.efficiency_pro, 1e-9);
      close(extractable(k.chi), k.extractable, 1e-9);
    }
  });

  it('has the textbook values at maximal spin, and no horizon beyond it', () => {
    expect(kerrIsco(1)).toBeCloseTo(1, 9);
    expect(kerrIsco(1, false)).toBeCloseTo(9, 9);
    expect(accretionEfficiency(1)).toBeCloseTo(1 - 1 / Math.sqrt(3), 9);
    expect(extractable(1)).toBeCloseTo(1 - 1 / Math.SQRT2, 12);
    expect(kerrHorizons(1.01)).toBeNull();
    // The ergosphere touches the horizon at the poles and reaches 2 GM/c² at the equator.
    expect(ergosurface(0.7, 0)).toBeCloseTo(kerrHorizons(0.7)!.outer, 12);
    expect(ergosurface(0.7, Math.PI / 2)).toBe(2);
  });
});

describe('light near the hole', () => {
  it('bends by the exact amount scipy integrates', () => {
    for (const { b, angle } of light.deflection.filter((d) => d.b < 1e3)) {
      close(lightRay(b).bending, angle, 1e-6);
    }
  });

  it('is caught below the critical impact parameter, and escapes above it', () => {
    expect(lightRay(CRITICAL_IMPACT * 0.999).captured).toBe(true);
    expect(lightRay(CRITICAL_IMPACT * 1.001).captured).toBe(false);
  });
});

describe('tides', () => {
  it('are the difference of the pull across the body', () => {
    const gm = 10 * GM_SUN;
    const r = 3e5;
    const pull = (x: number) => gm / (x * x);
    close(tidalStretch(gm, r, 2), pull(r - 1) - pull(r + 1), 1e-6);
  });

  it('tear a person apart at a stellar hole and spare them at Sagittarius A*', () => {
    expect(horizonTide(10 * GM_SUN, 2)).toBeGreaterThan(1e8);
    expect(horizonTide(4.3e6 * GM_SUN, 2)).toBeLessThan(1e-2);
  });

  it('swallow a Sun-like star whole above about 10⁸ solar masses', () => {
    const rs = (m: number) => (2 * m * GM_SUN) / (C * C);
    expect(disruptionRadius(1e7 * GM_SUN, GM_SUN, R_SUN)).toBeGreaterThan(rs(1e7));
    expect(disruptionRadius(3e8 * GM_SUN, GM_SUN, R_SUN)).toBeLessThan(rs(3e8));
  });

  it('give at most minutes inside a giant hole and a fraction of a millisecond in a small one', () => {
    expect(longestFall(1e8 * GM_SUN) / 60).toBeCloseTo(25.8, 0);
    expect(longestFall(10 * GM_SUN)).toBeLessThan(2e-4);
  });
});
