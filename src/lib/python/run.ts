import type { PyodideInterface } from 'pyodide';

export interface RunOptions {
  /** Pyodide packages to load first, e.g. ['numpy', 'scipy']. */
  packages?: string[];
  /** Values visible to the code as globals. Typed arrays arrive as JsProxy objects. */
  globals?: Record<string, unknown>;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  /** The value of the last expression, converted to JavaScript. */
  value: unknown;
}

interface Destroyable {
  destroy(): void;
}

interface Convertible extends Destroyable {
  toJs(options: { dict_converter: typeof Object.fromEntries }): unknown;
}

/** Runs `code` in a fresh global scope of an already loaded Pyodide. */
export async function runWith(
  pyodide: PyodideInterface,
  code: string,
  { packages = [], globals = {} }: RunOptions = {},
): Promise<RunResult> {
  if (packages.length) await pyodide.loadPackage(packages);
  let stdout = '';
  let stderr = '';
  pyodide.setStdout({ batched: (line: string) => void (stdout += `${line}\n`) });
  pyodide.setStderr({ batched: (line: string) => void (stderr += `${line}\n`) });

  const scope = (pyodide.globals.get('dict') as () => Destroyable & Map<string, unknown>)();
  try {
    for (const [name, value] of Object.entries(globals)) scope.set(name, value);
    const result: unknown = await pyodide.runPythonAsync(code, { globals: scope as never });
    let value = result;
    if (result && typeof (result as Convertible).toJs === 'function') {
      value = (result as Convertible).toJs({ dict_converter: Object.fromEntries });
      (result as Convertible).destroy();
    }
    return { stdout, stderr, value };
  } finally {
    scope.destroy();
  }
}
