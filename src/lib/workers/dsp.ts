import { wrap, type Remote } from 'comlink';
import type { DspApi } from './dsp.worker';

let remote: Remote<DspApi> | undefined;

/** The page's shared DSP worker, started on first use. */
export function dspWorker(): Remote<DspApi> {
  remote ??= wrap<DspApi>(
    new Worker(new URL('./dsp.worker.ts', import.meta.url), { type: 'module', name: 'grwu-dsp' }),
  );
  return remote;
}
