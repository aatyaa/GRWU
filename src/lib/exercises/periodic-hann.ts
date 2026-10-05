import type { Exercise } from './types';

export const periodicHann: Exercise = {
  id: 'periodic-hann',
  starter: `import numpy as np
from scipy.signal import get_window

def hann(n):
    """The Hann window of length n that scipy's welch uses."""
    k = np.arange(n)
    return ...

# Before trusting it anywhere, check it against the reference.
print(np.allclose(hann(8), get_window("hann", 8)))
`,
  solution: `import numpy as np
from scipy.signal import get_window

def hann(n):
    """The Hann window of length n that scipy's welch uses."""
    k = np.arange(n)
    return 0.5 - 0.5 * np.cos(2 * np.pi * k / n)

print(np.allclose(hann(8), get_window("hann", 8)))
`,
  wrong: [
    `import numpy as np
def hann(n):
    return np.hanning(n)
`,
    `import numpy as np
def hann(n):
    k = np.arange(n)
    return 0.5 - 0.5 * np.cos(2 * np.pi * k / (n - 1))
`,
    `import numpy as np
def hann(n):
    k = np.arange(n)
    return np.sin(np.pi * k / n)
`,
  ],
  check: `import numpy as np
from scipy.signal import get_window

def check(ns, output):
    hann = ns.get("hann")
    if not callable(hann):
        raise Feedback("Keep the function hann(n).")
    sizes = [8, 64, 512, 4096]
    try:
        windows = [np.asarray(hann(n), dtype=float) for n in sizes]
    except TypeError:
        raise Feedback("hann still returns ... : write the formula for the window.")
    for n, w in zip(sizes, windows):
        if w.shape != (n,):
            raise Feedback(f"hann({n}) should have {n} values; yours has shape {w.shape}.")
    if all(np.allclose(w, get_window("hann", n), rtol=0, atol=1e-12) for n, w in zip(sizes, windows)):
        worst = np.max(np.abs(np.hanning(8) - get_window("hann", 8)))
        return (
            "Right: your window matches scipy's for every length tried. np.hanning gives the other kind, "
            f"which differs from it by up to {worst:.2f} at length 8: a test against the reference catches that, "
            "and a glance at a plot does not."
        )
    if all(np.allclose(w, np.hanning(n)) for n, w in zip(sizes, windows)):
        raise Feedback(
            "This is the symmetric Hann window: it ends at 0 on both sides, like np.hanning. "
            "Spectral estimates use the periodic kind, which divides by n instead of n − 1, so that "
            "copies of it placed end to end repeat smoothly."
        )
    raise Feedback(
        f"hann(8) gives {np.round(windows[0], 3).tolist()}, but the reference is "
        f"{np.round(get_window('hann', 8), 3).tolist()}. The Hann window is 0.5 − 0.5 cos(2πk/n)."
    )
`,
  hints: [
    'The Hann window is a raised cosine: 0.5 − 0.5 cos(…), which starts at 0 and rises to 1 in the middle.',
    'There are two kinds. The one welch uses divides by n, not n − 1: 2πk/n.',
    'return 0.5 - 0.5 * np.cos(2 * np.pi * k / n)',
  ],
};
