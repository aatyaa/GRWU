/// <reference lib="webworker" />
import { expose, transfer } from 'comlink';
import { welch, type Psd, type WelchOptions } from '../dsp/welch';

const api = {
  /** Welch PSD off the main thread. The result's buffers are transferred, not copied. */
  welch(samples: Float32Array | Float64Array, options: WelchOptions): Psd {
    const result = welch(samples, options);
    return transfer(result, [result.freqs.buffer, result.psd.buffer]);
  },
};

export type DspApi = typeof api;

expose(api);
