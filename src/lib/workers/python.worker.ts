/// <reference lib="webworker" />
import { expose } from 'comlink';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PYODIDE_INDEX_URL } from '../python/config';
import { runWith, type RunOptions, type RunResult } from '../python/run';

let runtime: Promise<PyodideInterface> | undefined;

function pyodide(): Promise<PyodideInterface> {
  runtime ??= loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  return runtime;
}

const api = {
  /** Loads the runtime ahead of time, e.g. when a code panel comes into view. */
  async warmUp(): Promise<void> {
    await pyodide();
  },
  async run(code: string, options?: RunOptions): Promise<RunResult> {
    return runWith(await pyodide(), code, options);
  },
};

export type PythonApi = typeof api;

expose(api);
