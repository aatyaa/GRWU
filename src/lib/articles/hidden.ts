/**
 * Build-time data for "Hidden in the Noise": every number the article's figures draw is
 * computed here from the published datasets, with the same DSP the tests check.
 * Node only (Astro frontmatter).
 */
import { readDataset } from '~/lib/data/build';
import { argmax, interpolatePsd, matchedFilter, whiten, type Band } from '~/lib/dsp/filter';
import { aligoDesignPsd } from '~/lib/dsp/models';
import { welch } from '~/lib/dsp/welch';

const round = (v: number, digits = 4) => Number(v.toPrecision(digits));

/** Samples of x between t0 and t1 seconds, every `step` samples, as [times, values]. */
function slice(x: ArrayLike<number>, fs: number, t0: number, t1: number, step: number) {
  const ts: number[] = [];
  const vs: number[] = [];
  for (let i = Math.round(t0 * fs); i < Math.round(t1 * fs); i += step) {
    ts.push(round(i / fs, 7));
    vs.push(round(x[i]));
  }
  return { t: ts, v: vs };
}

/** Largest value in each of `buckets` equal slices of x between two sample indices. */
function bucketMax(x: (i: number) => number, from: number, to: number, buckets: number) {
  const out: number[] = [];
  const span = (to - from) / buckets;
  for (let b = 0; b < buckets; b++) {
    let best = -Infinity;
    const end = Math.max(from + (b + 1) * span, from + b * span + 1);
    for (let i = Math.floor(from + b * span); i < end; i++) best = Math.max(best, x(i));
    out.push(round(best, 3));
  }
  return out;
}

/** Log-spaced bins from fMin to fMax, keeping the largest value in each so narrow lines survive. */
export function logBins(
  f: ArrayLike<number>,
  v: ArrayLike<number>,
  map: (p: number) => number,
  fMin: number,
  fMax = 1500,
  edges = 360,
) {
  const fOut: number[] = [];
  const vOut: number[] = [];
  let k = 1;
  for (let b = 0; b < edges; b++) {
    const hiF = fMin * (fMax / fMin) ** ((b + 1) / edges);
    let best = -Infinity;
    let bestF = 0;
    for (; k < f.length && f[k] < hiF; k++) {
      if (f[k] < fMin) continue;
      if (v[k] > best) {
        best = v[k];
        bestF = f[k];
      }
    }
    if (best > -Infinity) {
      fOut.push(round(bestF, 5));
      vOut.push(round(map(best)));
    }
  }
  return { f: fOut, v: vOut };
}

export interface Gw150914Figure {
  /** Seconds after the start of the 32 s file, and the event time in them. */
  event: number;
  raw: { t: number[]; v: number[] };
  whitened: { t: number[]; v: number[] };
  banded: { t: number[]; v: number[] };
  asd: { f: number[]; v: number[] };
  /** ASD of the whitened data, in units of the white-noise level (flat at 1 in band). */
  asdWhite: { f: number[]; v: number[] };
  band: [number, number];
}

let gwCache: Gw150914Figure | undefined;

/** GW150914 in LIGO Hanford: raw, whitened, and whitened then limited to 35–350 Hz. */
export function gw150914(): Gw150914Figure {
  if (gwCache) return gwCache;
  const data = readDataset('events/GW150914');
  const fs = data.meta.sample_rate;
  const h1 = data.channel('H1');
  const gpsStart = data.meta.gps_start as number;
  const event = (data.meta.gps_event as number) - gpsStart;

  const { freqs, psd } = welch(h1, { sampleRate: fs, nperseg: 4 * fs, average: 'median' });
  const S = interpolatePsd(freqs, psd);
  const band: [number, number] = [35, 350];
  const white = whiten(h1, { sampleRate: fs, psd: S, fLow: 20 });
  const banded = whiten(h1, { sampleRate: fs, psd: S, fLow: band[0], fHigh: band[1] });

  const t0 = event - 0.45;
  const t1 = event + 0.15;
  const shown = h1.slice(Math.round(t0 * fs), Math.round(t1 * fs));
  const mean = shown.reduce((s, v) => s + v, 0) / shown.length;
  const centred = Float64Array.from(h1, (v) => v - mean);

  const whitePsd = welch(white, { sampleRate: fs, nperseg: 4 * fs });
  const level = Math.sqrt(2 / fs);

  gwCache = {
    event: round(event, 6),
    raw: slice(centred, fs, t0, t1, 3),
    whitened: slice(white, fs, t0, t1, 3),
    banded: slice(banded, fs, t0, t1, 3),
    asd: logBins(freqs, psd, Math.sqrt, 12),
    asdWhite: logBins(whitePsd.freqs, whitePsd.psd, (p) => Math.sqrt(p) / level, 20),
    band,
  };
  return gwCache;
}

export interface TemplateSlideData {
  /** Time of the template's end (the merger) that matches the data. */
  truth: number;
  window: [number, number];
  /** Whitened data over the window, as a min/max envelope. */
  data: { lo: number[]; hi: number[] };
  /** The whitened template as a min/max envelope, times relative to its end. */
  template: { t: number[]; lo: number[]; hi: number[] };
  /** Matched-filter SNR for a template ending in each bucket of the window. */
  score: number[];
  /** The same with the signal subtracted: what noise alone scores. */
  noiseScore: number[];
  peak: number;
  noisePeak: number;
}

let slideCache: TemplateSlideData | undefined;

/** The toy chirp: whitened data, its template, and the matched-filter score along the window. */
export function templateSlide(): TemplateSlideData {
  if (slideCache) return slideCache;
  const data = readDataset('synthetic/toy-chirp');
  const fs = data.meta.sample_rate;
  const injection = data.meta.injection as {
    merger_time: number;
    snr_f_low: number;
    noise_f_low: number;
  };
  const strain = data.channel('strain');
  const signal = data.channel('injection');
  const noise = strain.map((v, i) => v - signal[i]);
  const band: Band = {
    sampleRate: fs,
    psd: (f) => aligoDesignPsd(Math.max(f, injection.noise_f_low)),
    fLow: injection.snr_f_low,
  };
  const truth = injection.merger_time;
  const window: [number, number] = [truth - 3.8, truth + 3.2];
  const buckets = 560;

  const whiteData = whiten(strain, band);
  const whiteTemplate = whiten(signal, band);
  const snr = matchedFilter(strain, signal, band);
  const noiseSnr = matchedFilter(noise, signal, band);
  const n = strain.length;
  // A template ending at time T is the injection shifted by T − truth.
  const at = (series: Float64Array) => (i: number) => {
    const lag = Math.round(i - truth * fs);
    return series[((lag % n) + n) % n];
  };
  const from = window[0] * fs;
  const to = window[1] * fs;

  const lo: number[] = [];
  const hi: number[] = [];
  const span = (to - from) / buckets;
  for (let b = 0; b < buckets; b++) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = Math.floor(from + b * span); i < Math.floor(from + (b + 1) * span); i++) {
      min = Math.min(min, whiteData[i]);
      max = Math.max(max, whiteData[i]);
    }
    lo.push(round(min, 3));
    hi.push(round(max, 3));
  }

  const TB = 180;
  const tFrom = Math.round((truth - 1.1) * fs);
  const tTo = Math.round((truth + 0.02) * fs);
  const template = { t: [] as number[], lo: [] as number[], hi: [] as number[] };
  for (let b = 0; b < TB; b++) {
    const a = Math.floor(tFrom + ((tTo - tFrom) * b) / TB);
    const e = Math.floor(tFrom + ((tTo - tFrom) * (b + 1)) / TB);
    const part = whiteTemplate.slice(a, e);
    template.t.push(round((a + e) / 2 / fs - truth, 5));
    template.lo.push(round(Math.min(...part), 3));
    template.hi.push(round(Math.max(...part), 3));
  }

  const score = bucketMax(at(snr), from, to, buckets);
  const noiseScore = bucketMax(at(noiseSnr), from, to, buckets);
  slideCache = {
    truth,
    window,
    data: { lo, hi },
    template,
    score,
    noiseScore,
    peak: round(snr[argmax(snr)], 3),
    noisePeak: round(Math.max(...noiseScore), 3),
  };
  return slideCache;
}
