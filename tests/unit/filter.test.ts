import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  argmax,
  interpolatePsd,
  innerProduct,
  matchedFilter,
  optimalSnr,
  whiten,
  type Band,
} from '~/lib/dsp/filter';
import { aligoDesignPsd } from '~/lib/dsp/models';
import { gaussian, mulberry32 } from '~/lib/stats/random';

const fs = 1024;
const n = 4096;
const white: Band = { sampleRate: fs, psd: () => 2 / fs, fLow: 1 }; // unit-variance white noise

/** A sine-Gaussian burst centred at t0 seconds. */
function burst(t0: number, amplitude = 1): Float64Array {
  return Float64Array.from({ length: n }, (_, j) => {
    const t = j / fs - t0;
    return amplitude * Math.exp(-((t / 0.05) ** 2)) * Math.cos(2 * Math.PI * 60 * t);
  });
}

describe('whiten', () => {
  it('leaves unit-variance white noise at unit variance', () => {
    const draw = gaussian(mulberry32(3));
    const x = Float64Array.from({ length: n }, draw);
    const w = whiten(x, { ...white, fLow: 0.0001 });
    const variance = w.reduce((s, v) => s + v * v, 0) / n;
    expect(variance).toBeCloseTo(1, 1);
  });
});

describe('matchedFilter', () => {
  it('peaks at the lag of a buried template with about its optimal SNR', () => {
    const draw = gaussian(mulberry32(11));
    const template = burst(1.0);
    const rho = optimalSnr(template, white);
    const scale = 12 / rho; // a signal of optimal SNR 12
    const lag = 1024; // the signal arrives one second later than the template
    const signal = burst(2.0, scale);
    const data = Float64Array.from({ length: n }, (_, j) => signal[j] + draw());
    const snr = matchedFilter(data, template, white);
    const peak = argmax(snr);
    // The envelope is ~50 samples wide; noise moves its top by a few.
    expect(Math.abs(peak - lag)).toBeLessThanOrEqual(10);
    expect(snr[peak]).toBeGreaterThan(10);
    expect(snr[peak]).toBeLessThan(14);
    // Away from the signal the statistic behaves like noise.
    const far = Array.from(snr.slice(3000, 3900));
    expect(Math.max(...far)).toBeLessThan(4.5);
  });

  it('is independent of the template amplitude', () => {
    const data = burst(1.5, 3);
    const a = matchedFilter(data, burst(1.0), white);
    const b = matchedFilter(data, burst(1.0, 7), white);
    expect(Math.max(...a)).toBeCloseTo(Math.max(...b), 10);
  });

  it('matches the inner product at zero lag', () => {
    const template = burst(1.0);
    const data = burst(1.0, 2);
    const snr = matchedFilter(data, template, white);
    expect(snr[0]).toBeCloseTo(
      innerProduct(data, template, white) / optimalSnr(template, white),
      8,
    );
  });
});

describe('the toy chirp dataset', () => {
  // The pipeline injected the chirp at an optimal SNR of 20 with this PSD; our filter, run on
  // the published data with the injection as template, must find it there.
  const meta = JSON.parse(readFileSync('public/data/synthetic/toy-chirp/meta.json', 'utf8'));
  const read = (name: string) => {
    const bytes = readFileSync(`public/data/synthetic/toy-chirp/${meta.channels[name].file}`);
    const stored = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    return Float64Array.from(stored, (v) => v * meta.scale);
  };
  const band: Band = {
    sampleRate: meta.sample_rate,
    psd: (f) => aligoDesignPsd(Math.max(f, meta.injection.noise_f_low)),
    fLow: meta.injection.snr_f_low,
  };

  it('has the optimal SNR the pipeline recorded', () => {
    expect(optimalSnr(read('injection'), band)).toBeCloseTo(meta.injection.optimal_snr, 2);
  });

  it('is found at zero lag with an SNR near 20', () => {
    const snr = matchedFilter(read('strain'), read('injection'), band);
    const peak = argmax(snr);
    expect(Math.min(peak, snr.length - peak)).toBeLessThanOrEqual(2);
    expect(snr[peak]).toBeGreaterThan(17);
    expect(snr[peak]).toBeLessThan(23);
  });
});

describe('against the numpy reference (tests/fixtures/dsp.json)', () => {
  const ref = JSON.parse(readFileSync('tests/fixtures/dsp.json', 'utf8')).filter;
  const band: Band = {
    sampleRate: ref.sample_rate,
    psd: interpolatePsd(ref.freqs, ref.psd),
    fLow: ref.f_low,
    fHigh: ref.f_high,
  };
  const close = (a: ArrayLike<number>, b: number[], tol: number) => {
    expect(a.length).toBe(b.length);
    let worst = 0;
    for (let i = 0; i < b.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
    expect(worst).toBeLessThan(tol);
  };

  it('whitens like numpy', () => {
    close(whiten(ref.data, band), ref.whitened, 1e-9);
  });

  it('gives numpy optimal SNR and matched-filter SNR at every lag', () => {
    expect(optimalSnr(ref.template, band)).toBeCloseTo(ref.optimal_snr, 9);
    close(matchedFilter(ref.data, ref.template, band), ref.snr, 1e-9);
  });
});
