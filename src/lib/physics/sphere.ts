/**
 * Straight lines and parallel arrows on a sphere (The Straightest Path). Points are unit
 * 3-vectors; an arrow at a point is a vector tangent to the sphere there. Carrying an arrow
 * along a path while keeping it as parallel as the surface allows is done one short step at
 * a time, each step turning it by the smallest rotation that takes one point to the next:
 * exact along a great circle, and converging to parallel transport along any other path.
 * Checked against Gauss–Bonnet: round a closed loop the arrow turns by the area enclosed.
 */

export type Vec3 = [number, number, number];

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

/** The point at latitude and longitude (radians). The z axis points to the north pole. */
export function fromLatLon(lat: number, lon: number): Vec3 {
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** The angle between two points as seen from the centre: their distance on the unit sphere. */
export function distance(a: Vec3, b: Vec3): number {
  return Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));
}

/** n + 1 points evenly spaced along the shorter great-circle arc from a to b. */
export function greatCircle(a: Vec3, b: Vec3, n: number): Vec3[] {
  const omega = distance(a, b);
  if (omega < 1e-12) return Array.from({ length: n + 1 }, () => a);
  const s = Math.sin(omega);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return add(scale(a, Math.sin((1 - t) * omega) / s), scale(b, Math.sin(t * omega) / s));
  });
}

/** Rotates v about the unit axis k by angle theta (Rodrigues). */
function rotate(v: Vec3, k: Vec3, theta: number): Vec3 {
  const c = Math.cos(theta);
  return add(add(scale(v, c), scale(cross(k, v), Math.sin(theta))), scale(k, dot(k, v) * (1 - c)));
}

/** The arrow v at path[0], carried along the path: one arrow per point. */
export function transport(path: Vec3[], v: Vec3): Vec3[] {
  const out: Vec3[] = [v];
  for (let i = 1; i < path.length; i++) {
    const axis = cross(path[i - 1], path[i]);
    const len = Math.hypot(...axis);
    const prev = out[i - 1];
    out.push(
      len < 1e-15 ? prev : rotate(prev, scale(axis, 1 / len), distance(path[i - 1], path[i])),
    );
  }
  return out;
}

/** The local east and north directions at a point (not at a pole). */
export function eastNorth(p: Vec3): { east: Vec3; north: Vec3 } {
  const east = unit(cross([0, 0, 1], p));
  return { east, north: cross(p, east) };
}

/** Signed angle that turns arrow a into arrow b at point p, anticlockwise seen from outside. */
export function turn(a: Vec3, b: Vec3, p: Vec3): number {
  return Math.atan2(dot(p, cross(a, b)), dot(a, b));
}

/**
 * The loop the figure draws: from the north pole down the meridian at longitude 0 to the
 * equator, east along the equator by `span`, and back up to the pole. A triangle with three
 * corners and enclosed area `span` on the unit sphere.
 */
export function poleLoop(span: number, perLeg = 90): Vec3[] {
  const pole: Vec3 = [0, 0, 1];
  const a = fromLatLon(0, 0);
  const b = fromLatLon(0, span);
  const down = greatCircle(pole, a, perLeg);
  // Along the equator in steps, since a span beyond 180° is not the shorter arc.
  const along = Array.from({ length: perLeg + 1 }, (_, i) => fromLatLon(0, (span * i) / perLeg));
  const up = greatCircle(b, pole, perLeg);
  return [...down, ...along.slice(1), ...up.slice(1)];
}
