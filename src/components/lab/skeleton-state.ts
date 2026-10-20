/**
 * State shared by the walking-skeleton islands: the spectrum figure writes the current
 * dataset, settings and result; the code panel reads them to reproduce the figure in Python.
 */
import { atom } from 'nanostores';
import { loadDataset, type Channel } from '~/lib/data/dataset';
import { createParams } from '~/lib/state';

export interface SkeletonDataset {
  id: string;
  label: string;
  /** Dataset folder URL (already joined with the site base). */
  url: string;
  channel: string;
  /** Seconds into the data worth listening to (merger time). */
  listenAt: number;
  /** Channel holding the clean signal, for synthetic data. */
  signalChannel?: string;
}

export const params = createParams({
  dataset: 'toy-chirp',
  /** Welch segment length in seconds. */
  segment: 4,
  average: 'mean',
});

export interface SpectrumResult {
  datasetId: string;
  channel: string;
  nperseg: number;
  average: 'mean' | 'median';
  segments: number;
  freqs: Float64Array;
  psd: Float64Array;
  /** Stored float32 samples and their scale, as loaded (what the code panel hands Python). */
  stored: Float32Array;
  scale: number;
  sampleRate: number;
}

export const spectrum = atom<SpectrumResult | null>(null);

const channels = new Map<string, Promise<Channel>>();

/** Loads one channel of a dataset once per page; a failed load is retried next time. */
export function loadChannel(info: SkeletonDataset, name: string): Promise<Channel> {
  const key = `${info.url}#${name}`;
  let loading = channels.get(key);
  if (!loading) {
    loading = loadDataset(info.url, { channels: [name] }).then((d) => d.channels[name]);
    channels.set(key, loading);
    loading.catch(() => channels.delete(key));
  }
  return loading;
}
