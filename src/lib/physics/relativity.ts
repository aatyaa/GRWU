/**
 * Gravity as geometry, for The Straightest Path: Schwarzschild orbits and their creeping
 * perihelion, the bending and delay of light, the rates of clocks in orbit, free fall and the
 * tide it leaves, and the interval and proper time of special relativity.
 *
 * Orbits, infall and light bending are checked against scipy (tests/fixtures/relativity.json);
 * the clock rates against Ashby's numbers for GPS, and the solar-system values against the
 * published ones (43″ per century, 1.75″ at the Sun's edge).
 */

/** Speed of light, m/s (exact). */
export const C = 299_792_458;
/** GM of the Sun and the Earth, m³/s² (IAU 2015 nominal values). */
export const GM_SUN = 1.327_124_4e20;
export const GM_EARTH = 3.986_004e14;
/** Radii, m: the Earth's equatorial and the Sun's photospheric (IAU 2015 nominal). */
export const R_EARTH = 6.378_1e6;
export const R_SUN = 6.957e8;
export const AU = 1.495_978_707e11;
export const DAY = 86_400;
export const JULIAN_YEAR = 365.25 * DAY;
/** One arcsecond in radians. */
export const ARCSEC = Math.PI / 648_000;

/** Mercury's orbit: semi-major axis, eccentricity and sidereal period. */
export const MERCURY = { a: 0.387_098 * AU, e: 0.205_63, period: 87.969_1 * DAY };

/** The radius 2GM/c² at which a mass of this GM would be a black hole, m. */
export function schwarzschildRadius(gm: number): number {
  return (2 * gm) / (C * C);
}

/** Perihelion advance per orbit to first order, 6πGM / (c² a (1 − e²)), in radians. */
export function perihelionAdvance(gm: number, a: number, e: number): number {
  return (6 * Math.PI * gm) / (C * C * a * (1 - e * e));
}

/** Perihelion advance in arcseconds per Julian century, for an orbit with this period. */
export function advancePerCentury(
  gm: number,
  { a, e, period }: { a: number; e: number; period: number },
): number {
  return (perihelionAdvance(gm, a, e) * (100 * JULIAN_YEAR)) / period / ARCSEC;
}

/**
 * The orbit equation of a Schwarzschild geodesic in u = r_s / r, with the angle φ as clock:
 * u'' + u = 1/p + (3/2) u². The last term is all that relativity adds to Newton's ellipse.
 * p is the semi-latus rectum in Schwarzschild radii, and the orbit starts at perihelion,
 * u = (1 + e)/p, moving neither in nor out.
 */
function orbitRhs(p: number, u: number): number {
  return 1 / p + 1.5 * u * u - u;
}

/** One fourth-order Runge–Kutta step of (u, u') through dφ = h. */
function rk4(p: number, u: number, v: number, h: number): [number, number] {
  const k1u = v;
  const k1v = orbitRhs(p, u);
  const k2u = v + (h / 2) * k1v;
  const k2v = orbitRhs(p, u + (h / 2) * k1u);
  const k3u = v + (h / 2) * k2v;
  const k3v = orbitRhs(p, u + (h / 2) * k2u);
  const k4u = v + h * k3v;
  const k4v = orbitRhs(p, u + h * k3u);
  return [
    u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u),
    v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  ];
}

export interface OrbitPath {
  /** Angle swept, radians. */
  phi: Float64Array;
  /** Distance from the centre, in Schwarzschild radii. */
  r: Float64Array;
}

/** A Schwarzschild orbit traced through `turns` revolutions of the angle. */
export function schwarzschildOrbit(
  p: number,
  e: number,
  turns: number,
  stepsPerTurn = 720,
): OrbitPath {
  const n = Math.max(1, Math.round(turns * stepsPerTurn));
  const h = (2 * Math.PI * turns) / n;
  const phi = new Float64Array(n + 1);
  const r = new Float64Array(n + 1);
  let u = (1 + e) / p;
  let v = 0;
  r[0] = 1 / u;
  for (let i = 1; i <= n; i++) {
    [u, v] = rk4(p, u, v, h);
    phi[i] = i * h;
    r[i] = 1 / u;
  }
  return { phi, r };
}

/**
 * The exact advance of the perihelion per orbit, in radians: the orbit equation is stepped
 * until u' next turns from rising to falling, and the crossing is placed by cubic Hermite
 * interpolation of u', whose slope u'' the equation gives.
 */
export function orbitAdvance(p: number, e: number, stepsPerTurn = 4000): number {
  const h = (2 * Math.PI) / stepsPerTurn;
  let u = (1 + e) / p;
  let v = 0;
  for (let i = 1; i <= 3 * stepsPerTurn; i++) {
    const [u1, v1] = rk4(p, u, v, h);
    if (i * h > 1 && v > 0 && v1 <= 0) {
      const a0 = orbitRhs(p, u) * h;
      const a1 = orbitRhs(p, u1) * h;
      const at = (s: number) => {
        const s2 = s * s;
        const s3 = s2 * s;
        return (
          (2 * s3 - 3 * s2 + 1) * v +
          (s3 - 2 * s2 + s) * a0 +
          (-2 * s3 + 3 * s2) * v1 +
          (s3 - s2) * a1
        );
      };
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (at(mid) > 0) lo = mid;
        else hi = mid;
      }
      return (i - 1 + (lo + hi) / 2) * h - 2 * Math.PI;
    }
    u = u1;
    v = v1;
  }
  throw new RangeError('the orbit does not return to perihelion: it plunges');
}

/** Bending of a light ray passing at impact parameter b, in the weak field: 4GM / (c² b). */
export function deflection(gm: number, b: number): number {
  return (4 * gm) / (C * C * b);
}

/**
 * Extra round-trip time of a radar pulse sent from r1 past a mass to r2 and back, its path
 * passing at b ≪ r1, r2 (Shapiro): (4GM / c³) ln(4 r1 r2 / b²), in seconds.
 */
export function shapiroDelay(gm: number, r1: number, r2: number, b: number): number {
  return ((4 * gm) / C ** 3) * Math.log((4 * r1 * r2) / (b * b));
}

/** Fractional frequency shift between two heights h apart near a surface of gravity g: gh/c². */
export function redshift(g: number, h: number): number {
  return (g * h) / (C * C);
}

export interface ClockRate {
  /** Gained by sitting higher in the well than the reference clock. */
  height: number;
  /** Lost by moving at orbital speed. */
  speed: number;
  /** The two together: positive means the orbiting clock runs fast. */
  net: number;
}

/**
 * How fast a clock in a circular orbit of radius r runs against one at rest at radius R, as
 * fractions (multiply by 86 400 s for seconds a day). Weak field, to first order in GM/rc²:
 * height GM/c² (1/R − 1/r), speed −v²/2c² with v² = GM/r. The reference clock's own motion
 * with the Earth's spin is left out.
 */
export function orbitClock(gm: number, r: number, R: number): ClockRate {
  const height = (gm / (C * C)) * (1 / R - 1 / r);
  const speed = -gm / (2 * r * C * C);
  return { height, speed, net: height + speed };
}

/** The same rate without the approximation: √(1 − 3GM/rc²) / √(1 − 2GM/Rc²) − 1. */
export function orbitClockExact(gm: number, r: number, R: number): number {
  const k = gm / (C * C);
  return Math.sqrt(1 - (3 * k) / r) / Math.sqrt(1 - (2 * k) / R) - 1;
}

/** Time for a body released from rest at r0 to fall to the centre of a point mass. */
export function freeFallTime(r0: number, gm: number): number {
  return (Math.PI / 2) * Math.sqrt((r0 * r0 * r0) / (2 * gm));
}

/**
 * Distance from the centre at time t of a body released from rest at r0 (Newtonian radial
 * infall). In closed form along the cycloid r = r0 cos²ψ, t = √(r0³/2GM) (ψ + sin ψ cos ψ),
 * solved for ψ by bisection.
 */
export function infallRadius(r0: number, gm: number, t: number): number {
  if (t <= 0) return r0;
  const scale = Math.sqrt((r0 * r0 * r0) / (2 * gm));
  const target = t / scale;
  if (target >= Math.PI / 2) return 0;
  let lo = 0;
  let hi = Math.PI / 2;
  for (let k = 0; k < 64; k++) {
    const mid = (lo + hi) / 2;
    if (mid + Math.sin(mid) * Math.cos(mid) < target) lo = mid;
    else hi = mid;
  }
  const c = Math.cos((lo + hi) / 2);
  return r0 * c * c;
}

/** Where a body released from rest at (x, y), relative to a point mass at the origin, is at t. */
export function fallFrom(x: number, y: number, gm: number, t: number): { x: number; y: number } {
  const r0 = Math.hypot(x, y);
  const k = infallRadius(r0, gm, t) / r0;
  return { x: x * k, y: y * k };
}

/** Coordinates of a separation (Δx, cΔt) seen by an observer moving at speed βc along x. */
export function boost(dx: number, cdt: number, beta: number): { dx: number; cdt: number } {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return { dx: gamma * (dx - beta * cdt), cdt: gamma * (cdt - beta * dx) };
}

/** The interval ds² = −c²Δt² + Δx², which every observer computes alike. */
export function interval(dx: number, cdt: number): number {
  return dx * dx - cdt * cdt;
}

/**
 * Proper time along a worldline of straight pieces through (x, ct) points, in the units of
 * ct: the time a clock carried along it reads. Every piece must be slower than light.
 */
export function properTime(points: { x: number; ct: number }[]): number {
  let tau = 0;
  for (let i = 1; i < points.length; i++) {
    const dct = points[i].ct - points[i - 1].ct;
    const dx = points[i].x - points[i - 1].x;
    if (Math.abs(dx) > dct) throw new RangeError('a piece of the worldline is faster than light');
    tau += Math.sqrt(dct * dct - dx * dx);
  }
  return tau;
}
