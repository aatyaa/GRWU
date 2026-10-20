import type { Exercise } from './types';

export const reducedChiSquare: Exercise = {
  id: 'reduced-chi-square',
  setup: `import numpy as np
from scipy.optimize import curve_fit

fs = 4096
sigma = 0.15
t = np.arange(160) / fs

def ring(t, f, tau, amplitude, phase):
    return amplitude * np.exp(-t / tau) * np.cos(2 * np.pi * f * t + phase)

y = ring(t, 250, 0.004, 1.0, 0.4) + sigma * np.random.default_rng(4).standard_normal(t.size)
popt, _ = curve_fit(ring, t, y, p0=[245, 0.0045, 0.9, 0.3])
model = ring(t, *popt)
`,
  starter: `import numpy as np

# y holds 160 samples of a ring in noise of known spread sigma = 0.15, and model holds the
# best-fitting ring, found by adjusting k = 4 numbers: frequency, damping time, amplitude, phase.

def reduced_chi2(data, model, sigma, k):
    """The reduced chi-squared of a fit with k free parameters, in noise of spread sigma."""
    chi2 = ...
    dof = ...
    return chi2 / dof

print(reduced_chi2(y, model, sigma, k=4))
`,
  solution: `import numpy as np

def reduced_chi2(data, model, sigma, k):
    """The reduced chi-squared of a fit with k free parameters, in noise of spread sigma."""
    chi2 = np.sum(((data - model) / sigma) ** 2)
    dof = len(data) - k
    return chi2 / dof

print(reduced_chi2(y, model, sigma, k=4))
`,
  wrong: [
    `import numpy as np
def reduced_chi2(data, model, sigma, k):
    chi2 = np.sum(((data - model) / sigma) ** 2)
    dof = len(data)
    return chi2 / dof
`,
    `import numpy as np
def reduced_chi2(data, model, sigma, k):
    chi2 = np.sum((data - model) ** 2) / sigma
    dof = len(data) - k
    return chi2 / dof
`,
    `import numpy as np
def reduced_chi2(data, model, sigma, k):
    chi2 = np.sum((data - model) ** 2)
    dof = len(data) - k
    return chi2 / dof
`,
    `import numpy as np
def reduced_chi2(data, model, sigma, k):
    chi2 = np.sum(np.abs(data - model) / sigma)
    dof = len(data) - k
    return chi2 / dof
`,
  ],
  check: `import numpy as np

def check(ns, output):
    f = ns.get("reduced_chi2")
    if not callable(f):
        raise Feedback("Keep the function reduced_chi2(data, model, sigma, k).")
    data = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
    model = np.array([1.1, 1.8, 3.3, 3.9, 5.2, 5.7])
    sigma, k = 0.2, 4
    misses = data - model
    try:
        got = float(f(data, model, sigma, k))
    except TypeError:
        raise Feedback("chi2 or dof is still ... : fill in both.")
    right = np.sum((misses / sigma) ** 2) / (len(data) - k)
    if np.isclose(got, right, rtol=1e-9):
        value = float(f(ns["y"], ns["model"], ns["sigma"], 4))
        return (
            f"Right: for the ring the reduced chi-squared is {value:.2f}. Close to 1 means what the fit "
            "leaves over is as big as the noise, and no bigger."
        )
    if np.isclose(got, np.sum((misses / sigma) ** 2) / len(data), rtol=1e-9):
        raise Feedback(
            "Divide by the degrees of freedom, len(data) − k, not len(data). Each number the fit adjusts "
            "lets it follow the noise a little, so k of the misses are not free."
        )
    if np.isclose(got, np.sum(misses**2) / sigma / (len(data) - k), rtol=1e-9):
        raise Feedback("Square sigma too: divide each miss by sigma, then square, so chi2 has no units.")
    if np.isclose(got, np.sum(misses**2) / (len(data) - k), rtol=1e-9):
        raise Feedback(
            "Measure each miss in units of the noise: divide it by sigma before squaring. Otherwise the "
            "number depends on the units of the data, not on how good the fit is."
        )
    raise Feedback(
        f"For a small test fit your function returns {got:.4g}; it should return {right:.4g}. "
        "Square each miss divided by sigma, add them up, and divide by len(data) − k."
    )
`,
  hints: [
    'chi2 adds up the squared misses, each measured in units of the noise: ((data − model) / sigma) squared.',
    'The degrees of freedom are the number of data points minus the number of things the fit was allowed to adjust.',
    'chi2 = np.sum(((data - model) / sigma) ** 2) and dof = len(data) - k',
  ],
};
