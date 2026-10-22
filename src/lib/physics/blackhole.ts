/**
 * Black holes, for Mass, Spin and Nothing Else: what holds a dead star up and when nothing can
 * (Chandrasekhar's white dwarfs), what a collapse looks like on two clocks (Oppenheimer and
 * Snyder), the light cones that tip at the horizon, the radii of a spinning hole (Kerr), the
 * light it captures, and the tides near it.
 *
 * White dwarfs, the collapse and the Kerr orbits are checked against scipy through
 * tests/fixtures/blackholes.json; the bending of light against the exact quadrature in
 * tests/fixtures/relativity.json.
 */
import { C, GM_SUN } from './relativity';

/** CODATA 2022, as scipy.constants gives them (h and c exact). */
const H = 6.626_070_15e-34;
const HBAR = H / (2 * Math.PI);
const M_E = 9.109_383_713_9e-31;
const M_U = 1.660_539_068_92e-27;
const G = 6.674_3e-11;
/** The Sun's mass in kg, from its GM. */
export const M_SUN_KG = GM_SUN / G;

// ---------------------------------------------------------------------------------------------
// White dwarfs
// ---------------------------------------------------------------------------------------------

/**
 * The length (km) and mass (solar masses) that make Chandrasekhar's equations dimensionless.
 * With x the electrons' Fermi momentum in m_e c and y = x², a cold degenerate star obeys
 * dy/dξ = −μ √(1 + y) / ξ² and dμ/dξ = ξ² y^(3/2), with r = L ξ and m = M μ.
 */
export function whiteDwarfUnits(muE = 2): { lengthKm: number; massSun: number } {
  const lambda = HBAR / (M_E * C);
  const k = (Math.PI * M_E ** 4 * C ** 5) / (3 * H ** 3);
  const a = (G * muE * M_U) / (12 * Math.PI ** 2 * lambda ** 3 * k);
  const b = (4 * muE * M_U) / (3 * Math.PI * lambda ** 3);
  const length = 1 / Math.sqrt(a * b);
  return { lengthKm: length / 1e3, massSun: (b * length ** 3) / M_SUN_KG };
}

export interface WhiteDwarf {
  /** Solar masses. */
  mass: number;
  /** Kilometres. */
  radius: number;
}

/**
 * The white dwarf whose centre has Fermi momentum xc (in m_e c): the denser the centre, the
 * heavier and smaller the star. Fourth-order Runge–Kutta from the centre outwards, with the
 * surface (y = 0) placed by interpolation within the last step.
 */
export function whiteDwarf(xc: number, muE = 2): WhiteDwarf {
  const yc = xc * xc;
  const rhs = (xi: number, y: number, mu: number): [number, number] => {
    const yy = Math.max(y, 0);
    return [(-mu * Math.sqrt(1 + yy)) / (xi * xi), xi * xi * yy ** 1.5];
  };
  // Steps scale with the star: ξ ~ xc^(−1/2) for light stars and ~ 1/xc for heavy ones.
  const h = 1 / Math.sqrt(xc * xc + xc) / 400;
  let xi = 1e-6;
  let y = yc - (yc ** 1.5 * Math.sqrt(1 + yc) * xi * xi) / 6;
  let mu = (yc ** 1.5 * xi ** 3) / 3;
  for (let i = 0; i < 1_000_000; i++) {
    const [k1y, k1m] = rhs(xi, y, mu);
    const [k2y, k2m] = rhs(xi + h / 2, y + (h / 2) * k1y, mu + (h / 2) * k1m);
    const [k3y, k3m] = rhs(xi + h / 2, y + (h / 2) * k2y, mu + (h / 2) * k2m);
    const [k4y, k4m] = rhs(xi + h, y + h * k3y, mu + h * k3m);
    const y1 = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    const mu1 = mu + (h / 6) * (k1m + 2 * k2m + 2 * k3m + k4m);
    if (y1 <= 0) {
      // y falls linearly to zero at the surface: place the root with a cubic Hermite step.
      const d0 = k1y * h;
      const d1 = rhs(xi + h, 0, mu1)[0] * h;
      const at = (s: number) =>
        (2 * s ** 3 - 3 * s ** 2 + 1) * y +
        (s ** 3 - 2 * s ** 2 + s) * d0 +
        (-2 * s ** 3 + 3 * s ** 2) * y1 +
        (s ** 3 - s ** 2) * d1;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (at(mid) > 0) lo = mid;
        else hi = mid;
      }
      const s = (lo + hi) / 2;
      const units = whiteDwarfUnits(muE);
      return {
        mass: (mu + s * (mu1 - mu)) * units.massSun,
        radius: (xi + s * h) * units.lengthKm,
      };
    }
    xi += h;
    y = y1;
    mu = mu1;
  }
  throw new RangeError('the white dwarf has no surface');
}

/**
 * The Chandrasekhar mass: the limit of the white dwarfs as the centre grows infinitely dense,
 * (√(3π)/2) ω₃ (ħc/G)^(3/2) / (μ_e m_u)², with ω₃ = 2.01824 from the n = 3 polytrope.
 */
export function chandrasekharMass(muE = 2): number {
  const omega3 = 2.018_236;
  return (
    ((Math.sqrt(3 * Math.PI) / 2) * omega3 * ((HBAR * C) / G) ** 1.5) / (muE * M_U) ** 2 / M_SUN_KG
  );
}

// ---------------------------------------------------------------------------------------------
// Collapse: the surface of a pressureless star (Oppenheimer and Snyder, 1939). r_s = 1, c = 1.
// ---------------------------------------------------------------------------------------------

export interface CollapsePoint {
  /** Radius of the surface, in Schwarzschild radii. */
  r: number;
  /** Time on a clock riding the surface. */
  tau: number;
  /** Time on a clock far away: infinite once the surface reaches the horizon. */
  t: number;
}

/**
 * The surface released from rest at R0, at cycloid angle η: r = (R0/2)(1 + cos η),
 * τ = (R0/2)√R0 (η + sin η), and the far-away time from MTW eq. 31.10.
 */
export function collapseAt(eta: number, r0: number): CollapsePoint {
  const r = (r0 / 2) * (1 + Math.cos(eta));
  const tau = (r0 / 2) * Math.sqrt(r0) * (eta + Math.sin(eta));
  const q = Math.sqrt(r0 - 1);
  const tan = Math.tan(eta / 2);
  const t =
    tan >= q
      ? Infinity
      : Math.log((q + tan) / (q - tan)) + q * (eta + (r0 / 2) * (eta + Math.sin(eta)));
  return { r, tau, t };
}

/** The same surface at time τ on its own clock (the cycloid angle found by bisection). */
export function collapseAtTau(tau: number, r0: number): CollapsePoint {
  const total = (Math.PI / 2) * r0 ** 1.5;
  if (tau >= total) return { r: 0, tau: total, t: Infinity };
  let lo = 0;
  let hi = Math.PI;
  for (let k = 0; k < 64; k++) {
    const mid = (lo + hi) / 2;
    if ((r0 / 2) * Math.sqrt(r0) * (mid + Math.sin(mid)) < tau) lo = mid;
    else hi = mid;
  }
  return collapseAt((lo + hi) / 2, r0);
}

/** Time on the surface's own clock when it crosses the horizon. */
export function horizonCrossing(r0: number): number {
  return collapseAt(2 * Math.atan(Math.sqrt(r0 - 1)), r0).tau;
}

// ---------------------------------------------------------------------------------------------
// Light cones in ingoing Eddington–Finkelstein coordinates. r_s = 1, c = 1.
// ---------------------------------------------------------------------------------------------

/**
 * The two radial light rays through radius r, as dr/dt̃ in ingoing Eddington–Finkelstein
 * coordinates, where ds² = −(1 − 1/r) dt̃² + (2/r) dt̃ dr + (1 + 1/r) dr². Inward light always
 * moves at −1; outward light at (1 − 1/r)/(1 + 1/r): out above the horizon, standing still on
 * it, and in below it.
 */
export function coneSlopes(r: number): { inward: number; outward: number } {
  return { inward: -1, outward: (1 - 1 / r) / (1 + 1 / r) };
}

// ---------------------------------------------------------------------------------------------
// Kerr, with GM/c² = 1 and spin χ = cJ/GM² in [0, 1].
// ---------------------------------------------------------------------------------------------

/** The outer and inner horizons, r = 1 ± √(1 − χ²); none at all past χ = 1. */
export function kerrHorizons(chi: number): { outer: number; inner: number } | null {
  if (chi > 1) return null;
  const s = Math.sqrt(1 - chi * chi);
  return { outer: 1 + s, inner: 1 - s };
}

/** The static limit, the ergosphere's outer edge, at polar angle θ: 1 + √(1 − χ² cos²θ). */
export function ergosurface(chi: number, theta: number): number {
  return 1 + Math.sqrt(1 - chi * chi * Math.cos(theta) ** 2);
}

/** Innermost stable circular orbit in the equatorial plane (Bardeen, Press and Teukolsky). */
export function kerrIsco(chi: number, prograde = true): number {
  const z1 = 1 + Math.cbrt(1 - chi * chi) * (Math.cbrt(1 + chi) + Math.cbrt(1 - chi));
  const z2 = Math.sqrt(3 * chi * chi + z1 * z1);
  return 3 + z2 + (prograde ? -1 : 1) * Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
}

/** The circular photon orbit in the equatorial plane: 2 {1 + cos[(2/3) arccos(∓χ)]}. */
export function kerrPhotonOrbit(chi: number, prograde = true): number {
  return 2 * (1 + Math.cos((2 / 3) * Math.acos(prograde ? -chi : chi)));
}

/**
 * The fraction of rest mass radiated by matter spiralling down to the innermost stable orbit:
 * 1 − E, with E = √(1 − 2/(3 r)) at the ISCO. 5.7 % without spin, 42 % at χ = 1.
 */
export function accretionEfficiency(chi: number, prograde = true): number {
  return 1 - Math.sqrt(1 - 2 / (3 * kerrIsco(chi, prograde)));
}

/** The share of the mass that is rotational energy, 1 − M_irr/M, with M_irr = √(r₊/2). */
export function extractable(chi: number): number {
  const h = kerrHorizons(chi);
  return h ? 1 - Math.sqrt(h.outer / 2) : NaN;
}

// ---------------------------------------------------------------------------------------------
// Light near a non-rotating hole. r_s = 1.
// ---------------------------------------------------------------------------------------------

/** Rays with impact parameter below (3√3/2) r_s spiral into the photon sphere and are caught. */
export const CRITICAL_IMPACT = (3 * Math.sqrt(3)) / 2;

export interface Ray {
  /** Points along the ray, in Schwarzschild radii, the hole at the origin. */
  points: { x: number; y: number }[];
  captured: boolean;
  /** Total bending of an escaping ray, radians. */
  bending: number;
}

/**
 * A light ray arriving from far off to the right, travelling left at height b above the axis
 * through the hole: the orbit equation
 * u'' + u = (3/2) u², with u = r_s/r, stepped in angle from u = 0 with u' = 1/b. The ray is
 * caught once it passes inside the horizon, and has escaped once u returns to zero.
 * Points closer than `far` are kept for drawing.
 */
export function lightRay(b: number, far = 12, stepsPerRadian = 2000): Ray {
  const h = 1 / stepsPerRadian;
  const f = (u: number) => 1.5 * u * u - u;
  let phi = 0;
  let u = 0;
  let v = 1 / b;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 40 * stepsPerRadian; i++) {
    const k1u = v;
    const k1v = f(u);
    const k2u = v + (h / 2) * k1v;
    const k2v = f(u + (h / 2) * k1u);
    const k3u = v + (h / 2) * k2v;
    const k3v = f(u + (h / 2) * k2u);
    const k4u = v + h * k3v;
    const k4v = f(u + h * k3u);
    const u1 = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    const v1 = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    if (u1 <= 0 && i > 0) {
      // Back at infinity: place the crossing linearly within the step.
      const s = u / (u - u1);
      return { points, captured: false, bending: phi + s * h - Math.PI };
    }
    phi += h;
    u = u1;
    v = v1;
    if (u > 1) return { points, captured: true, bending: NaN };
    if (u > 1 / far && i % 8 === 0) points.push({ x: Math.cos(phi) / u, y: Math.sin(phi) / u });
  }
  return { points, captured: true, bending: NaN };
}

// ---------------------------------------------------------------------------------------------
// Tides and falling in.
// ---------------------------------------------------------------------------------------------

/** Difference in pull across a body of length L pointing at the hole, at radius r: 2GM L / r³. */
export function tidalStretch(gm: number, r: number, length: number): number {
  return (2 * gm * length) / r ** 3;
}

/** The same at the horizon: L c⁶ / (4 G² M²). Bigger holes are gentler. */
export function horizonTide(gm: number, length: number): number {
  return tidalStretch(gm, (2 * gm) / (C * C), length);
}

/** Where a star of radius R and gravity GM* is torn apart by a hole of GM: R (M / M*)^(1/3). */
export function disruptionRadius(gmHole: number, gmStar: number, radiusStar: number): number {
  return radiusStar * Math.cbrt(gmHole / gmStar);
}

/** The longest anyone can spend between the horizon and the centre: π GM / c³, in seconds. */
export function longestFall(gm: number): number {
  return (Math.PI * gm) / C ** 3;
}
