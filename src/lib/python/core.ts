import type { PyodideInterface } from 'pyodide';
import runner from './runner.py?raw';

/**
 * Running exercise code in Pyodide (ADR 0010). Shared by the browser worker and the unit
 * tests, so the code a reader runs is the code the tests check.
 */

export interface RunRequest {
  /** Hidden code run first: data, helpers. */
  setup?: string;
  /** The reader's code. */
  code: string;
  /** Hidden checker defining `check(ns, output)`; raises Feedback when the answer is wrong. */
  check?: string;
  /** Record every line and value with snoop. */
  trace?: boolean;
  /** Packages to load even if no import names them. */
  packages?: string[];
}

export interface RunResult {
  stdout: string;
  /** CPython-style traceback showing only the reader's frames, or null. */
  error: string | null;
  /** Null when there was no checker, or the code raised before it could run. */
  passed: boolean | null;
  message: string | null;
  trace: string | null;
  /** PNG images (base64) of the matplotlib figures the code drew. */
  figures: string[];
}

/** Import names the site hosts a package for (scripts/pyodide-assets.mjs). */
const HOSTED: Record<string, string> = { numpy: 'numpy', scipy: 'scipy', matplotlib: 'matplotlib' };
const TRACER = ['executing', 'asttokens', 'pygments', 'six'];
const TRACER_WHEELS = [
  'extra/cheap_repr-0.5.2-py2.py3-none-any.whl',
  'extra/snoop-0.6.1-py3-none-any.whl',
];

/** Installs the runner module. Call once after loadPyodide. */
export function prepare(py: PyodideInterface): void {
  py.FS.writeFile('/home/pyodide/grwu_runner.py', runner);
  py.runPython(
    'import sys\nif "/home/pyodide" not in sys.path: sys.path.insert(0, "/home/pyodide")',
  );
}

function importsOf(py: PyodideInterface, source: string): string[] {
  py.globals.set('_grwu_source', source);
  try {
    const found = py.runPython('from pyodide.code import find_imports\nfind_imports(_grwu_source)');
    const names: string[] = found.toJs();
    found.destroy();
    return names;
  } catch {
    return []; // a syntax error: the run itself will report it
  }
}

export async function runExercise(
  py: PyodideInterface,
  indexURL: string,
  { setup = '', code, check = '', trace = false, packages = [] }: RunRequest,
): Promise<RunResult> {
  const wanted = new Set(packages);
  for (const name of importsOf(py, `${setup}\n${code}\n${check}`)) {
    if (HOSTED[name]) wanted.add(HOSTED[name]);
  }
  if (trace) for (const name of TRACER) wanted.add(name);
  const load = [...wanted, ...(trace ? TRACER_WHEELS.map((w) => indexURL + w) : [])];
  if (load.length)
    await py.loadPackage(load, { messageCallback: () => {}, errorCallback: () => {} });
  const run = py.pyimport('grwu_runner').run;
  try {
    return JSON.parse(run(setup, code, check, trace)) as RunResult;
  } finally {
    run.destroy();
  }
}
