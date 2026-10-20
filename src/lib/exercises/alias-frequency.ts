import type { Exercise } from './types';

export const aliasFrequency: Exercise = {
  id: 'alias-frequency',
  starter: `def alias(f, fs):
    """The frequency, in Hz, at which a tone of f Hz appears when sampled fs times a second."""
    return ...

print(alias(45, 64))
`,
  solution: `def alias(f, fs):
    """The frequency, in Hz, at which a tone of f Hz appears when sampled fs times a second."""
    return abs(f - fs * round(f / fs))

print(alias(45, 64))
`,
  wrong: [
    'def alias(f, fs):\n    return f\n',
    'def alias(f, fs):\n    return f % fs\n',
    'def alias(f, fs):\n    return abs(f - fs)\n',
  ],
  check: `import numpy as np

def apparent(f, fs):
    """Where numpy's FFT finds a sampled tone: the independent reference."""
    n = 4 * fs
    x = np.cos(2 * np.pi * f * np.arange(n) / fs)
    return np.fft.rfftfreq(n, 1 / fs)[np.argmax(np.abs(np.fft.rfft(x)))]

def check(ns, output):
    alias = ns.get("alias")
    if not callable(alias):
        raise Feedback("Define a function called alias(f, fs).")
    for f, fs in [(10, 64), (45, 64), (70, 64), (100, 64), (130, 64), (300, 4096)]:
        got = alias(f, fs)
        if got is None or got is Ellipsis:
            raise Feedback("alias still returns nothing: replace ... with a formula.")
        want = float(apparent(f, fs))
        if abs(float(got) - want) > 1e-9:
            if f < fs / 2:
                raise Feedback(f"alias({f}, {fs}) gave {got}; below half the sampling rate a tone is recorded as itself.")
            raise Feedback(
                f"alias({f}, {fs}) gave {got}, but the samples show a {want:g} Hz tone. "
                "Above half the sampling rate a tone folds back: subtract the nearest whole multiple of fs."
            )
    return "Right: a 45 Hz tone sampled 64 times a second is recorded as 19 Hz."
`,
  hints: [
    'Below fs/2 nothing happens. A tone of f and a tone of f − fs give exactly the same samples, so shift f by a whole number of fs until it is as close to zero as possible.',
    'The nearest whole multiple of fs is fs × round(f / fs). What is left over can be negative; a tone of −19 Hz sounds like 19 Hz.',
    'return abs(f - fs * round(f / fs))',
  ],
};
