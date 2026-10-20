import { gaussian, mulberry32 } from './random';

/**
 * Random-walk Metropolis, the simplest Markov-chain Monte Carlo sampler: propose a step from a
 * Gaussian around the current point, and accept it with probability min(1, p(new) / p(old)).
 * Seeded, so a figure shows the same walk on every visit. Tested for the distribution it
 * samples (tests/unit/foundations.test.ts).
 */

export interface MetropolisOptions {
  /** Number of steps after the start. */
  steps: number;
  /** Standard deviation of the Gaussian proposal, per dimension. */
  stepSize: number;
  seed: number;
}

export interface Walk {
  /** Every state of the chain, the start included: steps + 1 points. */
  points: number[][];
  /** For each step, whether its proposal was accepted. */
  accepted: boolean[];
  /** For each step, the proposal made (accepted or not), so a figure can draw rejections. */
  proposals: number[][];
}

export function metropolis(
  logDensity: (x: readonly number[]) => number,
  start: readonly number[],
  { steps, stepSize, seed }: MetropolisOptions,
): Walk {
  const uniform = mulberry32(seed);
  const normal = gaussian(uniform);
  let current = [...start];
  let logP = logDensity(current);
  if (!Number.isFinite(logP)) throw new RangeError('the start has zero density');
  const points = [current];
  const accepted: boolean[] = [];
  const proposals: number[][] = [];
  for (let s = 0; s < steps; s++) {
    const proposal = current.map((v) => v + stepSize * normal());
    const logQ = logDensity(proposal);
    const accept = Math.log(uniform()) < logQ - logP;
    proposals.push(proposal);
    accepted.push(accept);
    if (accept) {
      current = proposal;
      logP = logQ;
    }
    points.push(current);
  }
  return { points, accepted, proposals };
}
