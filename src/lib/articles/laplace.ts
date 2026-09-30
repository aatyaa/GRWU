/**
 * Build-time data for "Laplace Closes the Circle": the practice chirp split into what was
 * recorded, the signal inside it and the rest, all whitened on the same scale. Node only.
 */
import { readDataset } from '~/lib/data/build';
import { whiten, type Band } from '~/lib/dsp/filter';
import { aligoDesignPsd } from '~/lib/dsp/models';

export interface Decomposition {
  t: number[];
  d: number[];
  h: number[];
  n: number[];
}

let cache: Decomposition | undefined;

/** d = h + n for the toy chirp, whitened, over the last 0.6 s before the merger. */
export function decomposition(): Decomposition {
  if (cache) return cache;
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
  const d = whiten(data.channel('strain'), band);
  const h = whiten(data.channel('injection'), band);
  const from = Math.round((inj.merger_time - 0.6) * fs);
  const to = Math.round((inj.merger_time + 0.04) * fs);
  const out: Decomposition = { t: [], d: [], h: [], n: [] };
  for (let i = from; i < to; i += 2) {
    const r = (v: number) => Number(v.toFixed(3));
    out.t.push(Number(((i - from) / fs).toFixed(5)));
    out.d.push(r(d[i]));
    out.h.push(r(h[i]));
    out.n.push(r(d[i] - h[i]));
  }
  cache = out;
  return out;
}
