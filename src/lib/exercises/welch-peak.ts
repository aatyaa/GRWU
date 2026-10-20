import type { Exercise } from './types';

export const welchPeak: Exercise = {
  id: 'welch-peak',
  setup: `import numpy as np
fs = 256
t = np.arange(2048) / fs
x = np.random.default_rng(1).standard_normal(t.size) + 0.5 * np.sin(2 * np.pi * 40 * t)
`,
  starter: `from scipy import signal
import numpy as np

# x holds 8 seconds of noisy data sampled at fs = 256 Hz, with one tone hidden in it.
freqs, psd = signal.welch(x, fs=fs, nperseg=512)

peak = ...  # the frequency, in Hz, where psd is largest
print(peak)
`,
  solution: `from scipy import signal
import numpy as np

freqs, psd = signal.welch(x, fs=fs, nperseg=512)

peak = freqs[np.argmax(psd)]
print(peak)
`,
  wrong: [
    'from scipy import signal\nimport numpy as np\nfreqs, psd = signal.welch(x, fs=fs, nperseg=512)\npeak = np.argmax(psd)\n',
    'from scipy import signal\nfreqs, psd = signal.welch(x, fs=fs, nperseg=512)\npeak = psd.max()\n',
    'peak = 0\n',
  ],
  check: `import numpy as np
from scipy import signal

def check(ns, output):
    if "peak" not in ns or ns["peak"] is Ellipsis:
        raise Feedback("Set peak to the frequency where the spectrum is largest.")
    peak = float(np.asarray(ns["peak"]))
    freqs, psd = signal.welch(ns["x"], fs=ns["fs"], nperseg=512)
    index = int(np.argmax(psd))
    if abs(peak - index) < 1e-9 and abs(peak - freqs[index]) > 1e-9:
        raise Feedback(f"{peak:g} is the position of the peak in the array, not its frequency: look it up in freqs.")
    if abs(peak - psd.max()) < 1e-12:
        raise Feedback("That is the height of the peak. The question is where it is: which frequency.")
    if abs(peak - freqs[index]) > 1e-9:
        raise Feedback(f"peak is {peak:g} Hz, but the spectrum is largest somewhere else.")
    return f"Right: the hidden tone is at {freqs[index]:g} Hz."
`,
  hints: [
    'psd is an array of heights, one for each frequency in freqs. Find where the height is largest.',
    'np.argmax(psd) gives the index of the largest value, not a frequency.',
    'peak = freqs[np.argmax(psd)]',
  ],
};
