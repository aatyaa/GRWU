import type { Exercise } from './types';

export const twoCloseTones: Exercise = {
  id: 'two-close-tones',
  setup: `import numpy as np
fs = 256
t = np.arange(512) / fs          # two seconds
rng = np.random.default_rng(7)
x = np.sin(2 * np.pi * 30 * t) + 0.8 * np.sin(2 * np.pi * 33 * t) + 0.1 * rng.standard_normal(t.size)
`,
  starter: `import numpy as np

# x holds two seconds of a recording, sampled at fs = 256 Hz. Two tones are in it.
spectrum = np.abs(np.fft.rfft(x))
freqs = np.fft.rfftfreq(len(x), 1 / fs)

tones = ...  # the two frequencies, in Hz, where spectrum is largest, smallest first
print(tones)
`,
  solution: `import numpy as np

spectrum = np.abs(np.fft.rfft(x))
freqs = np.fft.rfftfreq(len(x), 1 / fs)

tones = sorted(freqs[np.argsort(spectrum)[-2:]])
print(tones)
`,
  wrong: [
    'import numpy as np\nspectrum = np.abs(np.fft.rfft(x))\ntones = sorted(np.argsort(spectrum)[-2:])\n',
    'import numpy as np\nshort = x[:64]\nspectrum = np.abs(np.fft.rfft(short))\nfreqs = np.fft.rfftfreq(len(short), 1 / fs)\ntones = sorted(freqs[np.argsort(spectrum)[-2:]])\n',
    'import numpy as np\nspectrum = np.abs(np.fft.rfft(x))\nfreqs = np.fft.rfftfreq(len(x), 1 / fs)\ntones = [freqs[np.argmax(spectrum)]] * 2\n',
  ],
  check: `import numpy as np

def check(ns, output):
    tones = ns.get("tones")
    if tones is None or tones is Ellipsis:
        raise Feedback("Set tones to a list of the two frequencies.")
    try:
        got = sorted(float(v) for v in tones)
    except TypeError:
        raise Feedback("tones should be a list of two numbers, like [12.0, 20.5].")
    if len(got) != 2:
        raise Feedback(f"tones has {len(got)} values; it should have two.")
    if got == [60.0, 66.0]:
        raise Feedback("Those are positions in the array, not frequencies: look them up in freqs.")
    if abs(got[0] - got[1]) < 1e-9:
        raise Feedback("Both values are the same tone. Take the two largest peaks, not the largest one twice.")
    if got != [30.0, 33.0]:
        raise Feedback(
            f"You found {got[0]:g} and {got[1]:g} Hz. Two tones 3 Hz apart need bins finer than 3 Hz: "
            "the bin spacing is 1 / (length of the stretch in seconds), so use the whole record."
        )
    return "Right: 30 and 33 Hz. Two seconds of data give 0.5 Hz bins, fine enough to tell them apart."
`,
  hints: [
    'spectrum has one value per frequency in freqs. You want the frequencies of its two largest values.',
    'np.argsort(spectrum)[-2:] gives the positions of the two largest values; freqs at those positions are the frequencies.',
    'tones = sorted(freqs[np.argsort(spectrum)[-2:]])',
  ],
};
