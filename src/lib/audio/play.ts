/**
 * Plays a stretch of a time series through Web Audio. Detector data is 4096 Hz; the buffer
 * is upsampled twofold to 8192 Hz, a rate every browser must accept for AudioBuffers.
 */
let context: AudioContext | undefined;
let current: AudioBufferSourceNode | undefined;

export interface PlayOptions {
  sampleRate: number;
  /** Where to start, in seconds from the beginning of `samples`. */
  from?: number;
  /** How long to play, in seconds. Default: to the end. */
  seconds?: number;
  onEnded?: () => void;
}

/** Linear 2x upsampling, peak-normalised to 0.8 of full scale. */
export function prepareBuffer(samples: ArrayLike<number>): Float32Array<ArrayBuffer> {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0 ? 0.8 / peak : 0;
  const out = new Float32Array(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const next = i + 1 < samples.length ? samples[i + 1] : samples[i];
    out[2 * i] = samples[i] * gain;
    out[2 * i + 1] = ((samples[i] + next) / 2) * gain;
  }
  return out;
}

export async function play(
  samples: ArrayLike<number>,
  { sampleRate, from = 0, seconds, onEnded }: PlayOptions,
): Promise<void> {
  stop();
  context ??= new AudioContext();
  if (context.state === 'suspended') await context.resume();

  const start = Math.max(0, Math.round(from * sampleRate));
  const end =
    seconds === undefined
      ? samples.length
      : Math.min(samples.length, start + Math.round(seconds * sampleRate));
  const slice = Array.prototype.slice.call(samples, start, end) as number[];
  const data = prepareBuffer(slice);

  const buffer = context.createBuffer(1, data.length, sampleRate * 2);
  buffer.copyToChannel(data, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  // Only a sound that plays to its end reports back: one cut short by stop() or by the
  // next play() must not mark the newer sound as finished.
  source.onended = () => {
    if (current !== source) return;
    current = undefined;
    onEnded?.();
  };
  source.start();
  current = source;
}

export function stop(): void {
  const playing = current;
  current = undefined;
  playing?.stop();
}
