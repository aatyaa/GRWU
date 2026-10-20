import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chirpMassOf, newtonianChirp } from '~/lib/dsp/chirp';
import { optimalSnr, type Band } from '~/lib/dsp/filter';
import { aligoDesignPsd } from '~/lib/dsp/models';

describe('newtonianChirp', () => {
  // The toy-chirp injection was made by the pipeline's numpy newtonian_chirp and scaled to an
  // optimal SNR of 20; the port, scaled the same way, must reproduce it sample for sample.
  const meta = JSON.parse(readFileSync('public/data/synthetic/toy-chirp/meta.json', 'utf8'));
  const inj = meta.injection;
  const bytes = readFileSync('public/data/synthetic/toy-chirp/injection.f32');
  const stored = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const injection = Float64Array.from(stored, (v) => v * meta.scale);
  const band: Band = {
    sampleRate: meta.sample_rate,
    psd: (f) => aligoDesignPsd(Math.max(f, inj.noise_f_low)),
    fLow: inj.snr_f_low,
  };

  it('reproduces the pipeline injection', () => {
    const h = newtonianChirp({
      sampleRate: meta.sample_rate,
      n: meta.n_samples,
      mergerTime: inj.merger_time,
      chirpMass: inj.chirp_mass,
      fStart: inj.f_start,
      fEnd: inj.f_end,
    });
    const scale = inj.snr / optimalSnr(h, band);
    let peak = 0;
    let worst = 0;
    for (let i = 0; i < h.length; i++) {
      peak = Math.max(peak, Math.abs(injection[i]));
      worst = Math.max(worst, Math.abs(h[i] * scale - injection[i]));
    }
    // float32 storage limits agreement to about one part in 10⁷ of the peak.
    expect(worst / peak).toBeLessThan(1e-5);
  });

  it('computes the chirp mass of equal masses', () => {
    expect(chirpMassOf(30, 30)).toBeCloseTo(30 / 2 ** (1 / 5), 10);
  });
});
