import { describe, expect, it } from 'vitest';
import fx from '../fixtures/relativity.json';
import {
  ARCSEC,
  AU,
  C,
  DAY,
  GM_EARTH,
  GM_SUN,
  MERCURY,
  R_EARTH,
  R_SUN,
  advancePerCentury,
  boost,
  deflection,
  fallFrom,
  freeFallTime,
  infallRadius,
  interval,
  orbitAdvance,
  orbitClock,
  orbitClockExact,
  perihelionAdvance,
  properTime,
  redshift,
  schwarzschildOrbit,
  schwarzschildRadius,
  shapiroDelay,
} from '~/lib/physics/relativity';
import {
  distance,
  eastNorth,
  fromLatLon,
  poleLoop,
  transport,
  turn,
  type Vec3,
} from '~/lib/physics/sphere';

describe('Schwarzschild orbits', () => {
  it('advance per orbit matches scipy for every orbit in the fixture', () => {
    for (const { p, e, shift } of fx.orbits) {
      expect(Math.abs(orbitAdvance(p, e) - shift)).toBeLessThanOrEqual(1e-6 * shift + 1e-10);
    }
  });

  it('tends to the first-order formula far out, and exceeds it close in', () => {
    // In Schwarzschild radii, 6πGM/(c² p) is 3π/p.
    expect(orbitAdvance(1e5, 0.2056) / ((3 * Math.PI) / 1e5)).toBeCloseTo(1, 4);
    expect(orbitAdvance(14, 0.2)).toBeGreaterThan(1.3 * ((3 * Math.PI) / 14));
  });

  it("traces a path that starts at perihelion and, far out, is Newton's ellipse", () => {
    const p = 1e4;
    const e = 0.5;
    const { phi, r } = schwarzschildOrbit(p, e, 1);
    expect(r[0]).toBeCloseTo(p / (1 + e), 9);
    phi.forEach((f, i) => expect(r[i] / (p / (1 + e * Math.cos(f)))).toBeCloseTo(1, 2));
    // Close in, the orbit swings out less far than the ellipse with the same p and e would.
    expect(Math.max(...schwarzschildOrbit(40, 0.5, 1).r)).toBeLessThan(40 / 0.5);
  });

  it("gives Mercury's 43 arcseconds per century", () => {
    expect(advancePerCentury(GM_SUN, MERCURY)).toBeCloseTo(42.98, 1);
    // The same number from the exact orbit equation, in units of the Sun's Schwarzschild radius.
    const p = (MERCURY.a * (1 - MERCURY.e ** 2)) / schwarzschildRadius(GM_SUN);
    expect(orbitAdvance(p, MERCURY.e)).toBeCloseTo(
      perihelionAdvance(GM_SUN, MERCURY.a, MERCURY.e),
      12,
    );
  });
});

describe('light', () => {
  it('bends by 1.75 arcseconds at the edge of the Sun, twice the Newtonian value', () => {
    expect(deflection(GM_SUN, R_SUN) / ARCSEC).toBeCloseTo(1.751, 3);
  });

  it('agrees with the exact bending from scipy in the weak field', () => {
    // With r_s = 1, GM = c²/2.
    const gm = (C * C) / 2;
    const sun = fx.deflection.find((d) => d.b > 1e5)!;
    expect(deflection(gm, sun.b)).toBeCloseTo(sun.angle, 10);
    expect(Math.abs(deflection(gm, sun.b) / sun.angle - 1)).toBeLessThan(1e-5);
    // Closer in, the weak-field formula falls short of the exact bending.
    const near = fx.deflection.find((d) => d.b === 20)!;
    expect(deflection(gm, near.b)).toBeLessThan(near.angle);
  });

  it('is delayed by about a quarter of a millisecond on a radar trip past the Sun to Venus', () => {
    const delay = shapiroDelay(GM_SUN, AU, 0.723_3 * AU, R_SUN);
    expect(delay).toBeGreaterThan(220e-6);
    expect(delay).toBeLessThan(240e-6);
  });
});

describe('clocks', () => {
  it('reproduces the GPS numbers: +45.7 μs a day from height, −7.2 from speed (Ashby 2003)', () => {
    const gps = orbitClock(GM_EARTH, 26_561.75e3, R_EARTH);
    expect(gps.height * DAY * 1e6).toBeCloseTo(45.7, 1);
    expect(gps.speed * DAY * 1e6).toBeCloseTo(-7.2, 1);
    expect(gps.net * DAY * 1e6).toBeCloseTo(38.4, 1);
  });

  it('agrees with the exact Schwarzschild rate to second order', () => {
    for (const r of [6.8e6, 2.656e7, 4.216e7, 3.844e8]) {
      const exact = orbitClockExact(GM_EARTH, r, R_EARTH);
      // Second-order terms are ~1e-18; the rest is rounding in 1 − 3GM/rc².
      expect(Math.abs(orbitClock(GM_EARTH, r, R_EARTH).net - exact)).toBeLessThan(
        1e-6 * Math.abs(exact) + 3e-16,
      );
    }
  });

  it('breaks even at one and a half Earth radii', () => {
    expect(orbitClock(GM_EARTH, 1.5 * R_EARTH, R_EARTH).net).toBeCloseTo(0, 20);
    expect(orbitClock(GM_EARTH, 6.791e6, R_EARTH).net).toBeLessThan(0);
  });

  it('gives Pound and Rebka a shift of a few parts in 10¹⁵ over 22.5 m', () => {
    expect(redshift(9.81, 22.5)).toBeCloseTo(2.46e-15, 17);
  });
});

describe('free fall', () => {
  it('matches scipy for radial infall from rest', () => {
    const { r0, gm, t, r } = fx.infall;
    t.forEach((ti, i) => expect(infallRadius(r0, gm, ti)).toBeCloseTo(r[i], 10));
    expect(infallRadius(r0, gm, freeFallTime(r0, gm) + 1)).toBe(0);
  });

  it('keeps bodies released side by side on their radial lines, so they close in', () => {
    const gm = GM_EARTH;
    const t = 600;
    const a = fallFrom(-500e3, R_EARTH + 1e6, gm, t);
    const b = fallFrom(500e3, R_EARTH + 1e6, gm, t);
    const centre = fallFrom(0, R_EARTH + 1e6, gm, t);
    expect(b.x - a.x).toBeLessThan(1000e3);
    // Exactly in step with the shrinking distance to the centre.
    const r0 = Math.hypot(500e3, R_EARTH + 1e6);
    expect((b.x - a.x) / 1000e3).toBeCloseTo(infallRadius(r0, gm, t) / r0, 12);
    expect(centre.x).toBe(0);
  });

  it('opens a vertical gap at twice the rate the horizontal one closes, for a small box', () => {
    // The tide: −GM/r³ across, +2GM/r³ along the line to the centre.
    const gm = GM_EARTH;
    const r = R_EARTH + 400e3;
    const d = 10;
    const t = 30;
    const centre = fallFrom(0, r, gm, t);
    const side = fallFrom(d, r, gm, t);
    const top = fallFrom(0, r + d, gm, t);
    const across = side.x - centre.x - d;
    const along = top.y - centre.y - d;
    const k = ((gm / r ** 3) * (t * t)) / 2;
    expect(across / (-k * d)).toBeCloseTo(1, 2);
    expect(along / (2 * k * d)).toBeCloseTo(1, 2);
  });
});

describe('special relativity', () => {
  it('keeps the interval the same for every observer', () => {
    const dx = 3;
    const cdt = 5;
    for (const beta of [-0.8, -0.3, 0, 0.45, 0.6, 0.9]) {
      const b = boost(dx, cdt, beta);
      expect(interval(b.dx, b.cdt)).toBeCloseTo(interval(dx, cdt), 12);
    }
    // At 0.6 c the two events happen at the same place, 4 years apart.
    const rest = boost(3, 5, 0.6);
    expect(rest.dx).toBeCloseTo(0, 12);
    expect(rest.cdt).toBeCloseTo(4, 12);
  });

  it('gives the twin who stays put the longest proper time', () => {
    const home = properTime([
      { x: 0, ct: 0 },
      { x: 0, ct: 10 },
    ]);
    const away = properTime([
      { x: 0, ct: 0 },
      { x: 4, ct: 5 },
      { x: 0, ct: 10 },
    ]);
    expect(home).toBe(10);
    expect(away).toBeCloseTo(6, 12);
    expect(() =>
      properTime([
        { x: 0, ct: 0 },
        { x: 6, ct: 5 },
      ]),
    ).toThrow(RangeError);
  });
});

describe('parallel transport on a sphere', () => {
  const pole: Vec3 = [0, 0, 1];

  it('turns an arrow carried round the pole triangle by the angle at the pole', () => {
    for (const span of [Math.PI / 6, Math.PI / 2, (2 * Math.PI) / 3]) {
      const loop = poleLoop(span);
      // Start pointing down the first meridian, towards longitude 0.
      const start: Vec3 = [1, 0, 0];
      const arrows = transport(loop, start);
      expect(turn(start, arrows.at(-1)!, pole)).toBeCloseTo(span, 9);
    }
  });

  it('turns it by the enclosed area round a circle of latitude (Gauss–Bonnet)', () => {
    const lat = Math.PI / 6;
    const n = 20_000;
    const circle = Array.from({ length: n + 1 }, (_, i) => fromLatLon(lat, (2 * Math.PI * i) / n));
    const start = eastNorth(circle[0]).north;
    const end = transport(circle, start).at(-1)!;
    const area = 2 * Math.PI * (1 - Math.sin(lat));
    // The arrow comes back turned by the area of the cap, modulo a full turn.
    const angle = turn(start, end, circle[0]);
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    expect(wrap(angle - area)).toBeCloseTo(0, 3);
  });

  it('brings walkers who start parallel on the equator together at the pole', () => {
    const span = 0.3;
    for (const walked of [0, 0.5, 1, Math.PI / 2]) {
      const a = fromLatLon(walked, 0);
      const b = fromLatLon(walked, span);
      // For small spans the gap shrinks as cos(walked): ξ'' = −K ξ with K = 1.
      expect(distance(a, b)).toBeCloseTo(
        Math.acos(Math.sin(walked) ** 2 + Math.cos(walked) ** 2 * Math.cos(span)),
        12,
      );
    }
    expect(distance(fromLatLon(Math.PI / 2, 0), fromLatLon(Math.PI / 2, span))).toBeCloseTo(0, 12);
  });
});
