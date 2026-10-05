import { wrap, type Remote } from 'comlink';
import { withBase } from '~/lib/url';
import type { PythonApi } from './python.worker';

/**
 * The page's Python (ADR 0010): one worker, started on first Run and shared by every exercise.
 * Stopping terminates it; the next Run starts a fresh one from the browser's cache. That works
 * on GitHub Pages, which cannot send the headers a SharedArrayBuffer interrupt would need.
 */
let worker: Worker | undefined;
let ready: Promise<Remote<PythonApi>> | undefined;

export function python(): Promise<Remote<PythonApi>> {
  if (!ready) {
    worker = new Worker(new URL('./python.worker.ts', import.meta.url), {
      type: 'module',
      name: 'grwu-python',
    });
    const remote = wrap<PythonApi>(worker);
    const indexURL = new URL(withBase('pyodide/'), location.href).href;
    ready = remote.init(indexURL).then(() => remote);
    ready.catch(() => stopPython());
  }
  return ready;
}

export function stopPython(): void {
  worker?.terminate();
  worker = undefined;
  ready = undefined;
}
