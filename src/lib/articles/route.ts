/**
 * Build-time data for "From Strain to Source": the two LIGO detectors' noise around
 * GW150914 against the design curve, the event in both detectors for the reader to line
 * up, and the matched-filter score across chirp masses for the posterior. Node only.
 */
import { readDataset } from '~/lib/data/build';
import { newtonianChirp } from '~/lib/dsp/chirp';
import { interpolatePsd, matchedFilter, whiten, type Band } from '~/lib/dsp/filter';
import { aligoDesignPsd } from '~/lib/dsp/models';
import { welch } from '~/lib/dsp/welch';
import { logBins } from './hidden';

const round = (v: number, digits = 4) => Number(v.toPrecision(digits));

function event() {
  const data = readDataset('events/GW150914');
  const fs = data.meta.sample_rate;
  const at = (data.meta.gps_event as number) - (data.meta.gps_start as number);
  const channel = (name: string) => {
    const x = data.channel(name);
    const { freqs, psd } = welch(x, { sampleRate: fs, nperseg: 4 * fs, average: 'median' });
    return { x, freqs, psd };
  };
  return { fs, at, h1: channel('H1'), l1: channel('L1') };
}

export interface NoiseBudget {
  h1: { f: number[]; v: number[] };
  l1: { f: number[]; v: number[] };
  design: { f: number[]; v: number[] };
}

let budgetCache: NoiseBudget | undefined;

/** Amplitude spectral densities of both detectors in September 2015, and the design goal. */
export function noiseBudget(): NoiseBudget {
  if (budgetCache) return budgetCache;
  const { h1, l1 } = event();
  const f: number[] = [];
  const v: number[] = [];
  for (let k = 0; k <= 200; k++) {
    const fk = 10 * (1500 / 10) ** (k / 200);
    f.push(round(fk, 5));
    v.push(round(Math.sqrt(aligoDesignPsd(fk))));
  }
  budgetCache = {
    h1: logBins(h1.freqs, h1.psd, Math.sqrt, 10),
    l1: logBins(l1.freqs, l1.psd, Math.sqrt, 10),
    design: { f, v },
  };
  return budgetCache;
}

export interface NetworkData {
  sampleRate: number;
  /** Hanford, whitened and limited to 35–350 Hz, over the window. */
  h1: number[];
  /** Livingston, the same, over the window plus `margin` samples on each side. */
  l1: number[];
  margin: number;
  /** Seconds of the window's first sample relative to the event. */
  t0: number;
}

let networkCache: NetworkData | undefined;

/** GW150914 in both detectors, whitened and band-limited, for the reader to line up. */
export function network(): NetworkData {
  if (networkCache) return networkCache;
  const { fs, at, h1, l1 } = event();
  const bandOf = (c: typeof h1): Band => ({
    sampleRate: fs,
    psd: interpolatePsd(c.freqs, c.psd),
    fLow: 35,
    fHigh: 350,
  });
  const wh = whiten(h1.x, bandOf(h1));
  const wl = whiten(l1.x, bandOf(l1));
  const margin = Math.round(0.012 * fs);
  const from = Math.round((at - 0.16) * fs);
  const to = Math.round((at + 0.06) * fs);
  networkCache = {
    sampleRate: fs,
    h1: Array.from(wh.slice(from, to), (v) => round(v, 3)),
    l1: Array.from(wl.slice(from - margin, to + margin), (v) => round(v, 3)),
    margin,
    t0: round(from / fs - at, 6),
  };
  return networkCache;
}

export interface ChirpMassScan {
  /** Chirp masses (solar masses), ascending. */
  mc: number[];
  /** Best matched-filter SNR of a template with that chirp mass. */
  snr: number[];
  truth: number;
}

let scanCache: ChirpMassScan | undefined;

/** The toy chirp's matched-filter SNR for templates across chirp mass. */
export function chirpMassScan(): ChirpMassScan {
  if (scanCache) return scanCache;
  const data = readDataset('synthetic/toy-chirp');
  const fs = data.meta.sample_rate;
  const inj = data.meta.injection as {
    merger_time: number;
    chirp_mass: number;
    f_start: number;
    f_end: number;
    snr_f_low: number;
    noise_f_low: number;
  };
  const strain = data.channel('strain');
  const band: Band = {
    sampleRate: fs,
    psd: (f) => aligoDesignPsd(Math.max(f, inj.noise_f_low)),
    fLow: inj.snr_f_low,
  };
  const scoreOf = (mc: number) => {
    const template = newtonianChirp({
      sampleRate: fs,
      n: strain.length,
      mergerTime: inj.merger_time,
      chirpMass: mc,
      fStart: inj.f_start,
      fEnd: inj.f_end,
    });
    const snr = matchedFilter(strain, template, band);
    let best = 0;
    for (const v of snr) best = Math.max(best, v);
    return best;
  };
  const points = new Map<number, number>();
  const add = (mc: number) => {
    const key = Number(mc.toFixed(4));
    if (!points.has(key)) points.set(key, scoreOf(key));
  };
  for (let mc = 26.5; mc <= 29.5 + 1e-9; mc += 0.1) add(mc);
  let bestMc = inj.chirp_mass;
  for (const [mc, s] of points) if (s > (points.get(bestMc) ?? 0)) bestMc = mc;
  for (let mc = bestMc - 0.12; mc <= bestMc + 0.12 + 1e-9; mc += 0.005) add(mc);
  const mc = [...points.keys()].sort((a, b) => a - b);
  scanCache = { mc, snr: mc.map((m) => round(points.get(m) ?? 0, 5)), truth: inj.chirp_mass };
  return scanCache;
}
