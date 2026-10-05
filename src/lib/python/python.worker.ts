/// <reference lib="webworker" />
import { expose } from 'comlink';
import type { PyodideInterface } from 'pyodide';
import { prepare, runExercise, type RunRequest } from './core';

/**
 * Python off the main thread (ADR 0010). Pyodide is loaded from the site's own copy
 * (public/pyodide/), not bundled: only its URL is known at build time.
 */
let py: PyodideInterface | undefined;
let index = '';

const api = {
  async init(indexURL: string): Promise<string> {
    if (!py) {
      index = indexURL;
      const { loadPyodide } = (await import(
        /* @vite-ignore */ `${indexURL}pyodide.mjs`
      )) as typeof import('pyodide');
      py = await loadPyodide({ indexURL });
      prepare(py);
    }
    return py.version;
  },
  run(request: RunRequest) {
    if (!py) throw new Error('Python is not started');
    return runExercise(py, index, request);
  },
};

export type PythonApi = typeof api;

expose(api);
