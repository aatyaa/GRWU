import type { Exercise } from './types';

export const injectionRecovery: Exercise = {
  id: 'injection-recovery',
  setup: `import numpy as np
import warnings
from scipy.optimize import OptimizeWarning, curve_fit

warnings.simplefilter("ignore", OptimizeWarning)
fs = 4096
sigma = 0.15
t = np.arange(160) / fs

def ring(t, f, tau, amplitude, phase):
    return amplitude * np.exp(-t / tau) * np.cos(2 * np.pi * f * t + phase)

signal = ring(t, 250, 0.004, 1.0, 0.4)

def fit_frequency(data):
    """Fit one ring to the data and return its frequency in Hz (nan if no fit is found)."""
    try:
        popt, _ = curve_fit(ring, t, data, p0=[240, 0.005, 0.8, 0.0], maxfev=2000)
    except RuntimeError:
        return np.nan
    return popt[0]
`,
  starter: `import numpy as np

# signal is a ring at 250 Hz. sigma = 0.15 is the spread of the detector's noise.
# fit_frequency(data) fits a ring to data and returns its frequency.
rng = np.random.default_rng(1)
recovered = []
for _ in range(150):
    # A fake detection: the known signal plus its own stretch of noise.
    data = ...
    recovered.append(fit_frequency(data))

recovered = np.array(recovered)
print("average:", recovered.mean(), "spread:", recovered.std())
`,
  solution: `import numpy as np

rng = np.random.default_rng(1)
recovered = []
for _ in range(150):
    data = signal + sigma * rng.standard_normal(t.size)
    recovered.append(fit_frequency(data))

recovered = np.array(recovered)
print("average:", recovered.mean(), "spread:", recovered.std())
`,
  wrong: [
    `import numpy as np
recovered = np.array([fit_frequency(signal) for _ in range(150)])
`,
    `import numpy as np
rng = np.random.default_rng(1)
noise = sigma * rng.standard_normal(t.size)
recovered = np.array([fit_frequency(signal + noise) for _ in range(150)])
`,
    `import numpy as np
rng = np.random.default_rng(1)
recovered = np.array([fit_frequency(signal + rng.standard_normal(t.size)) for _ in range(150)])
`,
    `import numpy as np
rng = np.random.default_rng(1)
recovered = np.array([fit_frequency(sigma * rng.standard_normal(t.size)) for _ in range(150)])
`,
  ],
  check: `import numpy as np
from scipy.optimize import curve_fit

def check(ns, output):
    recovered = ns.get("recovered")
    if recovered is None:
        raise Feedback("Keep the array recovered: one fitted frequency per fake detection.")
    recovered = np.asarray(recovered, dtype=float)
    if recovered.size < 50:
        raise Feedback("Make at least 50 fake detections, so the spread of their answers can be measured.")
    failed = int(np.isnan(recovered).sum())
    found = recovered[~np.isnan(recovered)]
    # The error bar a single fit reports: curve_fit's covariance with the noise spread given.
    ring, t, sigma = ns["ring"], ns["t"], ns["sigma"]
    _, cov = curve_fit(ring, t, ns["signal"], p0=[250, 0.004, 1.0, 0.4], sigma=np.full(t.size, sigma), absolute_sigma=True)
    expected = float(np.sqrt(cov[0, 0]))
    spread = float(found.std()) if found.size > 1 else 0.0
    mean = float(found.mean()) if found.size else float("nan")
    if spread < 0.05 * expected:
        raise Feedback(
            "Every fake detection gave the same answer, so it tells you nothing about the noise. "
            "Each one needs its own fresh noise, drawn inside the loop and added to the signal."
        )
    if failed > 0.1 * recovered.size or spread > 2 * expected:
        lost = f", and {failed} fits found no ring at all" if failed else ""
        raise Feedback(
            f"The answers scatter by ±{spread:.0f} Hz, far more than one fit's error bar of ±{expected:.1f} Hz{lost}. "
            "Check that each fake detection holds the signal plus noise of spread sigma: standard_normal "
            "draws noise of spread 1."
        )
    if abs(mean - 250) > 4 * expected / np.sqrt(found.size) or not 0.7 < spread / expected < 1.4:
        raise Feedback(f"Close: the answers average {mean:.1f} Hz with spread ±{spread:.1f} Hz; expected near 250 and ±{expected:.1f}.")
    return (
        f"Right: {found.size} fake detections average {mean:.1f} Hz, the frequency put in, and scatter by "
        f"±{spread:.1f} Hz, as one fit's error bar of ±{expected:.1f} Hz says they should."
    )
`,
  hints: [
    'A fake detection is what the detector would record if this signal arrived: the signal, plus noise.',
    'Draw new noise on every pass through the loop: sigma times rng.standard_normal(t.size) has the detector’s spread.',
    'data = signal + sigma * rng.standard_normal(t.size)',
  ],
};
