import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeChannel, loadDataset, parseMeta, toPhysical } from '~/lib/data/dataset';
import { welch } from '~/lib/dsp/welch';

const folder = new URL('../../public/data/synthetic/toy-chirp/', import.meta.url);

/** Serves files from the dataset folder like fetch would, without a network. */
const localFetch = (async (input: string) => {
  const name = String(input).split('/').pop() ?? '';
  try {
    const bytes = await readFile(fileURLToPath(new URL(name, folder)));
    return new Response(bytes);
  } catch {
    return new Response(null, { status: 404 });
  }
}) as typeof fetch;

describe('the committed toy-chirp dataset', () => {
  it('loads with valid checksums and the documented layout', async () => {
    const { meta, channels } = await loadDataset('data/synthetic/toy-chirp/', {
      fetcher: localFetch,
    });
    expect(meta.id).toBe('toy-chirp');
    expect(meta.sample_rate).toBe(4096);
    expect(Object.keys(channels).sort()).toEqual(['injection', 'strain']);
    expect(channels.strain.stored.length).toBe(meta.n_samples);
  });

  it('puts the injected chirp where meta.json says it merges', async () => {
    const { meta, channels } = await loadDataset('data/synthetic/toy-chirp/', {
      fetcher: localFetch,
      channels: ['injection'],
    });
    const injection = toPhysical(channels.injection);
    let peak = 0;
    for (let i = 1; i < injection.length; i++) {
      if (Math.abs(injection[i]) > Math.abs(injection[peak])) peak = i;
    }
    const peakTime = peak / meta.sample_rate;
    // The toy chirp is cut at 250 Hz, a millisecond before coalescence, with a 4 ms taper.
    expect(peakTime).toBeGreaterThan(meta.injection!.merger_time - 0.05);
    expect(peakTime).toBeLessThan(meta.injection!.merger_time);
  });

  it('has noise at the Advanced LIGO design level (a few 1e-24 per root Hz near 200 Hz)', async () => {
    const { channels } = await loadDataset('data/synthetic/toy-chirp/', {
      fetcher: localFetch,
      channels: ['strain'],
    });
    const { freqs, psd } = welch(toPhysical(channels.strain), { sampleRate: 4096, nperseg: 4096 });
    const near200 = freqs.findIndex((f) => f >= 200);
    const asd = Math.sqrt(psd[near200]);
    expect(asd).toBeGreaterThan(2e-24);
    expect(asd).toBeLessThan(5e-24);
  });
});

describe('decodeChannel', () => {
  const meta = parseMeta({
    schema: 1,
    id: 'tiny',
    kind: 'synthetic',
    sample_rate: 4,
    duration: 1,
    gps_start: null,
    n_samples: 2,
    dtype: 'float32',
    byte_order: 'little',
    scale: 1e-21,
    channels: {
      // Deliberately not the digest of the bytes below, to exercise the checksum check.
      H1: {
        file: 'H1.f32',
        sha256: '1bc8e1c4ae5b5d3b5d8b4e8c2c1f4f06e0a2b8a0e7e0a9fb6c6a0e0e1d2c3b4a',
      },
    },
  });
  const bytes = new Float32Array([1, -2]).buffer;

  it('rejects a checksum mismatch', async () => {
    await expect(decodeChannel(bytes, meta, 'H1')).rejects.toThrow(/checksum/);
  });

  it('decodes and scales when verification is off', async () => {
    const channel = await decodeChannel(bytes, meta, 'H1', { verify: false });
    expect(Array.from(toPhysical(channel))).toEqual([1e-21, -2e-21]);
  });

  it('rejects a file of the wrong size', async () => {
    await expect(decodeChannel(new ArrayBuffer(4), meta, 'H1', { verify: false })).rejects.toThrow(
      /expected 8 bytes/,
    );
  });

  it('rejects unknown schemas', () => {
    expect(() => parseMeta({ schema: 2 })).toThrow(/schema/);
  });
});
