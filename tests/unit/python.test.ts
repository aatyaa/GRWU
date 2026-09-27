/**
 * Runs the Python runner on a real Pyodide. In Node the core runtime loads from
 * node_modules, so no network is needed; numpy/scipy (CDN) are covered by the browser tests.
 */
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import { PYODIDE_INDEX_URL, PYODIDE_VERSION } from '~/lib/python/config';
import { runWith } from '~/lib/python/run';

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadPyodide();
}, 60_000);

describe('runWith', () => {
  it('returns the last expression and captures stdout', async () => {
    const result = await runWith(pyodide, 'print("hello")\n6 * 7');
    expect(result.value).toBe(42);
    expect(result.stdout).toBe('hello\n');
  });

  it('converts dicts and lists to plain JavaScript', async () => {
    const result = await runWith(pyodide, '{"f": [1.5, 2.5], "n": 2}');
    expect(result.value).toEqual({ f: [1.5, 2.5], n: 2 });
  });

  it('passes typed arrays in as buffers Python can read', async () => {
    const data = new Float32Array([1, 2, 3.5]);
    const result = await runWith(pyodide, 'sum(data.to_py().tolist())', { globals: { data } });
    expect(result.value).toBe(6.5);
  });

  it('gives every run a fresh scope', async () => {
    await runWith(pyodide, 'leftover = 1');
    await expect(runWith(pyodide, 'leftover')).rejects.toThrow(/NameError/);
  });
});

describe('Pyodide pinning', () => {
  it('fetches the runtime that matches the bundled loader', () => {
    expect(PYODIDE_VERSION).toBe(pyodide.version);
    expect(PYODIDE_INDEX_URL).toBe(`https://cdn.jsdelivr.net/pyodide/v${pyodide.version}/full/`);
  });
});
