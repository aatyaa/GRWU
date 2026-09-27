/**
 * Datasets written by the data pipeline (docs/adr/0004-data-format.md): a folder with
 * meta.json and one little-endian float32 file per channel, stored as physical / scale.
 */

export interface ChannelEntry {
  file: string;
  sha256: string;
}

export interface DatasetMeta {
  schema: 1;
  id: string;
  kind: 'synthetic' | 'event';
  description?: string;
  sample_rate: number;
  duration: number;
  /** GPS time of the first sample, or null for synthetic data. */
  gps_start: number | null;
  gps_event?: number;
  n_samples: number;
  dtype: 'float32';
  byte_order: 'little';
  /** physical value = stored value * scale */
  scale: number;
  channels: Record<string, ChannelEntry>;
  sources?: Record<string, string>;
  license?: string;
  attribution?: string;
  injection?: Record<string, number>;
}

/** A channel as stored: values near 1, multiply by `scale` for physical units. */
export interface Channel {
  name: string;
  stored: Float32Array;
  scale: number;
  sampleRate: number;
}

export function parseMeta(json: unknown): DatasetMeta {
  const meta = json as Partial<DatasetMeta> | null;
  if (!meta || meta.schema !== 1) {
    throw new Error(`unsupported dataset schema: ${String(meta?.schema)}`);
  }
  if (meta.dtype !== 'float32' || meta.byte_order !== 'little') {
    throw new Error(`unsupported sample format: ${meta.dtype}/${meta.byte_order}`);
  }
  for (const key of ['id', 'sample_rate', 'n_samples', 'scale', 'channels'] as const) {
    if (meta[key] === undefined) throw new Error(`meta.json is missing "${key}"`);
  }
  return meta as DatasetMeta;
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/** Reads little-endian float32 samples, whatever the platform's byte order. */
function readFloat32LE(buffer: ArrayBuffer): Float32Array {
  if (littleEndian) return new Float32Array(buffer);
  const view = new DataView(buffer);
  const out = new Float32Array(buffer.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(4 * i, true);
  return out;
}

/** Checks a channel file against meta.json and decodes it. */
export async function decodeChannel(
  buffer: ArrayBuffer,
  meta: DatasetMeta,
  name: string,
  { verify = true } = {},
): Promise<Channel> {
  const entry = meta.channels[name];
  if (!entry) throw new Error(`dataset ${meta.id} has no channel ${name}`);
  if (buffer.byteLength !== meta.n_samples * 4) {
    throw new Error(
      `${entry.file}: expected ${meta.n_samples * 4} bytes, got ${buffer.byteLength}`,
    );
  }
  if (verify && (await sha256Hex(buffer)) !== entry.sha256) {
    throw new Error(`${entry.file}: checksum does not match meta.json`);
  }
  return { name, stored: readFloat32LE(buffer), scale: meta.scale, sampleRate: meta.sample_rate };
}

/** Physical values (e.g. strain) as float64. */
export function toPhysical(channel: Channel): Float64Array {
  const out = new Float64Array(channel.stored.length);
  for (let i = 0; i < out.length; i++) out[i] = channel.stored[i] * channel.scale;
  return out;
}

export interface Dataset {
  meta: DatasetMeta;
  channels: Record<string, Channel>;
}

/**
 * Fetches a dataset folder, e.g. withBase('data/synthetic/toy-chirp/').
 * Loads every channel unless `channels` names a subset.
 */
export async function loadDataset(
  folderUrl: string,
  {
    channels,
    verify = true,
    fetcher = fetch,
  }: {
    channels?: string[];
    verify?: boolean;
    fetcher?: typeof fetch;
  } = {},
): Promise<Dataset> {
  const base = folderUrl.endsWith('/') ? folderUrl : `${folderUrl}/`;
  const response = await fetcher(`${base}meta.json`);
  if (!response.ok) throw new Error(`could not load ${base}meta.json (${response.status})`);
  const meta = parseMeta(await response.json());
  const names = channels ?? Object.keys(meta.channels);

  const loaded = await Promise.all(
    names.map(async (name) => {
      const entry = meta.channels[name];
      if (!entry) throw new Error(`dataset ${meta.id} has no channel ${name}`);
      const file = await fetcher(`${base}${entry.file}`);
      if (!file.ok) throw new Error(`could not load ${base}${entry.file} (${file.status})`);
      return decodeChannel(await file.arrayBuffer(), meta, name, { verify });
    }),
  );
  return { meta, channels: Object.fromEntries(loaded.map((channel) => [channel.name, channel])) };
}
