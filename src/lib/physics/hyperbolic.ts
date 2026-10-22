/**
 * Why correct equations can still be useless on a computer (Only Ever Forwards). Two systems
 * ∂u/∂t + A ∂u/∂x = 0 on a periodic line of length 2π, for u = (u₁, u₂):
 *
 * - weakly hyperbolic, A = [[1, 1], [0, 1]]: one speed counted twice but only one direction to
 *   carry it, the defect of the ADM form of Einstein's equations;
 * - strongly hyperbolic, A = [[1, 1], [0, −1]]: two speeds, two directions.
 *
 * A Fourier mode e^{ikx} evolves exactly as exp(−ikAt), and a grid of n points carries the
 * modes −n/2 < k ≤ n/2. Round-off puts the same tiny error in every one of them. The weak
 * system multiplies the error in mode k by about k t, so a finer grid, which carries larger k,
 * makes it worse; the strong one never multiplies it by more than a fixed amount. Checked
 * against scipy's matrix exponential through tests/fixtures/waves.json.
 */
export type Hyperbolicity = 'weak' | 'strong';

/** A complex number as [re, im]. */
export type Complex = [number, number];

const mul = ([a, b]: Complex, [c, d]: Complex): Complex => [a * c - b * d, a * d + b * c];
const add = ([a, b]: Complex, [c, d]: Complex): Complex => [a + c, b + d];
const scale = ([a, b]: Complex, s: number): Complex => [a * s, b * s];
const phase = (angle: number): Complex => [Math.cos(angle), Math.sin(angle)];
const abs2 = ([a, b]: Complex) => a * a + b * b;

/**
 * The amplitudes (u₁, u₂) of mode k after a time t, from (a, b) at t = 0.
 *
 * Weak: exp(−ikAt) = e^{−ikt} (1 − ikt N), N the nilpotent part, so u₁ = e^{−ikt}(a − ikt b).
 * Strong: eigenvectors (1, 0) at speed 1 and (1, −2) at speed −1, so
 * u₁ = (a + b/2) e^{−ikt} − (b/2) e^{ikt} and u₂ = b e^{ikt}.
 */
export function evolveMode(
  system: Hyperbolicity,
  k: number,
  t: number,
  a: Complex,
  b: Complex,
): [Complex, Complex] {
  const back = phase(-k * t);
  if (system === 'weak') {
    const drift = mul([0, -k * t], b);
    return [mul(back, add(a, drift)), mul(back, b)];
  }
  const ahead = phase(k * t);
  const first = add(mul(back, add(a, scale(b, 0.5))), mul(ahead, scale(b, -0.5)));
  return [first, mul(ahead, b)];
}

/**
 * How much an error equal in every mode a grid of n points can hold has grown after a time t:
 * the ratio of its root-mean-square size then and at the start.
 */
export function amplification(system: Hyperbolicity, n: number, t: number): number {
  let now = 0;
  let start = 0;
  const one: Complex = [1, 0];
  for (let k = -n / 2 + 1; k <= n / 2; k++) {
    const [u1, u2] = evolveMode(system, k, t, one, one);
    now += abs2(u1) + abs2(u2);
    start += 2;
  }
  return Math.sqrt(now / start);
}
