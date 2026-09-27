import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/dsp.json';
import { irfft, rfft } from '~/lib/dsp/fft';
import { median, medianBias, welch } from '~/lib/dsp/welch';
import { hann } from '~/lib/dsp/window';

/** Element-wise |a - b| <= atol + rtol * |b|, like numpy.testing.assert_allclose. */
function expectClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  rtol = 1e-10,
  atol = 1e-14,
) {
  expect(actual.length).toBe(expected.length);
  let worst = 0;
  for (let i = 0; i < expected.length; i++) {
    const excess = Math.abs(actual[i] - expected[i]) - (atol + rtol * Math.abs(expected[i]));
    worst = Math.max(worst, excess);
  }
  expect(worst).toBeLessThanOrEqual(0);
}

describe('rfft', () => {
  it('matches numpy.fft.rfft', () => {
    const { re, im } = rfft(fixtures.rfft.input);
    expectClose(re, fixtures.rfft.re, 1e-12, 1e-12);
    expectClose(im, fixtures.rfft.im, 1e-12, 1e-12);
  });

  it('is inverted by irfft', () => {
    const x = Float64Array.from(fixtures.rfft.input);
    expectClose(irfft(rfft(x), x.length), x, 1e-12, 1e-12);
  });

  it('rejects lengths that are not powers of two', () => {
    expect(() => rfft(new Float64Array(100))).toThrow(RangeError);
  });
});

describe('hann', () => {
  it('matches scipy periodic and symmetric windows', () => {
    const n = fixtures.windows.n;
    expectClose(hann(n), fixtures.windows.hann_periodic, 1e-12, 1e-15);
    expectClose(hann(n, { periodic: false }), fixtures.windows.hann_symmetric, 1e-12, 1e-15);
  });
});

describe('welch', () => {
  const { input, sample_rate, nperseg, noverlap, freqs, psd_mean, psd_median } = fixtures.welch;

  it('matches scipy.signal.welch with mean averaging', () => {
    const result = welch(input, { sampleRate: sample_rate, nperseg, noverlap });
    expectClose(result.freqs, freqs, 0, 1e-12);
    expectClose(result.psd, psd_mean);
    expect(result.segments).toBe(Math.floor((input.length - noverlap) / (nperseg - noverlap)));
  });

  it('matches scipy.signal.welch with median averaging', () => {
    const result = welch(input, { sampleRate: sample_rate, nperseg, noverlap, average: 'median' });
    expectClose(result.psd, psd_median);
  });

  it('finds the 40 Hz line in the fixture signal', () => {
    const { freqs: f, psd } = welch(input, { sampleRate: sample_rate, nperseg });
    const peak = psd.indexOf(Math.max(...psd));
    expect(f[peak]).toBeCloseTo(40, 6);
  });

  it('rejects segments longer than the signal', () => {
    expect(() => welch(new Float64Array(64), { sampleRate: 1, nperseg: 128 })).toThrow(RangeError);
  });
});

describe('median helpers', () => {
  it('takes the middle value, or the mean of the middle two', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('matches scipy._median_bias', () => {
    expect(medianBias(1)).toBe(1);
    expect(medianBias(15)).toBeCloseTo(
      1 +
        (1 / 3 - 1 / 2) +
        (1 / 5 - 1 / 4) +
        (1 / 7 - 1 / 6) +
        (1 / 9 - 1 / 8) +
        (1 / 11 - 1 / 10) +
        (1 / 13 - 1 / 12) +
        (1 / 15 - 1 / 14),
      14,
    );
  });
});
