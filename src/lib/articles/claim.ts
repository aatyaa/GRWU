/**
 * Build-time data for "From Data File to Claim": one claim about LIGO Hanford's noise around
 * GW150914, traced from the published file. Everything is read or computed here from the
 * dataset in public/data (with the Welch estimate the tests check against scipy), and the
 * build fails if the file no longer matches its published SHA-256. Node only.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { envelope, readDataset } from '~/lib/data/build';
import { welch } from '~/lib/dsp/welch';

export interface ClaimData {
  detector: string;
  /** The archive file the pipeline cut from, and its length in seconds. */
  source: { url: string; file: string; gpsStart: number; seconds: number };
  sampleRate: number;
  seconds: number;
  samples: number;
  gpsStart: number;
  /** Seconds from the start of the cut to the event. */
  event: number;
  scale: number;
  sha256: string;
  /** The channel's file in public/data, as the browser fetches it. */
  channelFile: string;
  bytes: number;
  /** Min and max of the strain in equal slices of the 32 s, for drawing. */
  strain: { lo: number[]; hi: number[] };
  segments: number;
  segmentSeconds: number;
  /** The amplitude spectral density in log-spaced bins: each bin's lowest and highest value. */
  asd: { f: number[]; lo: number[]; hi: number[] };
  band: [number, number];
  quietest: { f: number; asd: number };
  /** The median noise across a flat stretch of the spectrum, for 1 s and 4 s segments. */
  floor: { from: number; to: number; one: number; four: number };
  /** The same claim computed with a mistake, or with a different choice, for BreakALink. */
  variants: {
    rate: { f: number; asd: number; sampleRate: number };
    scale: { f: number; asd: number };
    segments: { f: number; asd: number; segments: number; segmentSeconds: number };
  };
}

/** Lowest and highest ASD in each log-spaced bin, so both narrow lines and the floor survive. */
function logBand(
  freqs: ArrayLike<number>,
  psd: ArrayLike<number>,
  band: [number, number],
  bins: number,
) {
  const out = { f: [] as number[], lo: [] as number[], hi: [] as number[] };
  let k = 1;
  for (let b = 0; b < bins; b++) {
    const top = band[0] * (band[1] / band[0]) ** ((b + 1) / bins);
    let lo = Infinity;
    let hi = -Infinity;
    let fSum = 0;
    let count = 0;
    for (; k < freqs.length && freqs[k] < top; k++) {
      if (freqs[k] < band[0]) continue;
      const a = Math.sqrt(psd[k]);
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
      fSum += freqs[k];
      count++;
    }
    if (count) {
      out.f.push(Number((fSum / count).toFixed(2)));
      out.lo.push(Number(lo.toPrecision(4)));
      out.hi.push(Number(hi.toPrecision(4)));
    }
  }
  return out;
}

let cache: ClaimData | undefined;

export function claimData(): ClaimData {
  if (cache) return cache;
  const folder = 'events/GW150914';
  const detector = 'H1';
  const data = readDataset(folder);
  const meta = data.meta;
  const entry = meta.channels[detector];
  const bytes = readFileSync(join(process.cwd(), 'public', 'data', folder, entry.file));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== entry.sha256) {
    throw new Error(`${folder}/${entry.file} does not match its published SHA-256`);
  }
  const url = (meta.sources as Record<string, string>)[detector];
  const file = url.split('/').pop()!;
  // GWOSC names archive files <IFO>-<channel>-<GPS start>-<seconds>.hdf5.
  const [, , gps, seconds] = file.replace('.hdf5', '').split('-');

  const fs = meta.sample_rate;
  const strain = data.channel(detector);
  const segmentSeconds = 1;
  const band: [number, number] = [10, 1500];
  const quietestOf = (x: ArrayLike<number>, sampleRate: number, nperseg: number) => {
    const est = welch(x, { sampleRate, nperseg });
    let best = { f: 0, asd: Infinity };
    for (let k = 1; k < est.freqs.length; k++) {
      const a = Math.sqrt(est.psd[k]);
      const f = est.freqs[k];
      if (f >= band[0] * (sampleRate / fs) && f <= band[1] * (sampleRate / fs) && a < best.asd)
        best = { f, asd: a };
    }
    return { ...est, best };
  };
  const { freqs, psd, segments, best: q } = quietestOf(strain, fs, segmentSeconds * fs);
  // Mistakes and choices, each computed rather than guessed.
  const wrongRate = 4 * fs;
  const rate = quietestOf(strain, wrongRate, segmentSeconds * fs).best;
  const stored = Float64Array.from(strain, (v) => v / meta.scale);
  const scale = quietestOf(stored, fs, segmentSeconds * fs).best;
  const longer = 4;
  const four = quietestOf(strain, fs, longer * fs);
  const floorBand = { from: 100, to: 300 };
  const medianAsd = (est: { freqs: ArrayLike<number>; psd: ArrayLike<number> }) => {
    const v: number[] = [];
    for (let k = 0; k < est.freqs.length; k++) {
      if (est.freqs[k] >= floorBand.from && est.freqs[k] <= floorBand.to)
        v.push(Math.sqrt(est.psd[k]));
    }
    v.sort((a, b) => a - b);
    return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  };

  cache = {
    detector,
    source: { url, file, gpsStart: Number(gps), seconds: Number(seconds) },
    sampleRate: fs,
    seconds: meta.n_samples / fs,
    samples: meta.n_samples,
    gpsStart: meta.gps_start as number,
    event: (meta.gps_event as number) - (meta.gps_start as number),
    scale: meta.scale,
    sha256,
    channelFile: entry.file,
    bytes: bytes.byteLength,
    strain: envelope(strain, 0, strain.length, 320),
    segments,
    segmentSeconds,
    asd: logBand(freqs, psd, band, 260),
    band,
    quietest: q,
    floor: { ...floorBand, one: medianAsd({ freqs, psd }), four: medianAsd(four) },
    variants: {
      rate: { ...rate, sampleRate: wrongRate },
      scale,
      segments: { ...four.best, segments: four.segments, segmentSeconds: longer },
    },
  };
  return cache;
}
