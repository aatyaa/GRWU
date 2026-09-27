import { wrap, type Remote } from 'comlink';
import type { PythonApi } from '../workers/python.worker';

let remote: Remote<PythonApi> | undefined;

/**
 * The page's Python worker. Nothing is downloaded until this is first called; the runtime
 * itself (several MB) loads on the first `warmUp` or `run`.
 */
export function pythonWorker(): Remote<PythonApi> {
  remote ??= wrap<PythonApi>(
    new Worker(new URL('../workers/python.worker.ts', import.meta.url), {
      type: 'module',
      name: 'grwu-python',
    }),
  );
  return remote;
}
