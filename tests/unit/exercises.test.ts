import { fileURLToPath } from 'node:url';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import { prepare, runExercise } from '~/lib/python/core';
import type { Exercise } from '~/lib/exercises/types';

// The runtime the site serves (scripts/pyodide-assets.mjs), run in Node through the same code.
const indexURL = fileURLToPath(new URL('../../public/pyodide/', import.meta.url));
const exercises = Object.values(
  import.meta.glob<Record<string, Exercise>>('../../src/lib/exercises/*.ts', { eager: true }),
).flatMap((module) =>
  Object.values(module).filter((v): v is Exercise => !!v && typeof v === 'object' && 'check' in v),
);

let py: PyodideInterface;
beforeAll(async () => {
  py = await loadPyodide({ indexURL });
  prepare(py);
}, 120_000);

describe.each(exercises.map((e) => [e.id, e] as const))('exercise %s', (_, exercise) => {
  const run = (code: string) =>
    runExercise(py, indexURL, { setup: exercise.setup, code, check: exercise.check });

  it('accepts its solution', async () => {
    const result = await run(exercise.solution);
    expect(result.error).toBeNull();
    expect(result.passed).toBe(true);
    expect(result.message).toMatch(/^Right/);
  }, 120_000);

  it('turns down every wrong answer with feedback', async () => {
    for (const code of exercise.wrong) {
      const result = await run(code);
      expect(result.passed, code).toBe(false);
      expect(result.message, code).toBeTruthy();
      expect(result.message, code).not.toMatch(/checker could not/);
    }
  }, 120_000);

  it('does not accept the starter as it is', async () => {
    const result = await run(exercise.starter);
    expect(result.passed).not.toBe(true);
  }, 120_000);

  it('gives hints that lead somewhere', () => {
    expect(exercise.hints.length).toBeGreaterThanOrEqual(2);
  });
});

describe('runner', () => {
  it('shows only the reader’s own frames in a traceback', async () => {
    const result = await runExercise(py, indexURL, { code: 'def f():\n    return 1 / 0\n\nf()\n' });
    expect(result.error).toContain('ZeroDivisionError');
    expect(result.error).toContain('exercise.py", line 2');
    expect(result.error).not.toContain('grwu_runner');
  });

  it('reports a syntax error with its line', async () => {
    const result = await runExercise(py, indexURL, { code: 'x = [1, 2\nprint(x)\n' });
    expect(result.error).toMatch(/SyntaxError/);
    expect(result.passed).toBeNull();
  });

  it('traces every line and value', async () => {
    const result = await runExercise(py, indexURL, {
      code: 'f = 250\ntau = 0.004\ncycles = f * tau\n',
      trace: true,
    });
    expect(result.error).toBeNull();
    expect(result.trace).toContain('cycles = 1.0');
  }, 120_000);

  it('returns the figures matplotlib drew', async () => {
    const result = await runExercise(py, indexURL, {
      code: 'import matplotlib.pyplot as plt\nplt.plot([0, 1, 2], [1, 0, 1])\n',
    });
    expect(result.error).toBeNull();
    expect(result.figures).toHaveLength(1);
    expect(result.stdout).not.toMatch(/Deprecation/);
  }, 120_000);
});
