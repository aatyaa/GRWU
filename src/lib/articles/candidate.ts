/**
 * Build-time data for "A Peak Is Only a Candidate": a time–frequency map of GW150914, the
 * edges a filter corrupts, the χ² test on a chirp and on a glitch, and a background from
 * time slides. Node only; every figure's numbers come from here.
 */
import { readDataset } from '~/lib/data/build';
import { newtonianChirp } from '~/lib/dsp/chirp';
import { irfft, rfft } from '~/lib/dsp/fft';
import { interpolatePsd, matchedFilter, optimalSnr, whiten, type Band } from '~/lib/dsp/filter';
import { aligoDesignPsd } from '~/lib/dsp/models';
import { welch } from '~/lib/dsp/welch';
import { greyPngUri } from '~/lib/figure/png';
import { gaussian, mulberry32 } from '~/lib/stats/random';

const round = (v: number, digits = 4) => Number(v.toPrecision(digits));

export interface EnergyMap {
  /** PNG (greyscale) of the normalised energy, time across, frequency up. */
  uri: string;
  width: number;
  height: number;
  /** Seconds relative to `origin` at the left and right edges. */
  t0: number;
  t1: number;
  fLo: number;
  fHi: number;
  /** The loudest tile, in units of the energy white noise has on average. */
  peak: number;
}

/**
 * Normalised energy of whitened data in Morlet tiles: at each frequency, the data are
 * correlated with a Gaussian-windowed complex sinusoid a few cycles long (Q sets how many),
 * and |correlation|² is divided by the window's own energy, so white noise averages 1.
 * This is the idea of the Q-transform, not gwpy's implementation of it.
 */
function energyMap(
  x: Float64Array,
  fs: number,
  from: number,
  to: number,
  origin: number,
  { fLo = 25, fHi = 500, rows = 72, step = 4, q = 7, clip = 25 } = {},
): EnergyMap {
  const freqs = Array.from({ length: rows }, (_, r) => fLo * (fHi / fLo) ** (r / (rows - 1)));
  const cols = Math.floor((to - from) / step);
  const energy = new Float64Array(rows * cols);
  let peak = 0;
  freqs.forEach((f, r) => {
    const sigma = q / (2 * Math.PI * f); // seconds
    const half = Math.ceil(3 * sigma * fs);
    const re: number[] = [];
    const im: number[] = [];
    let norm = 0;
    for (let k = -half; k <= half; k++) {
      const t = k / fs;
      const g = Math.exp(-0.5 * (t / sigma) ** 2);
      re.push(g * Math.cos(2 * Math.PI * f * t));
      im.push(-g * Math.sin(2 * Math.PI * f * t));
      norm += g * g;
    }
    for (let c = 0; c < cols; c++) {
      const centre = from + c * step;
      let sr = 0;
      let si = 0;
      for (let k = -half; k <= half; k++) {
        const v = x[centre + k] ?? 0;
        sr += v * re[k + half];
        si += v * im[k + half];
      }
      const e = (sr * sr + si * si) / norm;
      energy[r * cols + c] = e;
      if (e > peak) peak = e;
    }
  });
  // Rows run top to bottom in the image, so the highest frequency is the first row.
  const pixels = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = Math.min(energy[(rows - 1 - r) * cols + c], clip) / clip;
      pixels[r * cols + c] = Math.round(255 * Math.sqrt(e));
    }
  }
  return {
    uri: greyPngUri(cols, rows, pixels),
    width: cols,
    height: rows,
    t0: round((from - origin) / fs, 6),
    t1: round((from + cols * step - origin) / fs, 6),
    fLo,
    fHi,
    peak: round(peak, 3),
  };
}

function gw150914() {
  const data = readDataset('events/GW150914');
  const fs = data.meta.sample_rate;
  const h1 = data.channel('H1');
  const event = (data.meta.gps_event as number) - (data.meta.gps_start as number);
  const { freqs, psd } = welch(h1, { sampleRate: fs, nperseg: 4 * fs, average: 'median' });
  const band: Band = { sampleRate: fs, psd: interpolatePsd(freqs, psd), fLow: 20 };
  return { fs, h1, event, band };
}

let qCache: EnergyMap | undefined;

/** GW150914 in LIGO Hanford as a time–frequency map, from 0.5 s before to 0.2 s after. */
export function gw150914Map(): EnergyMap {
  if (qCache) return qCache;
  const { fs, h1, event, band } = gw150914();
  const white = whiten(h1, band);
  const at = Math.round(event * fs);
  qCache = energyMap(white, fs, at - Math.round(0.5 * fs), at + Math.round(0.2 * fs), at, {
    rows: 64,
    step: 6,
  });
  return qCache;
}

export interface EdgeData {
  /** Whitened H1 over the whole file, as a min/max envelope. */
  t: number[];
  lo: number[];
  hi: number[];
  duration: number;
  event: number;
  /** Largest excursion near an edge, and in the middle, in units of the noise. */
  edgePeak: number;
  middlePeak: number;
}

let edgeCache: EdgeData | undefined;

/** The whole 32 s of GW150914 whitened with no taper: the filter's edges ring. */
export function edges(): EdgeData {
  if (edgeCache) return edgeCache;
  const { fs, h1, event, band } = gw150914();
  const white = whiten(h1, band);
  const n = white.length;
  const buckets = 640;
  const t: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const a = Math.floor((b * n) / buckets);
    const e = Math.floor(((b + 1) * n) / buckets);
    let min = Infinity;
    let max = -Infinity;
    for (let i = a; i < e; i++) {
      min = Math.min(min, white[i]);
      max = Math.max(max, white[i]);
    }
    t.push(round((a + e) / 2 / fs, 5));
    lo.push(round(min, 3));
    hi.push(round(max, 3));
  }
  const peakIn = (a: number, b: number) => {
    let m = 0;
    for (let i = Math.round(a * fs); i < Math.round(b * fs); i++)
      m = Math.max(m, Math.abs(white[i]));
    return round(m, 3);
  };
  const duration = n / fs;
  edgeCache = {
    t,
    lo,
    hi,
    duration,
    event: round(event, 5),
    edgePeak: Math.max(peakIn(0, 1), peakIn(duration - 1, duration)),
    middlePeak: peakIn(4, duration - 4),
  };
  return edgeCache;
}

export interface ChiSquareCase {
  /** The matched-filter SNR at the peak. */
  snr: number;
  /** Each band's contribution to the SNR, projected on the total's phase. */
  bands: number[];
  chi2: number;
  dof: number;
}

export interface ChiSquareData {
  edges: number[];
  chirp: ChiSquareCase;
  glitch: ChiSquareCase;
}

let chiCache: ChiSquareData | undefined;

/**
 * The χ² test (Allen 2005): split the template into p frequency bands that each carry an
 * equal share of its power, and check how the matched-filter output at the peak divides
 * among them. A chirp puts ρ/p in each; a glitch piles into a few.
 */
export function chiSquare(p = 8): ChiSquareData {
  if (chiCache) return chiCache;
  const data = readDataset('synthetic/toy-chirp');
  const fs = data.meta.sample_rate;
  const inj = data.meta.injection as {
    merger_time: number;
    snr_f_low: number;
    noise_f_low: number;
  };
  const strain = data.channel('strain');
  const signal = data.channel('injection');
  const noise = strain.map((v, i) => v - signal[i]);
  const band: Band = {
    sampleRate: fs,
    psd: (f) => aligoDesignPsd(Math.max(f, inj.noise_f_low)),
    fLow: inj.snr_f_low,
  };
  const n = strain.length;
  const df = fs / n;
  const dt = 1 / fs;
  const H = rfft(signal);
  // Band edges with equal shares of (h|h).
  const weight: number[] = [];
  let total = 0;
  for (let k = 0; k < H.re.length; k++) {
    const f = k * df;
    const w = f >= band.fLow && f < fs / 2 ? (H.re[k] ** 2 + H.im[k] ** 2) / band.psd(f) : 0;
    weight.push(w);
    total += w;
  }
  const bandOf = new Int32Array(H.re.length);
  const edgesHz: number[] = [band.fLow];
  let acc = 0;
  let current = 0;
  for (let k = 0; k < H.re.length; k++) {
    acc += weight[k];
    bandOf[k] = current;
    if (acc >= ((current + 1) * total) / p && current < p - 1) {
      current++;
      edgesHz.push(round(k * df, 4));
    }
  }
  const sigma = optimalSnr(signal, band);

  const glitchAt = inj.merger_time - 6;
  const glitch = (i: number) => {
    const t = i / fs - glitchAt;
    return Math.exp(-((t / 0.008) ** 2)) * Math.cos(2 * Math.PI * 140 * t);
  };

  const run = (series: Float64Array): ChiSquareCase => {
    const snr = matchedFilter(series, signal, band);
    let j = 0;
    for (let i = 1; i < n; i++) if (snr[i] > snr[j]) j = i;
    const D = rfft(series);
    const zr = new Float64Array(p);
    const zi = new Float64Array(p);
    for (let k = 0; k < D.re.length; k++) {
      if (!weight[k]) continue;
      const s = band.psd(k * df);
      // D · H* / S, rotated to lag j.
      const re = (D.re[k] * H.re[k] + D.im[k] * H.im[k]) / s;
      const im = (D.im[k] * H.re[k] - D.re[k] * H.im[k]) / s;
      const phase = (2 * Math.PI * k * j) / n;
      const c = Math.cos(phase);
      const si = Math.sin(phase);
      zr[bandOf[k]] += re * c - im * si;
      zi[bandOf[k]] += re * si + im * c;
    }
    const scale = (4 * dt * dt * df) / sigma;
    for (let l = 0; l < p; l++) {
      zr[l] *= scale;
      zi[l] *= scale;
    }
    const Zr = zr.reduce((a, b) => a + b, 0);
    const Zi = zi.reduce((a, b) => a + b, 0);
    const rho = Math.hypot(Zr, Zi);
    let chi2 = 0;
    for (let l = 0; l < p; l++) chi2 += p * ((zr[l] - Zr / p) ** 2 + (zi[l] - Zi / p) ** 2);
    return {
      snr: round(rho, 4),
      bands: Array.from(zr, (r, l) => round((r * Zr + zi[l] * Zi) / rho, 4)),
      chi2: round(chi2, 4),
      dof: 2 * p - 2,
    };
  };

  // Scale the glitch so that it scores as high against the template as the chirp does.
  const unit = Float64Array.from({ length: n }, (_, i) => glitch(i));
  const probe = matchedFilter(unit, signal, band);
  let probePeak = 0;
  for (const v of probe) probePeak = Math.max(probePeak, v);
  const chirpCase = run(strain);
  const amp = chirpCase.snr / probePeak;
  const glitchy = Float64Array.from(noise, (v, i) => v + amp * unit[i]);
  chiCache = { edges: edgesHz, chirp: chirpCase, glitch: run(glitchy) };
  return chiCache;
}

export interface SlideData {
  /** Network SNR of every coincidence in the time-slid data, the candidate's own triggers removed. */
  background: number[];
  /** The same, keeping the candidate's triggers, which then pair with noise. */
  inclusive: number[];
  slides: number;
  /** Seconds of data in each slide. */
  duration: number;
  /** Network SNR of the real coincidence, unslid. */
  candidate: number;
  threshold: number;
}

let slideCache: SlideData | undefined;

/** Coloured noise with a given one-sided PSD, the inverse of whiten(). */
function colouredNoise(
  n: number,
  fs: number,
  psd: (f: number) => number,
  seed: number,
): Float64Array {
  const draw = gaussian(mulberry32(seed));
  const white = Float64Array.from({ length: n }, draw);
  const X = rfft(white);
  const df = fs / n;
  for (let k = 0; k < X.re.length; k++) {
    const a = k === 0 ? 0 : Math.sqrt((psd(k * df) * fs) / 2);
    X.re[k] *= a;
    X.im[k] *= a;
  }
  return irfft(X, n);
}

/**
 * Two detectors' worth of simulated noise with a chirp in both, a matched filter in each,
 * and coincidences within 10 ms. Sliding one detector against the other by whole seconds
 * breaks every real coincidence and leaves only accidents: the background.
 */
export function timeSlides(): SlideData {
  if (slideCache) return slideCache;
  const fs = 4096;
  const duration = 64;
  const n = fs * duration;
  const psd = (f: number) => aligoDesignPsd(Math.max(f, 10));
  const band: Band = { sampleRate: fs, psd, fLow: 20 };
  const merger = 40.3;
  const template = newtonianChirp({
    sampleRate: fs,
    n,
    mergerTime: merger,
    chirpMass: 28,
    fStart: 20,
    fEnd: 250,
  });
  const unit = optimalSnr(template, band);
  const delay = Math.round(0.007 * fs);
  const signalIn = (shift: number, snr: number) =>
    Float64Array.from({ length: n }, (_, i) => (template[(i - shift + n) % n] * snr) / unit);
  const a = colouredNoise(n, fs, psd, 1001);
  const b = colouredNoise(n, fs, psd, 2002);
  const sa = signalIn(0, 12);
  const sb = signalIn(delay, 11);
  for (let i = 0; i < n; i++) {
    a[i] += sa[i];
    b[i] += sb[i];
  }
  const ra = matchedFilter(a, template, band);
  const rb = matchedFilter(b, template, band);
  // Triggers: the loudest point in each 0.1 s above a threshold.
  const threshold = 3;
  const block = Math.round(0.1 * fs);
  const triggers = (r: Float64Array) => {
    const out: { i: number; snr: number }[] = [];
    for (let s = 0; s < n; s += block) {
      let best = s;
      for (let i = s; i < Math.min(n, s + block); i++) if (r[i] > r[best]) best = i;
      if (r[best] >= threshold) out.push({ i: best, snr: r[best] });
    }
    return out;
  };
  const ta = triggers(ra);
  const tb = triggers(rb);
  const window = Math.round(0.01 * fs);
  // Trigger positions are lags of the template, which sits where the signal was injected: the
  // candidate's own triggers are the ones within a second of lag zero.
  const near = (i: number) => Math.min(i, n - i) / fs < 1;
  const coincide = (shift: number, exclusive = false) => {
    const found: number[] = [];
    for (const x of ta) {
      if (exclusive && near(x.i)) continue;
      let best = 0;
      for (const y of tb) {
        if (exclusive && near(y.i)) continue;
        const d = ((((y.i + shift - x.i) % n) + n + n / 2) % n) - n / 2;
        if (Math.abs(d) <= window) best = Math.max(best, Math.hypot(x.snr, y.snr));
      }
      if (best > 0) found.push(best);
    }
    return found;
  };
  const candidate = Math.max(0, ...coincide(0));
  const background: number[] = [];
  const inclusive: number[] = [];
  let slides = 0;
  // Slide by half-second steps: far more than the 10 ms light travel time, so nothing real survives.
  for (let s = 1; s < 2 * duration; s++) {
    background.push(...coincide(Math.round(s * 0.5 * fs), true).map((v) => round(v, 4)));
    inclusive.push(...coincide(Math.round(s * 0.5 * fs)).map((v) => round(v, 4)));
    slides++;
  }
  slideCache = {
    background,
    inclusive,
    slides,
    duration,
    candidate: round(candidate, 4),
    threshold,
  };
  return slideCache;
}

export interface SubtractionMaps {
  before: EnergyMap;
  after: EnergyMap;
}

let subCache: SubtractionMaps | undefined;

/** The practice chirp as a time–frequency map, before and after subtracting its template. */
export function subtraction(): SubtractionMaps {
  if (subCache) return subCache;
  const data = readDataset('synthetic/toy-chirp');
  const fs = data.meta.sample_rate;
  const inj = data.meta.injection as {
    merger_time: number;
    snr_f_low: number;
    noise_f_low: number;
  };
  const band: Band = {
    sampleRate: fs,
    psd: (f) => aligoDesignPsd(Math.max(f, inj.noise_f_low)),
    fLow: inj.snr_f_low,
  };
  const strain = data.channel('strain');
  const signal = data.channel('injection');
  const at = Math.round(inj.merger_time * fs);
  const from = at - Math.round(1.1 * fs);
  const to = at + Math.round(0.1 * fs);
  const opts = { fLo: 20, fHi: 300, rows: 56, step: 14, clip: 10 };
  subCache = {
    before: energyMap(whiten(strain, band), fs, from, to, at, opts),
    after: energyMap(
      whiten(
        strain.map((v, i) => v - signal[i]),
        band,
      ),
      fs,
      from,
      to,
      at,
      opts,
    ),
  };
  return subCache;
}
