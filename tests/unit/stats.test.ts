import { describe, expect, it } from 'vitest';
import {
  diceTotals,
  fitLine,
  fitLinear,
  mean,
  median,
  midrange,
  normalPdf,
  sumOfSquares,
} from '~/lib/stats/estimators';
import { gaussian, mulberry32 } from '~/lib/stats/random';

describe('seeded randomness', () => {
  it('repeats exactly for the same seed', () => {
    const a = mulberry32(1801);
    const b = mulberry32(1801);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives standard normal deviates', () => {
    const draw = gaussian(mulberry32(7));
    const sample = Array.from({ length: 20000 }, draw);
    const m = mean(sample);
    const variance = mean(sample.map((x) => (x - m) ** 2));
    expect(Math.abs(m)).toBeLessThan(0.03);
    expect(Math.abs(variance - 1)).toBeLessThan(0.03);
  });
});

describe('estimators', () => {
  // The deck's sample: seven clustered values and one outlier.
  const sample = [-0.4, -0.25, -0.1, -0.05, -0.05, 0.1, 0.25, 3.7];

  it('are three different answers from one sample', () => {
    expect(mean(sample)).toBeCloseTo(0.4, 10);
    expect(median(sample)).toBeCloseTo(-0.05, 10);
    expect(midrange(sample)).toBeCloseTo(1.65, 10);
  });

  it('each minimises its own cost', () => {
    const cost = (p: number, c: number) => sample.reduce((s, v) => s + Math.abs(v - c) ** p, 0);
    const worst = (c: number) => Math.max(...sample.map((v) => Math.abs(v - c)));
    for (const d of [-0.01, 0.01]) {
      expect(cost(2, mean(sample) + d)).toBeGreaterThan(cost(2, mean(sample)));
      expect(cost(1, median(sample) + d)).toBeGreaterThanOrEqual(cost(1, median(sample)));
      expect(worst(midrange(sample) + d)).toBeGreaterThan(worst(midrange(sample)));
    }
  });
});

describe('fitLine', () => {
  it('recovers an exact line and minimises the squared miss', () => {
    const xs = [0, 1, 2, 3, 4];
    expect(
      fitLine(
        xs,
        xs.map((x) => 2 * x + 1),
      ),
    ).toEqual({ slope: 2, intercept: 1 });
    const ys = [1.2, 2.9, 5.1, 7.2, 8.8];
    const best = fitLine(xs, ys);
    const at = sumOfSquares(xs, ys, best);
    expect(sumOfSquares(xs, ys, { ...best, slope: best.slope + 0.01 })).toBeGreaterThan(at);
    expect(sumOfSquares(xs, ys, { ...best, intercept: best.intercept - 0.01 })).toBeGreaterThan(at);
  });
});

describe('normalPdf', () => {
  it('peaks at 1/sqrt(2 pi) and integrates to one', () => {
    expect(normalPdf(0)).toBeCloseTo(0.3989422804, 9);
    let area = 0;
    for (let x = -8; x <= 8; x += 0.001) area += normalPdf(x, 0, 1) * 0.001;
    expect(area).toBeCloseTo(1, 4);
  });
});

describe('diceTotals', () => {
  it('is flat for one die and a triangle for two', () => {
    expect(diceTotals(1).probabilities).toEqual(Array(6).fill(1 / 6));
    const two = diceTotals(2);
    expect(two.totals[0]).toBe(2);
    expect(two.probabilities[5]).toBeCloseTo(6 / 36, 12);
    expect(two.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});

describe('fitLinear', () => {
  it('recovers the coefficients of a line plus a wave', () => {
    const xs = Array.from({ length: 50 }, (_, i) => i / 5);
    const basis = [() => 1, (x: number) => x, (x: number) => Math.sin(2 * x)];
    const ys = xs.map((x) => 0.5 + 0.3 * x - 0.8 * Math.sin(2 * x));
    const theta = fitLinear(basis, xs, ys);
    expect(theta[0]).toBeCloseTo(0.5, 10);
    expect(theta[1]).toBeCloseTo(0.3, 10);
    expect(theta[2]).toBeCloseTo(-0.8, 10);
  });

  it('agrees with fitLine for a straight line', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [1.2, 2.9, 5.1, 7.2, 8.8];
    const [intercept, slope] = fitLinear([() => 1, (x) => x], xs, ys);
    const line = fitLine(xs, ys);
    expect(slope).toBeCloseTo(line.slope, 10);
    expect(intercept).toBeCloseTo(line.intercept, 10);
  });
});
