/**
 * Reads a published dataset from public/data at build time (Astro frontmatter, tests).
 * Node only: browsers use loadDataset() from dataset.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMeta, type DatasetMeta } from './dataset';

export interface BuildDataset {
  meta: DatasetMeta & Record<string, unknown>;
  /** A channel in physical units (strain), as float64. */
  channel(name: string): Float64Array;
}

export function readDataset(folder: string): BuildDataset {
  const root = join(process.cwd(), 'public', 'data', folder);
  const raw = JSON.parse(readFileSync(join(root, 'meta.json'), 'utf8'));
  const meta = { ...raw, ...parseMeta(raw) };
  return {
    meta,
    channel(name: string) {
      const entry = meta.channels[name];
      if (!entry) throw new Error(`no channel ${name} in ${folder}`);
      const bytes = readFileSync(join(root, entry.file));
      const stored = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      return Float64Array.from(stored, (v) => v * meta.scale);
    },
  };
}

/** Min and max of each of `buckets` equal slices: draws a dense series faithfully in few points. */
export function envelope(
  x: ArrayLike<number>,
  from: number,
  to: number,
  buckets: number,
): { lo: number[]; hi: number[] } {
  const lo: number[] = [];
  const hi: number[] = [];
  const span = (to - from) / buckets;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(from + b * span);
    const end = Math.max(start + 1, Math.floor(from + (b + 1) * span));
    let min = Infinity;
    let max = -Infinity;
    for (let i = start; i < end; i++) {
      if (x[i] < min) min = x[i];
      if (x[i] > max) max = x[i];
    }
    lo.push(min);
    hi.push(max);
  }
  return { lo, hi };
}
