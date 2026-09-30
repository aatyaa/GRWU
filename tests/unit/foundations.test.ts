import { describe, expect, it } from 'vitest';
import fx from '../fixtures/foundations.json';
import { aliasFrequency, sampleCosine } from '~/lib/dsp/sampling';
import { hann, tukey } from '~/lib/dsp/window';
import { rfft } from '~/lib/dsp/fft';
import { dampedSinusoid, displacement, qualityFactor, ringOf } from '~/lib/physics/oscillator';
import { autocorrelation, effectiveSampleSize, integratedTime } from '~/lib/stats/autocorr';
import { pearson, ranks, spearman } from '~/lib/stats/correlation';
import { equalTailed, hdi, quantile } from '~/lib/stats/intervals';
import { metropolis } from '~/lib/stats/mcmc';

/** Element-wise |a - b| <= atol + rtol * |b|, like numpy.testing.assert_allclose. */
function expectClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  rtol = 1e-12,
  atol = 1e-14,
) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(
      atol + rtol * Math.abs(expected[i]),
    );
  }
}

describe('intervals', () => {
  const { input, probs, values, equal_tailed_90, hdi_90, gamma2_exact_hdi_90 } = fx.quantiles;

  it('matches numpy.quantile', () => {
    expectClose(
      probs.map((p) => quantile(input, p)),
      values,
    );
  });

  it('gives the equal-tailed interval numpy gives', () => {
    expectClose(equalTailed(input, 0.9), equal_tailed_90);
  });

  it('finds the same highest-density interval as a brute-force search', () => {
    expectClose(hdi(input, 0.9), hdi_90);
  });

  it('comes close to the exact HDI of the density the samples came from', () => {
    const [lo, hi] = hdi(input, 0.9);
    // 401 samples: the ends of a 90% interval are known to a few tenths.
    expect(Math.abs(lo - gamma2_exact_hdi_90[0])).toBeLessThan(0.3);
    expect(Math.abs(hi - gamma2_exact_hdi_90[1])).toBeLessThan(0.5);
  });

  it('makes the HDI shorter than the equal-tailed interval for a skewed sample', () => {
    const [a, b] = hdi(input, 0.9);
    const [c, d] = equalTailed(input, 0.9);
    expect(b - a).toBeLessThan(d - c);
  });
});

describe('correlation', () => {
  const c = fx.correlation;

  it('matches scipy.stats.pearsonr and spearmanr', () => {
    expect(pearson(c.x, c.y)).toBeCloseTo(c.pearson, 12);
    expect(spearman(c.x, c.y)).toBeCloseTo(c.spearman, 12);
  });

  it('averages tied ranks as scipy.stats.rankdata does', () => {
    expectClose(ranks(c.x_ties), c.ranks_ties);
    expect(spearman(c.x_ties, c.y_ties)).toBeCloseTo(c.spearman_ties, 12);
  });
});

describe('autocorrelation', () => {
  const a = fx.autocorrelation;

  it('matches emcee.autocorr.function_1d', () => {
    expectClose(autocorrelation(a.chain).slice(0, 20), a.acf_first_20, 1e-9, 1e-12);
  });

  it('matches emcee.autocorr.integrated_time, near the exact value for AR(1)', () => {
    const tau = integratedTime(a.chain);
    expect(tau).toBeCloseTo(a.integrated_time, 9);
    expect(Math.abs(tau - a.exact_integrated_time) / a.exact_integrated_time).toBeLessThan(0.25);
    expect(effectiveSampleSize(a.chain)).toBeCloseTo(a.chain.length / a.integrated_time, 6);
  });
});

describe('metropolis', () => {
  const logNormal = ([x]: readonly number[]) => -0.5 * x * x;

  it('samples a standard normal', () => {
    const walk = metropolis(logNormal, [3], { steps: 40000, stepSize: 2.4, seed: 7 });
    const xs = walk.points.slice(2000).map(([x]) => x);
    const n = effectiveSampleSize(xs);
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
    const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
    // Tolerances from the effective sample size, at five standard errors.
    expect(Math.abs(mean)).toBeLessThan(5 / Math.sqrt(n));
    expect(Math.abs(variance - 1)).toBeLessThan(5 * Math.sqrt(2 / n));
    expect(quantile(xs, 0.95)).toBeCloseTo(1.645, 0);
  });

  it('records every proposal and whether it was taken', () => {
    const walk = metropolis(logNormal, [0], { steps: 500, stepSize: 1, seed: 1 });
    expect(walk.points).toHaveLength(501);
    expect(walk.proposals).toHaveLength(500);
    walk.accepted.forEach((ok, i) => {
      expect(walk.points[i + 1]).toEqual(ok ? walk.proposals[i] : walk.points[i]);
    });
    const rate = walk.accepted.filter(Boolean).length / 500;
    expect(rate).toBeGreaterThan(0.5);
    expect(rate).toBeLessThan(0.9);
  });

  it('draws the same walk from the same seed', () => {
    const a = metropolis(logNormal, [0], { steps: 50, stepSize: 1, seed: 3 });
    const b = metropolis(logNormal, [0], { steps: 50, stepSize: 1, seed: 3 });
    expect(a).toEqual(b);
  });
});

describe('tukey', () => {
  it('matches scipy periodic and symmetric windows', () => {
    for (const [alpha, w] of Object.entries(fx.tukey.windows)) {
      expectClose(tukey(fx.tukey.n, Number(alpha)), w.periodic, 1e-12, 1e-15);
      expectClose(tukey(fx.tukey.n, Number(alpha), { periodic: false }), w.symmetric, 1e-12, 1e-15);
    }
  });

  it('is a Hann window at alpha = 1', () => {
    expectClose(tukey(16, 1), hann(16));
  });
});

describe('aliasing', () => {
  const { sample_rate, n, tones, apparent } = fx.aliasing;

  it('predicts where numpy finds each sampled tone', () => {
    expectClose(
      tones.map((f) => aliasFrequency(f, sample_rate)),
      apparent,
    );
  });

  it('puts the peak of a sampled tone at its alias', () => {
    for (const f of tones) {
      const { re, im } = rfft(sampleCosine(f, sample_rate, n));
      let peak = 0;
      for (let k = 1; k < re.length; k++) {
        if (Math.hypot(re[k], im[k]) > Math.hypot(re[peak], im[peak])) peak = k;
      }
      expect((peak * sample_rate) / n).toBe(aliasFrequency(f, sample_rate));
    }
  });
});

describe('oscillator', () => {
  it('follows scipy’s solution of m x″ + c x′ + k x = 0', () => {
    for (const o of Object.values(fx.oscillator)) {
      const osc = { mass: o.mass, stiffness: o.stiffness, damping: o.damping };
      expectClose(
        o.t.map((t) => displacement(osc, o.x0, o.v0, t)),
        o.x,
        1e-7,
        1e-9,
      );
    }
  });

  it('rings at √(ω₀² − γ²) with τ = 2m/c and Q = π f τ', () => {
    const ring = ringOf({ mass: 1, stiffness: 40, damping: 0.8 });
    expect(ring.tau).toBeCloseTo(2.5, 12);
    expect(ring.frequency).toBeCloseTo(Math.sqrt(40 - 0.16) / (2 * Math.PI), 12);
    expect(ring.quality).toBeCloseTo(qualityFactor(ring.frequency, ring.tau), 12);
    expect(() => ringOf({ mass: 1, stiffness: 1, damping: 3 })).toThrow(RangeError);
  });

  it('draws a damped sinusoid that falls by e in one τ', () => {
    const ring = { frequency: 250, tau: 0.004 };
    expect(dampedSinusoid(0, ring)).toBe(1);
    expect(dampedSinusoid(0.004, ring)).toBeCloseTo(Math.exp(-1), 12);
  });
});
